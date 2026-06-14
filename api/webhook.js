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

    // On génère une page HTML qui se convertit automatiquement en PDF
    // quand le client clique sur le lien dans l'email
    const htmlAvecAutoPrint = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Business Plan - ${formData.nomProjet}</title>
<style>
  @media print {
    .no-print { display: none !important; }
    body { margin: 0; }
  }
  .no-print {
    position: fixed;
    top: 0; left: 0; right: 0;
    background: #1A4A2E;
    color: white;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 9999;
    font-family: Arial, sans-serif;
    font-size: 14px;
  }
  .no-print button {
    background: white;
    color: #1A4A2E;
    border: none;
    padding: 10px 24px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
  .no-print button:hover { background: #f0f0f0; }
  body { padding-top: 60px; }
  @media print { body { padding-top: 0; } }
</style>
</head>
<body>

<!-- BARRE DE TÉLÉCHARGEMENT PDF (disparait à l'impression) -->
<div class="no-print">
  <span>📄 Votre business plan — ${formData.nomProjet}</span>
  <button onclick="downloadPDF()">⬇ Télécharger en PDF</button>
</div>

${bpHTML.replace('<!DOCTYPE html>', '').replace(/<html[^>]*>/, '').replace(/<\/html>/, '').replace(/<head>[\s\S]*?<\/head>/, '').replace(/<body>/, '').replace(/<\/body>/, '')}

<script>
function downloadPDF() {
  // Cache la barre de téléchargement
  document.querySelector('.no-print').style.display = 'none';
  // Lance l'impression (= enregistrer en PDF)
  window.print();
  // Reaffiche la barre après
  setTimeout(() => {
    document.querySelector('.no-print').style.display = 'flex';
  }, 1000);
}
// Lance automatiquement la boite de dialogue PDF à l'ouverture
window.onload = function() {
  setTimeout(() => {
    downloadPDF();
  }, 1500);
};
</script>
</body>
</html>`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    await resend.emails.send({
      from: `PlanIA <${fromEmail}>`,
      to: clientEmail,
      subject: `Votre business plan est pret - ${formData.nomProjet}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
          <div style="background:#1A4A2E;padding:32px;text-align:center;">
            <h1 style="color:#fff;font-size:24px;margin:0;">Votre business plan est pret !</h1>
            <p style="color:rgba(255,255,255,.7);margin:8px 0 0;font-size:14px;">${formData.nomProjet}</p>
          </div>
          <div style="padding:32px;">
            <p style="font-size:16px;">Bonjour ${formData.prenom},</p>
            <p style="margin:16px 0;color:#555;line-height:1.7;">
              Votre business plan professionnel pour <strong>${formData.nomProjet}</strong> est pret.
              Cliquez sur le bouton ci-dessous pour le telecharger en PDF.
            </p>

            <div style="text-align:center;margin:32px 0;">
              <p style="color:#555;font-size:13px;margin-bottom:8px;">
                Le document s ouvre dans votre navigateur et se telecharge automatiquement en PDF.
              </p>
            </div>

            <div style="background:#EBF4EE;border:1px solid #C8E6C9;border-radius:8px;padding:20px;margin:20px 0;">
              <p style="font-size:13px;font-weight:600;color:#1A4A2E;margin:0 0 10px;">Votre dossier contient :</p>
              ${['Resume executif','Presentation du porteur','Etude de marche',
                'Plan investissement et financement','Previsionnel financier 3 ans',
                'Strategie commerciale','Analyse des risques']
                .map(s => `<p style="margin:4px 0;font-size:13px;color:#333;">✓ ${s}</p>`).join('')}
            </div>

            <div style="background:#F8F9FB;border:1px solid #E4E6EB;border-radius:8px;padding:16px;margin:20px 0;">
              <p style="margin:0;font-size:13px;color:#555;">
                <strong>Comment sauvegarder en PDF :</strong><br><br>
                1. Le document s ouvre dans votre navigateur<br>
                2. La fenetre d impression apparait automatiquement<br>
                3. Dans destination selectionnez <strong>Enregistrer en PDF</strong><br>
                4. Cliquez <strong>Enregistrer</strong>
              </p>
            </div>

            <p style="margin-top:24px;color:#555;font-size:13px;line-height:1.7;">
              Le fichier HTML est egalement en piece jointe si vous preferez.<br><br>
              Pour toute question, repondez a cet email.<br>
              <strong>L equipe PlanIA</strong>
            </p>
          </div>
          <div style="padding:16px;border-top:1px solid #E4E6EB;text-align:center;font-size:11px;color:#AAA;">
            PlanIA - Business Plan Professionnel - Document confidentiel
          </div>
        </div>
      `,
      // On envoie le HTML avec auto-print en pièce jointe
      attachments: [{
        filename: `BusinessPlan_${nomFichier}.html`,
        content: Buffer.from(htmlAvecAutoPrint).toString('base64'),
      }],
    });

    console.log(`Email envoye a ${clientEmail}`);

    if (process.env.ADMIN_EMAIL) {
      await resend.emails.send({
        from: `PlanIA <${fromEmail}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `Nouvelle vente - ${formData.nomProjet} - 100 EUR`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;">
            <h2 style="color:#1A4A2E;">Nouvelle vente !</h2>
            <p>Projet : <strong>${formData.nomProjet}</strong></p>
            <p>Client : ${formData.prenom} ${formData.nom}</p>
            <p>Email : ${clientEmail}</p>
            <p>Montant : <strong>100 EUR</strong></p>
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
