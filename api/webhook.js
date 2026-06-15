// api/webhook.js
const Stripe = require('stripe');
const Anthropic = require('@anthropic-ai/sdk');
const { Resend } = require('resend');
const { calcFinancials, fmt } = require('../lib/financials');
const { generateBusinessPlanHTML } = require('../lib/pdfTemplate');
const { generateProjetHTML } = require('../lib/projetTemplate');
const { generateMarcheHTML } = require('../lib/marcheTemplate');
const { generateExcelBase64 } = require('../lib/excelGenerator');

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function htmlToPDF(htmlContent, filename) {
  try {
    const apiKey = process.env.PDFCO_API_KEY;

    // Étape 1 : Upload le fichier HTML
    const uploadRes = await fetch('https://api.pdf.co/v1/file/upload/base64', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: filename + '.html',
        file: Buffer.from(htmlContent).toString('base64'),
      }),
    });
    const uploadData = await uploadRes.json();

    let convertBody;
    if (uploadData.url) {
      // Upload réussi → utilise l'URL
      console.log(`Upload OK: ${uploadData.url}`);
      convertBody = {
        url: uploadData.url,
        paperSize: 'A4',
        orientation: 'Portrait',
        printBackground: true,
        margins: '10mm 12mm 10mm 12mm',
        async: false,
      };
    } else {
      // Upload échoué → envoie le HTML directement (limite 1MB)
      console.log('Upload échoué, envoi HTML direct');
      const htmlTrunc = htmlContent.substring(0, 900000); // Max ~900KB
      convertBody = {
        html: htmlTrunc,
        paperSize: 'A4',
        orientation: 'Portrait',
        printBackground: true,
        margins: '10mm 12mm 10mm 12mm',
        async: false,
      };
    }

    const convertRes = await fetch('https://api.pdf.co/v1/pdf/convert/from/html', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(convertBody),
    });
    const convertData = await convertRes.json();
    if (!convertData.url) throw new Error('Conversion échouée: ' + JSON.stringify(convertData));

    const pdfRes = await fetch(convertData.url);
    const pdfBuf = await pdfRes.arrayBuffer();
    return Buffer.from(pdfBuf);
  } catch (err) {
    console.error(`PDF.co error (${filename}):`, err.message);
    return null;
  }
}

