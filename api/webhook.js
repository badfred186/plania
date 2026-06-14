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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
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
(Resume executif : 4 paragraphes. Minimum 200 mots.)
[/SECTION]

[SECTION:PORTEUR]
(Portrait du porteur. Minimum 150 mots.)
[/SECTION]

[SECTION:PROJET]
(Description detaillee du projet. Minimum 200 mots.)
[/SECTION]

[SECTION:MARCHE]
(Etude de marche. Minimum 200 mots.)
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
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    await resend.emails.send({
      from: `PlanIA <${fromEmail}>`,
      to: clientEmail,
      subject: `Votre business plan est pret - ${formData.nomProjet}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
          <div style="background:#0E0F11;padding:32px;text-align:center;">
            <h1 style="color:#fff;font-size:24px;margin:0;">Votre business plan est pret</h1>
            <p style="color:rgba(255,255,255,.6);margin:8px 0 0;font-size:14px;">${formData.nomProjet}</p>
          </div>
          <div style="padding:32px;">
            <p style="font-size:16px;">Bonjour ${formData.prenom},</p>
            <p style="margin:16px 0;color:#555;line-height:1.7;">
              Votre business plan pour <strong>${formData.nomProjet}</strong> est en piece jointe.
            </p>
            <p style="color:#555;line-height:1.7;font-size:14px;">
              Ouvrez le fichier HTML dans votre navigateur, puis faites
              <strong>Fichier -> Imprimer -> Enregistrer en PDF</strong>.
            </p>
            <p style="margin-top:24px;color:#555;font-size:14px;">
              L'equipe PlanIA
            </p>
          </div>
        </div>
      `,
      attachments: [{
        filename: `BusinessPlan_${(formData.nomProjet || 'MonProjet').replace(/\s+/g, '_')}.html`,
        content: Buffer.from(bpHTML).toString('base64'),
      }],
    });

    console.log(`Email envoye a ${clientEmail}`);

    if (process.env.ADMIN_EMAIL) {
      await resend.emails.send({
        from: `PlanIA <${fromEmail}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `Nouvelle vente - ${formData.nomProjet} - 100 EUR`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;color:#1a1a1a;">
            <h2 style="color:#166534;">Nouvelle vente confirmee !</h2>
            <p>Projet : <strong>${formData.nomProjet}</strong></p>
            <p>Client : ${formData.prenom} ${formData.nom}</p>
            <p>Email : ${clientEmail}</p>
            <p>Montant : <strong>100,00 EUR</strong></p>
          </div>
        `,
      });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Erreur webhook:', err);
    return res.status(200).json({ received: true, error: err.message });
  }
};
