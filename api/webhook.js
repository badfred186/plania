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

// ── CONVERSION HTML → PDF VIA PDF.CO ────────────────────────────────
async function htmlToPDF(htmlContent, filename) {
  try {
    const apiKey = process.env.PDFCO_API_KEY;

    // Upload HTML
    const uploadRes = await fetch('https://api.pdf.co/v1/file/upload/base64', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: filename + '.html',
        file: Buffer.from(htmlContent).toString('base64'),
      }),
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.url) throw new Error('Upload échoué: ' + JSON.stringify(uploadData));

    // Convertir en PDF
    const convertRes = await fetch('https://api.pdf.co/v1/pdf/convert/from/html', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: uploadData.url,
        paperSize: 'A4',
        orientation: 'Portrait',
        printBackground: true,
        margins: '10mm 12mm 10mm 12mm',
        async: false,
      }),
    });
    const convertData = await convertRes.json();
    if (!convertData.url) throw new Error('Conversion échouée: ' + JSON.stringify(convertData));

    // Télécharger le PDF
    const pdfRes = await fetch(convertData.url);
    const pdfBuf = await pdfRes.arrayBuffer();
    return Buffer.from(pdfBuf);

  } catch (err) {
    console.error(`PDF.co error (${filename}):`, err.message);
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
    // Reconstituer les données
    const dataStr = (meta.data1||'')+(meta.data2||'')+(meta.data3||'')+(meta.data4||'')+(meta.data5||'');
    let formData = {};
    try { formData = JSON.parse(dataStr); }
    catch(e) {
      formData = { email: meta.email || session.customer_email, nomProjet: meta.nomProjet || 'Mon Projet', prenom: meta.prenom || '', nom: meta.nom || '', offre: meta.offre || 'simple' };
    }

    const clientEmail = formData.email || session.customer_email;
    const isPremium = formData.offre === 'premium';
    console.log(`Paiement ${isPremium ? 'PREMIUM' : 'SIMPLE'} pour: ${clientEmail} - ${formData.nomProjet}`);

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

    // ── GÉNÉRATION IA ────────────────────────────────────────────────
    if (isPremium) {

      // ── PREMIUM : 3 livrables ────────────────────────────────────

      // Prompt pour PDF Présentation Projet
      const promptProjet = `Tu es un expert en strategie d'entreprise et en creation de societes. Redige le contenu complet d'un document professionnel de presentation de projet, style cabinet de conseil haut de gamme.

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
- Financement : Apport ${fmt(fin.apport)} + Emprunt ${fmt(fin.capital)}
- CA An1 : ${fmt(fin.ca1)}, Resultat net An1 : ${fmt(fin.rn1)}

Redige les 10 sections avec ce format EXACT :

[S:RESUME](Resume executif 4 paragraphes minimum 200 mots)[/S]
[S:FONDATEUR](Presentation fondateur : parcours, competences, legitimite. Minimum 150 mots)[/S]
[S:HISTOIRE](Histoire et vision du projet. Minimum 150 mots)[/S]
[S:PRODUITS](Description produits/services proposes, offre detaillee. Minimum 150 mots)[/S]
[S:VALEUR](Proposition de valeur unique, benefices clients. Minimum 120 mots)[/S]
[S:MODELE](Modele economique : comment l'entreprise gagne de l'argent. Minimum 120 mots)[/S]
[S:ORGANISATION](Organisation : structure, equipe prevue, gouvernance. Minimum 100 mots)[/S]
[S:OBJECTIFS](Objectifs court/moyen/long terme, jalons cles. Minimum 120 mots)[/S]
[S:DEVELOPPEMENT](Plan de developpement et roadmap operationnelle. Minimum 150 mots)[/S]
[S:CONCLUSION](Conclusion percutante et appel a l'action. Minimum 100 mots)[/S]`;

      // Prompt pour PDF Étude de Marché
      const promptMarche = `Tu es un expert en etude de marche et strategie commerciale. Redige une analyse de marche complete et professionnelle.

DONNEES :
- Projet : ${formData.nomProjet}
- Secteur : ${formData.secteur}
- Ville : ${formData.ville}
- Clients cibles : ${formData.clients}
- Concurrents : ${formData.concurrents}
- Differenciateurs : ${formData.avantage}
- Strategie : ${formData.strategie || formData.avantage}
- CA An1/2/3 : ${fmt(fin.ca1)} / ${fmt(fin.ca2)} / ${fmt(fin.ca3)}

Redige avec ce format EXACT :

[S:MARCHE](Analyse du marche : taille, tendances, chiffres cles. Minimum 200 mots)[/S]
[S:TENDANCES](Tendances sectorielles cles et leur impact. Minimum 150 mots)[/S]
[S:CONCURRENCE](Analyse detaillee des concurrents directs et indirects. Minimum 200 mots)[/S]
[S:CIBLES](Segmentation clients : profils, besoins, comportements. Minimum 150 mots)[/S]
[S:POSITIONNEMENT](Positionnement strategique sur le marche. Minimum 120 mots)[/S]
[S:AVANTAGES](Avantages concurrentiels defensables. Minimum 120 mots)[/S]
[S:SWOT](Analyse SWOT complete : Forces, Faiblesses, Opportunites, Menaces. Format : F: texte | W: texte | O: texte | T: texte, chaque item sur une ligne)[/S]
[S:MARKETING](Strategie marketing detaillee : canaux, actions, budget. Minimum 150 mots)[/S]
[S:COMMERCIALE](Strategie commerciale et acquisition clients. Minimum 150 mots)[/S]
[S:CROISSANCE](Perspectives de croissance et scenarios. Minimum 120 mots)[/S]`;

      // Appels IA en parallèle
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

      const sectionsProjet = {
        resume: parseS(textProjet, 'RESUME'),
        fondateur: parseS(textProjet, 'FONDATEUR'),
        histoire: parseS(textProjet, 'HISTOIRE'),
        produits: parseS(textProjet, 'PRODUITS'),
        valeur: parseS(textProjet, 'VALEUR'),
        modele: parseS(textProjet, 'MODELE'),
        organisation: parseS(textProjet, 'ORGANISATION'),
        objectifs: parseS(textProjet, 'OBJECTIFS'),
        developpement: parseS(textProjet, 'DEVELOPPEMENT'),
        conclusion: parseS(textProjet, 'CONCLUSION'),
      };

      const sectionsMarche = {
        marche: parseS(textMarche, 'MARCHE'),
        tendances: parseS(textMarche, 'TENDANCES'),
        concurrence: parseS(textMarche, 'CONCURRENCE'),
        cibles: parseS(textMarche, 'CIBLES'),
        positionnement: parseS(textMarche, 'POSITIONNEMENT'),
        avantages: parseS(textMarche, 'AVANTAGES'),
        swot: parseS(textMarche, 'SWOT'),
        marketing: parseS(textMarche, 'MARKETING'),
        commerciale: parseS(textMarche, 'COMMERCIALE'),
        croissance: parseS(textMarche, 'CROISSANCE'),
      };

      // Générer les HTML
      const htmlProjet = generateProjetHTML(formData, fin, sectionsProjet);
      const htmlMarche = generateMarcheHTML(formData, fin, sectionsMarche);

      // Excel + 2 PDF en parallèle
      console.log('Génération Excel + 2 PDF en parallèle...');
      const [pdfProjet, pdfMarche, excelBase64] = await Promise.all([
        htmlToPDF(htmlProjet, `Presentation_${nomFichier}`),
        htmlToPDF(htmlMarche, `Marche_Strategie_${nomFichier}`),
        generateExcelBase64(formData, fin),
      ]);

      // Préparer les pièces jointes
      const attachments = [];
      if (excelBase64) {
        attachments.push({ filename: `Financier_${nomFichier}.xlsx`, content: excelBase64 });
        console.log('Excel ajouté ✓');
      }
      if (pdfProjet && pdfProjet.length > 1000) {
        attachments.push({ filename: `Presentation_${nomFichier}.pdf`, content: pdfProjet.toString('base64') });
        console.log('PDF Présentation ajouté ✓');
      }
      if (pdfMarche && pdfMarche.length > 1000) {
        attachments.push({ filename: `Marche_Strategie_${nomFichier}.pdf`, content: pdfMarche.toString('base64') });
        console.log('PDF Marché ajouté ✓');
      }

      // Email client PREMIUM
      await resend.emails.send({
        from: `PlanIA <${fromEmail}>`,
        to: clientEmail,
        subject: `Votre Pack Premium est pret - ${formData.nomProjet}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
            <div style="background:linear-gradient(135deg,#C8A96E,#8B6914);padding:36px;text-align:center;">
              <h1 style="color:#fff;font-size:22px;margin:0 0 6px;font-family:Georgia,serif;">⭐ Votre Pack Premium est pret !</h1>
              <p style="color:rgba(255,255,255,.8);margin:0;font-size:13px;">${formData.nomProjet}</p>
            </div>
            <div style="padding:32px;">
              <p style="font-size:16px;margin:0 0 16px;">Bonjour ${formData.prenom},</p>
              <p style="color:#555;line-height:1.7;margin:0 0 24px;font-size:14px;">
                Vos <strong>3 documents professionnels</strong> pour <strong>${formData.nomProjet}</strong> sont prets et en pieces jointes.
              </p>
              <div style="background:#FFF8EC;border:1px solid #E8D5A3;border-radius:8px;padding:20px;margin:0 0 24px;">
                <p style="font-size:13px;font-weight:600;color:#8B6914;margin:0 0 12px;">Vos 3 livrables :</p>
                <p style="margin:4px 0;font-size:13px;color:#333;">📊 <strong>Financier_${nomFichier}.xlsx</strong> — Modele Excel financier complet</p>
                <p style="margin:4px 0;font-size:13px;color:#333;">📄 <strong>Presentation_${nomFichier}.pdf</strong> — Presentation du projet (10 sections)</p>
                <p style="margin:4px 0;font-size:13px;color:#333;">📈 <strong>Marche_Strategie_${nomFichier}.pdf</strong> — Etude de marche et strategie</p>
              </div>
              <div style="background:#F8F9FB;border:1px solid #E4E6EB;border-radius:8px;padding:16px;margin:0 0 24px;">
                <p style="margin:0;font-size:13px;color:#555;"><strong>Le fichier Excel :</strong> Ouvrez-le dans Microsoft Excel ou Google Sheets. Les cellules en bleu sont modifiables — entrez vos propres hypotheses pour adapter les projections.</p>
              </div>
              <p style="color:#718096;font-size:13px;">Pour toute question, repondez a cet email.<br><strong style="color:#1A3A5C;">L equipe PlanIA</strong></p>
            </div>
            <div style="padding:16px;border-top:1px solid #E2E8F0;text-align:center;font-size:11px;color:#A0AEC0;background:#F7FAFC;">
              PlanIA · Pack Premium · Document confidentiel
            </div>
          </div>
        `,
        attachments,
      });

      console.log(`Pack Premium envoye a ${clientEmail} - ${attachments.length} fichiers`);

    } else {

      // ── SIMPLE : 1 PDF ─────────────────────────────────────────────
      const prompt = `Tu es un expert en creation d'entreprise, strategie et finance, specialise dans la redaction de business plans destines a des ${destLabels[formData.dest || formData.destinataire] || 'partenaires financiers'}.

DONNEES :
- Porteur : ${formData.prenom} ${formData.nom}
- Projet : ${formData.nomProjet}
- Secteur : ${formData.secteur}
- Juridique : ${formData.juridique}
- Ville : ${formData.ville}
- Lancement : ${formData.lancement || 'Non precise'}
- Description : ${formData.description}
- Parcours : ${formData.parcours}
- Clients : ${formData.clients}
- Concurrents : ${formData.concurrents}
- Avantage : ${formData.avantage}
- Strategie : ${formData.strategie || 'Non renseignee'}
- Risques : ${formData.risques || 'Non renseignes'}
- Aides : ${formData.aides || 'Aucune'}
- CA An1/2/3 : ${fmt(fin.ca1)} / ${fmt(fin.ca2)} / ${fmt(fin.ca3)}
- Resultat net An1 : ${fmt(fin.rn1)}
- Seuil rentabilite : ${fmt(fin.sr1)}
- Investissements : ${fmt(fin.totalInvest)}
- Financement : Apport ${fmt(fin.apport)} + Emprunt ${fmt(fin.capital)}

[SECTION:RESUME](Resume executif 4 paragraphes min 200 mots)[/SECTION]
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
      console.log('Conversion PDF simple...');
      const pdfBuffer = await htmlToPDF(bpHTML, `BusinessPlan_${nomFichier}`);
      const isPDF = pdfBuffer && pdfBuffer.length > 1000;

      const attachments = isPDF
        ? [{ filename: `BusinessPlan_${nomFichier}.pdf`, content: pdfBuffer.toString('base64') }]
        : [];

      await resend.emails.send({
        from: `PlanIA <${fromEmail}>`,
        to: clientEmail,
        subject: `Votre business plan est pret - ${formData.nomProjet}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
            <div style="background:linear-gradient(135deg,#0F2540,#1A3A5C);padding:36px;text-align:center;">
              <h1 style="color:#fff;font-size:22px;margin:0 0 6px;font-family:Georgia,serif;">Votre business plan est pret</h1>
              <p style="color:rgba(255,255,255,.6);margin:0;font-size:13px;">${formData.nomProjet}</p>
            </div>
            <div style="padding:32px;">
              <p style="font-size:16px;margin:0 0 16px;">Bonjour ${formData.prenom},</p>
              <p style="color:#555;line-height:1.7;margin:0 0 24px;font-size:14px;">
                Votre business plan pour <strong>${formData.nomProjet}</strong> est en piece jointe au format ${isPDF ? '<strong>PDF</strong>' : 'HTML'}.
              </p>
              <div style="background:#EBF4FF;border:1px solid #BEE3F8;border-left:4px solid #3182CE;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 24px;">
                <p style="font-size:13px;font-weight:600;color:#2C5282;margin:0 0 10px;">Votre dossier contient :</p>
                ${['Resume executif','Porteur de projet','Etude de marche','Plan investissement et financement','Previsionnel financier 3 ans','Strategie commerciale','Analyse des risques'].map(s=>`<p style="margin:3px 0;font-size:13px;color:#2d3748;">✓ ${s}</p>`).join('')}
              </div>
              <p style="color:#718096;font-size:13px;">Pour toute question, repondez a cet email.<br><strong style="color:#1A3A5C;">L equipe PlanIA</strong></p>
            </div>
            <div style="padding:16px;border-top:1px solid #E2E8F0;text-align:center;font-size:11px;color:#A0AEC0;background:#F7FAFC;">
              PlanIA · Business Plan Professionnel · Document confidentiel
            </div>
          </div>
        `,
        attachments,
      });

      console.log(`Business plan simple envoye a ${clientEmail}`);
    }

    // Notification admin
    if (process.env.ADMIN_EMAIL) {
      await resend.emails.send({
        from: `PlanIA <${fromEmail}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `Nouvelle vente ${isPremium ? 'PREMIUM 200€' : 'SIMPLE 100€'} - ${formData.nomProjet}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;">
            <h2 style="color:${isPremium ? '#8B6914' : '#1A3A5C'};">💰 Nouvelle vente ${isPremium ? '⭐ PREMIUM' : 'Simple'} !</h2>
            <p>Projet : <strong>${formData.nomProjet}</strong></p>
            <p>Client : ${formData.prenom} ${formData.nom}</p>
            <p>Email : ${clientEmail}</p>
            <p>Montant : <strong>${isPremium ? '200' : '100'} EUR</strong></p>
          </div>
        `,
      });
    }

    return res.status(200).json({ success: true, offre: formData.offre });

  } catch (err) {
    console.error('Erreur webhook:', err);
    return res.status(200).json({ received: true, error: err.message });
  }
};