// ── EXCEL SIMPLE : tableau financier condensé ────────────────────────
async function generateSimpleExcel(data, fin) {
  try {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'PlanIA';

    const DARK_BLUE  = '0F2540';
    const MID_BLUE   = '1A3A5C';
    const GOLD_LIGHT = 'FFF8EC';
    const GOLD       = 'C8973A';
    const GREEN_L    = 'F0FFF4';
    const GREEN      = '276749';
    const WHITE      = 'FFFFFF';
    const GRAY       = 'F7FAFC';
    const moneyFmt   = '# ##0" €";(# ##0" €");"-"';
    const pctFmt     = '0.0%';

    const b = (color = 'E2E8F0') => ({ style: 'thin', color: { argb: 'FF' + color } });
    const bAll = { top: b(), left: b(), bottom: b(), right: b() };

    function setCell(ws, row, col, value, opts = {}) {
      const c = ws.getCell(row, col);
      c.value = value;
      c.font = {
        bold: opts.bold || false,
        size: opts.size || 10,
        color: { argb: 'FF' + (opts.color || '2D3748') },
        name: 'Arial',
      };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (opts.bg || WHITE) } };
      c.alignment = { horizontal: opts.h || 'left', vertical: 'middle', wrapText: opts.wrap || false };
      if (opts.fmt) c.numFmt = opts.fmt;
      c.border = bAll;
      return c;
    }

    // ── FEUILLE UNIQUE : Synthèse financière ────────────────────────
    const ws = wb.addWorksheet('Synthèse Financière');
    ws.showGridLines = false;
    ws.getColumn(1).width = 2;
    ws.getColumn(2).width = 38;
    ws.getColumn(3).width = 18;
    ws.getColumn(4).width = 18;
    ws.getColumn(5).width = 18;
    ws.getColumn(6).width = 2;

    // Titre
    ws.mergeCells(1, 1, 1, 6);
    const t = ws.getCell(1, 1);
    t.value = `SYNTHÈSE FINANCIÈRE — ${(data.nomProjet || '').toUpperCase()}`;
    t.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
    t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + DARK_BLUE } };
    t.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 36;

    ws.mergeCells(2, 1, 2, 6);
    const t2 = ws.getCell(2, 1);
    t2.value = `${data.prenom || ''} ${data.nom || ''} · ${data.juridique || ''} · ${data.ville || ''} · Lancement : ${data.lancement || 'À définir'}`;
    t2.font = { size: 9, color: { argb: 'FF718096' }, italic: true, name: 'Arial' };
    t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAFC' } };
    t2.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 18;

    let r = 4;

    // ── SECTION : Chiffres clés ──────────────────────────────────────
    ws.mergeCells(r, 2, r, 5);
    const sh1 = ws.getCell(r, 2);
    sh1.value = '▸ CHIFFRES CLÉS';
    sh1.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
    sh1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + MID_BLUE } };
    sh1.alignment = { horizontal: 'left', vertical: 'middle' };
    sh1.border = bAll;
    ws.getRow(r).height = 20;
    r++;

    // En-têtes colonnes
    ['INDICATEUR', 'ANNÉE 1', 'ANNÉE 2', 'ANNÉE 3'].forEach((title, i) => {
      const c = ws.getCell(r, i + 2);
      c.value = title;
      c.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + MID_BLUE } };
      c.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' };
      c.border = bAll;
    });
    ws.getRow(r).height = 20;
    r++;

    const kpis = [
      ['Chiffre d\'affaires HT', fin.ca1, fin.ca2, fin.ca3, moneyFmt, false],
      ['Marge brute', fin.mb1, fin.mb2, fin.mb3, moneyFmt, false],
      ['Taux de marge brute', fin.tauxMVC / 100, fin.ca2 > 0 ? fin.mb2 / fin.ca2 : 0, fin.ca3 > 0 ? fin.mb3 / fin.ca3 : 0, pctFmt, false],
      ['EBE (Excédent Brut d\'Exploitation)', fin.ebe1, fin.ebe2, fin.ebe3, moneyFmt, false],
      ['Résultat net', fin.rn1, fin.rn2, fin.rn3, moneyFmt, true],
      ['Marge nette (%)', fin.ca1 > 0 ? fin.rn1 / fin.ca1 : 0, fin.ca2 > 0 ? fin.rn2 / fin.ca2 : 0, fin.ca3 > 0 ? fin.rn3 / fin.ca3 : 0, pctFmt, false],
      ['Seuil de rentabilité', fin.sr1, 0, 0, moneyFmt, false],
      ['Capacité d\'autofinancement (CAF)', fin.caf1, fin.caf2, fin.caf3, moneyFmt, false],
    ];

    kpis.forEach(([label, v1, v2, v3, fmt, highlight], i) => {
      const bg = highlight ? GOLD_LIGHT : (i % 2 === 0 ? WHITE : GRAY);
      const color = highlight ? '8B6914' : '4A5568';
      setCell(ws, r, 2, label, { bold: highlight, bg, color });
      [v1, v2, v3].forEach((v, j) => {
        setCell(ws, r, j + 3, v || null, { bold: highlight, bg, color, fmt, h: 'right' });
      });
      ws.getRow(r).height = 18;
      r++;
    });

    r++;

    // ── SECTION : Plan de financement ───────────────────────────────
    ws.mergeCells(r, 2, r, 5);
    const sh2 = ws.getCell(r, 2);
    sh2.value = '▸ PLAN DE FINANCEMENT';
    sh2.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
    sh2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + MID_BLUE } };
    sh2.alignment = { horizontal: 'left', vertical: 'middle' };
    sh2.border = bAll;
    ws.getRow(r).height = 20;
    r++;

    const financement = [
      ['Apport personnel', fin.apport, false],
      ['Emprunt bancaire', fin.capital, false],
      ['Total ressources', fin.totalRessources, true],
      ['Total besoins', fin.totalInvest, false],
      ['Solde', fin.totalRessources - fin.totalInvest, true],
    ];

    financement.forEach(([label, val, highlight], i) => {
      const bg = highlight ? GREEN_L : (i % 2 === 0 ? WHITE : GRAY);
      const color = highlight ? GREEN : '4A5568';
      ws.mergeCells(r, 3, r, 5);
      setCell(ws, r, 2, label, { bold: highlight, bg, color });
      setCell(ws, r, 3, val || null, { bold: highlight, bg, color, fmt: moneyFmt, h: 'right' });
      ws.getRow(r).height = 18;
      r++;
    });

    r++;

    // ── SECTION : Charges ────────────────────────────────────────────
    ws.mergeCells(r, 2, r, 5);
    const sh3 = ws.getCell(r, 2);
    sh3.value = '▸ CHARGES ANNUELLES';
    sh3.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
    sh3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + MID_BLUE } };
    sh3.alignment = { horizontal: 'left', vertical: 'middle' };
    sh3.border = bAll;
    ws.getRow(r).height = 20;
    r++;

    const charges = [
      ['Loyer et charges', (data.loyer || 0)],
      ['Assurances', (data.assurance || 0)],
      ['Téléphone / Internet', (data.tel || 0)],
      ['Expert-comptable', (data.compta || 0)],
      ['Publicité / Communication', (data.pub || 0)],
      ['Autres charges fixes', (data.autresCharges || 0)],
      ['Rémunération dirigeant (net)', (data.salaire || 0) * 12],
      ['Charges sociales dirigeant (~45%)', Math.round((data.salaire || 0) * 12 * 0.45)],
      ['Charges variables', fin.cv1],
    ];

    charges.forEach(([label, val], i) => {
      const bg = i % 2 === 0 ? WHITE : GRAY;
      ws.mergeCells(r, 3, r, 5);
      setCell(ws, r, 2, label, { bg });
      setCell(ws, r, 3, val || null, { bg, fmt: moneyFmt, h: 'right' });
      ws.getRow(r).height = 18;
      r++;
    });

    // Total charges
    ws.mergeCells(r, 3, r, 5);
    setCell(ws, r, 2, 'TOTAL CHARGES AN 1', { bold: true, bg: GOLD_LIGHT, color: '8B6914' });
    setCell(ws, r, 3, fin.cv1 + fin.cf + fin.totalDir, { bold: true, bg: GOLD_LIGHT, color: '8B6914', fmt: moneyFmt, h: 'right' });
    ws.getRow(r).height = 20;
    r++;

    r++;

    // ── SECTION : Emprunt ────────────────────────────────────────────
    if (fin.capital > 0) {
      ws.mergeCells(r, 2, r, 5);
      const sh4 = ws.getCell(r, 2);
      sh4.value = '▸ PARAMÈTRES DE L\'EMPRUNT';
      sh4.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
      sh4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + MID_BLUE } };
      sh4.alignment = { horizontal: 'left', vertical: 'middle' };
      sh4.border = bAll;
      ws.getRow(r).height = 20;
      r++;

      const empruntData = [
        ['Capital emprunté', fin.capital, moneyFmt],
        ['Taux d\'intérêt annuel', (data.taux || 4.5) / 100, pctFmt],
        ['Durée (mois)', data.duree || 60, '0'],
        ['Mensualité', fin.mensualite, moneyFmt],
        ['Remboursement annuel', fin.remboAnnuel, moneyFmt],
        ['Ratio CAF / Remboursement', fin.remboAnnuel > 0 ? fin.caf1 / fin.remboAnnuel : 0, '0.0"x"'],
      ];

      empruntData.forEach(([label, val, fmt], i) => {
        const bg = i % 2 === 0 ? WHITE : GRAY;
        ws.mergeCells(r, 3, r, 5);
        setCell(ws, r, 2, label, { bg });
        setCell(ws, r, 3, val || null, { bg, fmt, h: 'right' });
        ws.getRow(r).height = 18;
        r++;
      });
    }

    // Footer
    ws.getRow(r + 1).height = 8;
    ws.mergeCells(r + 2, 1, r + 2, 6);
    const footer = ws.getCell(r + 2, 1);
    footer.value = `Document généré par PlanIA · ${new Date().toLocaleDateString('fr-FR')} · Confidentiel`;
    footer.font = { size: 9, color: { argb: 'FFA0AEC0' }, italic: true, name: 'Arial' };
    footer.alignment = { horizontal: 'center' };

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer).toString('base64');

  } catch (err) {
    console.error('Simple Excel error:', err);
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const meta = session.metadata || {};

  try {
    const dataStr = (meta.data1||'')+(meta.data2||'')+(meta.data3||'')+(meta.data4||'')+(meta.data5||'');
    let formData = {};
    try { formData = JSON.parse(dataStr); }
    catch(e) {
      formData = {
        email: meta.email || session.customer_email,
        nomProjet: meta.nomProjet || 'Mon Projet',
        prenom: meta.prenom || '',
        nom: meta.nom || '',
        offre: meta.offre || 'simple',
      };
    }

    const clientEmail = formData.email || session.customer_email;
    const isPremium = formData.offre === 'premium';
    console.log(`Paiement ${isPremium ? 'PREMIUM 200€' : 'SIMPLE 100€'} — ${clientEmail} — ${formData.nomProjet}`);

    const fin = calcFinancials(formData);
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const nomFichier = (formData.nomProjet || 'Projet').replace(/\s+/g, '_');

    const destLabels = {
      banque: 'Banque / Organisme de credit',
      investisseur: 'Investisseur / Levee de fonds',
      subvention: 'Subvention / Association',
      personnel: 'Usage personnel',
    };
    const dest = formData.dest || formData.destinataire || 'banque';

    if (isPremium) {

      // ── PREMIUM : Excel complet + 2 PDF ─────────────────────────

      const promptProjet = `Tu es un expert en strategie d'entreprise. Redige le contenu d'un document professionnel de presentation de projet, style cabinet de conseil haut de gamme, SANS JAMAIS mentionner l'intelligence artificielle.

DONNEES :
- Porteur : ${formData.prenom} ${formData.nom}
- Projet : ${formData.nomProjet}
- Secteur : ${formData.secteur}
- Juridique : ${formData.juridique}
- Ville : ${formData.ville}
- Lancement : ${formData.lancement || 'Non precise'}
- Description : ${formData.description}
- Vision : ${formData.vision || formData.description}
- Parcours : ${formData.parcours}
- Objectifs : ${formData.objectifs || 'Non renseignes'}
- CA An1 : ${fmt(fin.ca1)}, Resultat net An1 : ${fmt(fin.rn1)}
- Investissement : ${fmt(fin.totalInvest)}, Emprunt : ${fmt(fin.capital)}

[S:RESUME](Resume executif 4 paragraphes min 200 mots)[/S]
[S:FONDATEUR](Presentation fondateur min 150 mots)[/S]
[S:HISTOIRE](Histoire et vision min 150 mots)[/S]
[S:PRODUITS](Produits et services min 150 mots)[/S]
[S:VALEUR](Proposition de valeur min 120 mots)[/S]
[S:MODELE](Modele economique min 120 mots)[/S]
[S:ORGANISATION](Organisation et equipe min 100 mots)[/S]
[S:OBJECTIFS](Objectifs CT/MT/LT min 120 mots)[/S]
[S:DEVELOPPEMENT](Plan de developpement min 150 mots)[/S]
[S:CONCLUSION](Conclusion min 100 mots)[/S]`;

      const promptMarche = `Tu es un expert en etude de marche et strategie commerciale. Redige une analyse complete et professionnelle. NE JAMAIS mentionner l'intelligence artificielle.

DONNEES :
- Projet : ${formData.nomProjet}
- Secteur : ${formData.secteur}
- Ville : ${formData.ville}
- Clients : ${formData.clients}
- Concurrents : ${formData.concurrents}
- Avantage : ${formData.avantage}
- Strategie : ${formData.strategie || formData.avantage}
- CA An1/2/3 : ${fmt(fin.ca1)} / ${fmt(fin.ca2)} / ${fmt(fin.ca3)}

[S:MARCHE](Analyse du marche min 200 mots)[/S]
[S:TENDANCES](Tendances sectorielles min 150 mots)[/S]
[S:CONCURRENCE](Analyse concurrents min 200 mots)[/S]
[S:CIBLES](Segmentation clients min 150 mots)[/S]
[S:POSITIONNEMENT](Positionnement strategique min 120 mots)[/S]
[S:AVANTAGES](Avantages concurrentiels min 120 mots)[/S]
[S:SWOT](SWOT : une ligne par item, format : F: texte | W: texte | O: texte | T: texte)[/S]
[S:MARKETING](Strategie marketing min 150 mots)[/S]
[S:COMMERCIALE](Strategie commerciale min 150 mots)[/S]
[S:CROISSANCE](Perspectives de croissance min 120 mots)[/S]`;

      const [resProjet, resMarche] = await Promise.all([
        anthropic.messages.create({ model: 'claude-sonnet-4-5', max_tokens: 4000, messages: [{ role: 'user', content: promptProjet }] }),
        anthropic.messages.create({ model: 'claude-sonnet-4-5', max_tokens: 4000, messages: [{ role: 'user', content: promptMarche }] }),
      ]);

      const textProjet = resProjet.content[0]?.text || '';
      const textMarche = resMarche.content[0]?.text || '';

      function parseS(text, key) {
        const re = new RegExp(`\\[S:${key}\\]([\\s\\S]*?)\\[\\/S\\]`);
        const m = text.match(re);
        return m ? m[1].trim() : '';
      }

      const sectionsProjet = { resume: parseS(textProjet,'RESUME'), fondateur: parseS(textProjet,'FONDATEUR'), histoire: parseS(textProjet,'HISTOIRE'), produits: parseS(textProjet,'PRODUITS'), valeur: parseS(textProjet,'VALEUR'), modele: parseS(textProjet,'MODELE'), organisation: parseS(textProjet,'ORGANISATION'), objectifs: parseS(textProjet,'OBJECTIFS'), developpement: parseS(textProjet,'DEVELOPPEMENT'), conclusion: parseS(textProjet,'CONCLUSION') };
      const sectionsMarche = { marche: parseS(textMarche,'MARCHE'), tendances: parseS(textMarche,'TENDANCES'), concurrence: parseS(textMarche,'CONCURRENCE'), cibles: parseS(textMarche,'CIBLES'), positionnement: parseS(textMarche,'POSITIONNEMENT'), avantages: parseS(textMarche,'AVANTAGES'), swot: parseS(textMarche,'SWOT'), marketing: parseS(textMarche,'MARKETING'), commerciale: parseS(textMarche,'COMMERCIALE'), croissance: parseS(textMarche,'CROISSANCE') };

      const htmlProjet = generateProjetHTML(formData, fin, sectionsProjet);
      const htmlMarche = generateMarcheHTML(formData, fin, sectionsMarche);

      console.log('Génération Excel + 2 PDF en parallèle...');
      const [pdfProjet, pdfMarche, excelBase64] = await Promise.all([
        htmlToPDF(htmlProjet, `Presentation_${nomFichier}`),
        htmlToPDF(htmlMarche, `Marche_${nomFichier}`),
        generateExcelBase64(formData, fin),
      ]);

      const attachments = [];
      if (excelBase64) { attachments.push({ filename: `Financier_${nomFichier}.xlsx`, content: excelBase64 }); console.log('Excel complet ✓'); }
      if (pdfProjet?.length > 1000) { attachments.push({ filename: `Presentation_${nomFichier}.pdf`, content: pdfProjet.toString('base64') }); console.log('PDF Présentation ✓'); }
      if (pdfMarche?.length > 1000) { attachments.push({ filename: `Marche_Strategie_${nomFichier}.pdf`, content: pdfMarche.toString('base64') }); console.log('PDF Marché ✓'); }

      await resend.emails.send({
        from: `PlanIA <${fromEmail}>`,
        to: clientEmail,
        subject: `Votre Pack Premium est pret - ${formData.nomProjet}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <div style="background:linear-gradient(135deg,#C8A96E,#8B6914);padding:32px;text-align:center;">
            <h1 style="color:#fff;font-size:22px;margin:0;font-family:Georgia,serif;">⭐ Pack Premium pret !</h1>
            <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px;">${formData.nomProjet}</p>
          </div>
          <div style="padding:28px;">
            <p style="font-size:15px;margin:0 0 14px;">Bonjour ${formData.prenom},</p>
            <p style="color:#555;margin:0 0 20px;font-size:14px;line-height:1.7;">Vos <strong>3 livrables professionnels</strong> sont en pieces jointes :</p>
            <div style="background:#FFF8EC;border:1px solid #E8D5A3;border-radius:8px;padding:18px;margin:0 0 20px;">
              <p style="margin:4px 0;font-size:13px;">📊 <strong>Financier_${nomFichier}.xlsx</strong> — Modele Excel financier complet (4 feuilles)</p>
              <p style="margin:4px 0;font-size:13px;">📄 <strong>Presentation_${nomFichier}.pdf</strong> — Presentation du projet (10 sections)</p>
              <p style="margin:4px 0;font-size:13px;">📈 <strong>Marche_Strategie_${nomFichier}.pdf</strong> — Etude de marche et strategie</p>
            </div>
            <p style="color:#718096;font-size:13px;">L'equipe PlanIA</p>
          </div>
        </div>`,
        attachments,
      });

    } else {

      // ── SIMPLE : PDF business plan + petit Excel ──────────────────

      const prompt = `Tu es un expert en creation d'entreprise. Redige un business plan professionnel pour des ${destLabels[dest] || 'partenaires financiers'}. NE JAMAIS mentionner l'intelligence artificielle.

DONNEES :
- Porteur : ${formData.prenom} ${formData.nom}
- Projet : ${formData.nomProjet}
- Secteur : ${formData.secteur}, Juridique : ${formData.juridique}, Ville : ${formData.ville}
- Lancement : ${formData.lancement || 'Non precise'}
- Description : ${formData.description}
- Parcours : ${formData.parcours}
- Clients : ${formData.clients}
- Concurrents : ${formData.concurrents}
- Avantage : ${formData.avantage}
- Strategie : ${formData.strategie || 'Non renseignee'}
- Risques : ${formData.risques || 'Non renseignes'}
- CA An1/2/3 : ${fmt(fin.ca1)} / ${fmt(fin.ca2)} / ${fmt(fin.ca3)}
- Resultat net An1 : ${fmt(fin.rn1)}, Seuil : ${fmt(fin.sr1)}
- Investissement : ${fmt(fin.totalInvest)}, Financement : ${fmt(fin.apport)} + ${fmt(fin.capital)}

[SECTION:RESUME](Resume executif min 200 mots)[/SECTION]
[SECTION:PORTEUR](Portrait porteur min 150 mots)[/SECTION]
[SECTION:PROJET](Description projet min 200 mots)[/SECTION]
[SECTION:MARCHE](Etude de marche min 200 mots)[/SECTION]
[SECTION:STRATEGIE](Strategie commerciale min 180 mots)[/SECTION]
[SECTION:RISQUES](5 risques : RISQUE: nom | NIVEAU: Faible ou Modere ou Eleve | MESURE: mesure)[/SECTION]`;

      const aiRes = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });

      const aiText = aiRes.content[0]?.text || '';
      function parseSection(text, key) {
        const re = new RegExp(`\\[SECTION:${key}\\]([\\s\\S]*?)\\[\\/SECTION\\]`);
        const m = text.match(re);
        return m ? m[1].trim() : '';
      }

      const aiSections = {
        resume: parseSection(aiText, 'RESUME'),
        porteur: parseSection(aiText, 'PORTEUR'),
        projet: parseSection(aiText, 'PROJET'),
        marche: parseSection(aiText, 'MARCHE'),
        strategie: parseSection(aiText, 'STRATEGIE'),
        risques: parseSection(aiText, 'RISQUES'),
      };

      const bpHTML = generateBusinessPlanHTML(formData, fin, aiSections);

      console.log('Génération PDF + Excel simple en parallèle...');
      const [pdfBuffer, excelSimple] = await Promise.all([
        htmlToPDF(bpHTML, `BusinessPlan_${nomFichier}`),
        generateSimpleExcel(formData, fin),
      ]);

      const isPDF = pdfBuffer && pdfBuffer.length > 1000;
      const attachments = [];
      if (isPDF) { attachments.push({ filename: `BusinessPlan_${nomFichier}.pdf`, content: pdfBuffer.toString('base64') }); console.log('PDF ✓'); }
      if (excelSimple) { attachments.push({ filename: `Chiffres_${nomFichier}.xlsx`, content: excelSimple }); console.log('Excel simple ✓'); }

      await resend.emails.send({
        from: `PlanIA <${fromEmail}>`,
        to: clientEmail,
        subject: `Votre business plan est pret - ${formData.nomProjet}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <div style="background:linear-gradient(135deg,#0F2540,#1A3A5C);padding:32px;text-align:center;">
            <h1 style="color:#fff;font-size:22px;margin:0;font-family:Georgia,serif;">Votre business plan est pret</h1>
            <p style="color:rgba(255,255,255,.6);margin:6px 0 0;font-size:13px;">${formData.nomProjet}</p>
          </div>
          <div style="padding:28px;">
            <p style="font-size:15px;margin:0 0 14px;">Bonjour ${formData.prenom},</p>
            <p style="color:#555;margin:0 0 20px;font-size:14px;line-height:1.7;">Vos <strong>2 documents</strong> pour <strong>${formData.nomProjet}</strong> sont en pieces jointes :</p>
            <div style="background:#EBF4FF;border:1px solid #BEE3F8;border-radius:8px;padding:18px;margin:0 0 20px;">
              <p style="margin:4px 0;font-size:13px;">📄 <strong>BusinessPlan_${nomFichier}.pdf</strong> — Business plan complet (8 sections)</p>
              <p style="margin:4px 0;font-size:13px;">📊 <strong>Chiffres_${nomFichier}.xlsx</strong> — Synthese financiere Excel</p>
            </div>
            <div style="background:#F7FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px;margin:0 0 20px;">
              <p style="margin:0;font-size:13px;color:#555;">Le fichier Excel contient vos chiffres cles, votre plan de financement et vos charges. Ouvrez-le dans Excel ou Google Sheets.</p>
            </div>
            <p style="color:#718096;font-size:13px;">L'equipe PlanIA</p>
          </div>
        </div>`,
        attachments,
      });

      console.log(`Email simple envoye a ${clientEmail} — ${attachments.length} fichiers`);
    }

    // Notification admin
    if (process.env.ADMIN_EMAIL) {
      await resend.emails.send({
        from: `PlanIA <${fromEmail}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `Vente ${isPremium ? 'PREMIUM 200€' : 'SIMPLE 100€'} - ${formData.nomProjet}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:480px;"><h2 style="color:${isPremium?'#8B6914':'#1A3A5C'};">💰 Vente ${isPremium?'⭐ PREMIUM':'Simple'} !</h2><p>Projet : <strong>${formData.nomProjet}</strong></p><p>Client : ${formData.prenom} ${formData.nom} — ${clientEmail}</p><p>Montant : <strong>${isPremium?'200':'100'} EUR</strong></p></div>`,
      });
    }

    return res.status(200).json({ success: true, offre: formData.offre });

  } catch (err) {
    console.error('Erreur webhook:', err);
    return res.status(200).json({ received: true, error: err.message });
  }
};
