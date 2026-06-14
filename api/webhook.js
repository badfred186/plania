// api/webhook.js
const Stripe = require('stripe');
const Anthropic = require('@anthropic-ai/sdk');
const { Resend } = require('resend');
const { calcFinancials, fmt } = require('../lib/financials');
const { generateBusinessPlanHTML } = require('../lib/pdfTemplate');

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function convertToPDF(htmlContent) {
  try {
    console.log('Conversion PDF via pdf.co...');

    // Étape 1 : Upload le HTML sur pdf.co
    const uploadResponse = await fetch('https://api.pdf.co/v1/file/upload/base64', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.PDFCO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'business-plan.html',
        file: Buffer.from(htmlContent).toString('base64'),
      }),
    });

    const uploadData = await uploadResponse.json();
    if (!uploadData.url) throw new Error('Upload échoué: ' + JSON.stringify(uploadData));
    console.log('HTML uploadé:', uploadData.url);

    // Étape 2 : Convertir en PDF
    const convertResponse = await fetch('https://api.pdf.co/v1/pdf/convert/from/html', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.PDFCO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: uploadData.url,
        paperSize: 'A4',
        orientation: 'Portrait',
        printBackground: true,
        margins: '10mm 10mm 10mm 10mm',
        async: false,
      }),
    });

    const convertData = await convertResponse.json();
    if (!convertData.url) throw new Error('Conversion échouée: ' + JSON.stringify(convertData));
    console.log('PDF généré:', convertData.url);

    // Étape 3 : Télécharger le PDF
    const pdfResponse = await fetch(convertData.url);
    const pdfBuffer = await pdfResponse.arrayBuffer();
    console.log('PDF téléchargé - taille:', pdfBuffer.byteLength);

    return Buffer.from(pdfBuffer);

  } catch (err) {
    console.error('Erreur PDF.co:', err.message);
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
    const dataStr = (meta.data1 || '') + (meta.data2 || '') + (meta.data3 || '') +
                    (meta.data4 || '') + (meta.data5 || '');
    let formData = {};
    try {
      formData = JSON.parse(dataStr);
    } catch(e) {
      formData = {
        email: meta.email || session.customer_email,
        nomProjet: meta.nomProjet || 'Mon Projet',
        prenom: meta.prenom || '',
        nom: meta.nom || '',
      };
    }

    const clientEmail = formData.email || session.customer_email;
    console.log(`Paiement confirme pour: ${clientEmail} - Projet: ${formData.nomProjet}`);

    const fin = calcFinancials(formData);
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const destLabels = {
      banque: 'Banque / Organisme de credit',
      investisseur: 'Investisseur / Levee de fonds',
      subvention: 'Subvention / Association',
      personnel: 'Usage personnel',
    };

    const prompt = `Tu es un expert en creation d'entreprise, strategie et finance, specialise dans la redaction de business plans destines a des ${destLabels[formData.destinataire] || 'partenaires financiers'}.

A partir des donnees ci-dessous, redige le contenu textuel complet d'un business plan professionnel de qualite cabinet conseil.

DONNEES DU PROJET :
- Porteur : ${formData.prenom} ${formData.nom}
- Projet : ${formData.nomProjet}
- Secteur : ${formData.secteur}
- Forme juridique : ${formData.juridique}
- Ville : ${formData.ville}
- Lancement : ${formData.lancement || 'Non precise'}
- Description : ${formData.description}
- Parcours porteur : ${formData.parcours}
- Clients cibles : ${formData.clients}
- Concurrents : ${formData.concurrents}
- Avantage concurrentiel : ${formData.avantage}
- Strategie commerciale : ${formData.strategie || 'Non renseignee'}
- Risques identifies : ${formData.risques || 'Non renseignes'}
- Aides / subventions : ${formData.aides || 'Aucune'}

DONNEES FINANCIERES :
- CA An1/2/3 : ${fmt(fin.ca1)} / ${fmt(fin.ca2)} / ${fmt(fin.ca3)}
- Marge brute An1 : ${fmt(fin.mb1)} (${fin.tauxMVC}% du CA)
- Resultat net An1/2/3 : ${fmt(fin.rn1)} / ${fmt(fin.rn2)} / ${fmt(fin.rn3)}
- Seuil de rentabilite An1 : ${fmt(fin.sr1)}
- Investissements totaux : ${fmt(fin.totalInvest)}
- Financement : Apport ${fmt(fin.apport)} + Emprunt ${fmt(fin.capital)}

Redige UNIQUEMENT les 6 sections suivantes :

[SECTION:RESUME]
(Resume executif : 4 paragraphes percutants. Minimum 200 mots.)
[/SECTION]

[SECTION:PORTEUR]
(Portrait du porteur : parcours, competences, legitimite. Minimum 150 mots.)
[/SECTION]

[SECTION:PROJET]
(Description detaillee du projet. Minimum 200 mots.)
[/SECTION]

[SECTION:MARCHE]
(Etude de marche complete. Minimum 200 mots.)
[/SECTION]

[SECTION:STRATEGIE]
(Strategie commerciale. Minimum 180 mots.)
[/SECTION]

[SECTION:RISQUES]
(5 risques format : RISQUE: nom | NIVEAU: Faible ou Modere ou Eleve | MESURE: mesure corrective)
[/SECTION]`;

    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const aiText = aiResponse.content[0]?.text || '';

    function parseSection(text, key) {
      const re = new RegExp(`\\[SECTION:${key}\\]([\\s\\S]*?)\\[\\/SECTION\\]`);
      const m = text.match(re);
      return m ? m[1].trim() : '';
    }

    const aiSections = {
      resume:    parseSection(aiText, 'RESUME'),
      porteur:   parseSection(aiText, 'PORTEUR'),
      projet:    parseSection(aiText, 'PROJET'),
      marche:    parseSection(aiText, 'MARCHE'),
      strategie: parseSection(aiText, 'STRATEGIE'),
      risques:   parseSection(aiText, 'RISQUES'),
    };

    const bpHTML = generateBusinessPlanHTML(formData, fin, aiSections);
    const nomFichier = (formData.nomProjet || 'MonProjet').replace(/\s+/g, '_');

    // Conversion PDF via pdf.co
    const pdfBuffer = await convertToPDF(bpHTML);
    const isPDF = pdfBuffer && pdfBuffer.length > 1000;
    console.log('Format final:', isPDF ? 'PDF' : 'HTML');

    const attachments = isPDF
      ? [{ filename: `BusinessPlan_${nomFichier}.pdf`, content: pdfBuffer.toString('base64') }]
      : [{ filename: `BusinessPlan_${nomFichier}.html`, content: Buffer.from(bpHTML).toString('base64') }];

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

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
              Votre business plan professionnel pour <strong>${formData.nomProjet}</strong>
              est pret. Vous le trouverez en piece jointe au format <strong>${isPDF ? 'PDF' : 'HTML'}</strong>.
            </p>
            <div style="background:#EBF4FF;border:1px solid #BEE3F8;border-left:4px solid #3182CE;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 24px;">
              <p style="font-size:13px;font-weight:600;color:#2C5282;margin:0 0 10px;">Votre dossier contient :</p>
              ${['Resume executif','Porteur de projet','Etude de marche',
                'Plan investissement et financement','Previsionnel financier 3 ans',
                'Strategie commerciale','Analyse des risques']
                .map(s => `<p style="margin:3px 0;font-size:13px;color:#2d3748;">✓ ${s}</p>`).join('')}
            </div>
            <p style="color:#718096;font-size:13px;line-height:1.7;margin:0;">
              Pour toute question, repondez a cet email.<br>
              <strong style="color:#1A3A5C;">L equipe PlanIA</strong>
            </p>
          </div>
          <div style="padding:16px 32px;border-top:1px solid #E2E8F0;text-align:center;font-size:11px;color:#A0AEC0;background:#F7FAFC;">
            PlanIA · Business Plan Professionnel · Document confidentiel
          </div>
        </div>
      `,
      attachments,
    });

    console.log(`Email envoye a ${clientEmail} - Format: ${isPDF ? 'PDF' : 'HTML'}`);

    if (process.env.ADMIN_EMAIL) {
      await resend.emails.send({
        from: `PlanIA <${fromEmail}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `Nouvelle vente - ${formData.nomProjet} - 100 EUR`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;">
            <h2 style="color:#1A3A5C;font-family:Georgia,serif;">Nouvelle vente !</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">
              <tr><td style="padding:8px;color:#718096;border-bottom:1px solid #E2E8F0;">Projet</td><td style="padding:8px;font-weight:600;border-bottom:1px solid #E2E8F0;">${formData.nomProjet}</td></tr>
              <tr><td style="padding:8px;color:#718096;border-bottom:1px solid #E2E8F0;">Client</td><td style="padding:8px;border-bottom:1px solid #E2E8F0;">${formData.prenom} ${formData.nom}</td></tr>
              <tr><td style="padding:8px;color:#718096;border-bottom:1px solid #E2E8F0;">Email</td><td style="padding:8px;border-bottom:1px solid #E2E8F0;">${clientEmail}</td></tr>
              <tr><td style="padding:8px;color:#718096;border-bottom:1px solid #E2E8F0;">Montant</td><td style="padding:8px;font-weight:600;color:#276749;border-bottom:1px solid #E2E8F0;">100,00 EUR</td></tr>
              <tr><td style="padding:8px;color:#718096;">Format</td><td style="padding:8px;font-weight:600;">${isPDF ? 'PDF' : 'HTML'}</td></tr>
            </table>
          </div>
        `,
      });
    }

    return res.status(200).json({ success: true, format: isPDF ? 'pdf' : 'html' });

  } catch (err) {
    console.error('Erreur webhook:', err);
    return res.status(200).json({ received: true, error: err.message });
  }
};
