// api/webhook.js
// Reçoit la confirmation de paiement Stripe
// → Génère le business plan avec Claude
// → Envoie le HTML par email via Resend
// → Notifie l'admin

const Stripe = require('stripe');
const Anthropic = require('@anthropic-ai/sdk');
const { Resend } = require('resend');
const { calcFinancials, fmt } = require('../lib/financials');
const { generateBusinessPlanHTML } = require('../lib/pdfTemplate');

// Désactive le body parser Vercel (Stripe a besoin du raw body pour valider la signature)
export const config = { api: { bodyParser: false } };

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

  // On traite uniquement les paiements confirmés
  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const meta = session.metadata || {};

  try {
    // ── 1. RECONSTITUER LES DONNÉES DU FORMULAIRE ──────────────────
    const dataStr = (meta.data1 || '') + (meta.data2 || '') + (meta.data3 || '') +
                    (meta.data4 || '') + (meta.data5 || '');
    let formData = {};
    try {
      formData = JSON.parse(dataStr);
    } catch(e) {
      // Si parsing échoue, utiliser les métadonnées basiques
      formData = {
        email: meta.email || session.customer_email,
        nomProjet: meta.nomProjet || 'Mon Projet',
        prenom: meta.prenom || '',
        nom: meta.nom || '',
      };
    }

    const clientEmail = formData.email || session.customer_email;
    console.log(`✅ Paiement confirmé pour: ${clientEmail} — Projet: ${formData.nomProjet}`);

    // ── 2. CALCULS FINANCIERS ───────────────────────────────────────
    const fin = calcFinancials(formData);

    // ── 3. GÉNÉRATION IA AVEC CLAUDE ────────────────────────────────
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const destLabels = {
      banque: 'Banque / Organisme de crédit',
      investisseur: 'Investisseur / Levée de fonds',
      subvention: 'Subvention / Association',
      personnel: 'Usage personnel',
    };

    const prompt = `Tu es un expert en création d'entreprise, stratégie et finance, spécialisé dans la rédaction de business plans destinés à des ${destLabels[formData.destinataire] || 'partenaires financiers'}.

À partir des données ci-dessous, rédige le contenu textuel complet d'un business plan professionnel de qualité cabinet conseil.

DONNÉES DU PROJET :
- Porteur : ${formData.prenom} ${formData.nom}
- Projet : ${formData.nomProjet}
- Secteur : ${formData.secteur}
- Forme juridique : ${formData.juridique}
- Ville : ${formData.ville}
- Lancement : ${formData.lancement || 'Non précisé'}
- Type : ${formData.typeActivite || 'Création'}
- Description : ${formData.description}
- Parcours porteur : ${formData.parcours}
- Clients cibles : ${formData.clients}
- Concurrents : ${formData.concurrents}
- Avantage concurrentiel : ${formData.avantage}
- Clients confirmés : ${formData.clientsConfirmes || 'Non renseigné'}
- Stratégie commerciale : ${formData.strategie || 'Non renseignée'}
- Risques identifiés : ${formData.risques || 'Non renseignés'}
- Salariés prévus : ${formData.salaries || 'Aucun'}
- Aides / subventions : ${formData.aides || 'Aucune'}
- Informations complémentaires : ${formData.extras || 'Aucune'}

DONNÉES FINANCIÈRES :
- CA An1/2/3 : ${fmt(fin.ca1)} / ${fmt(fin.ca2)} / ${fmt(fin.ca3)}
- Marge brute An1 : ${fmt(fin.mb1)} (${fin.tauxMVC}% du CA)
- EBE An1 : ${fmt(fin.ebe1)}
- Résultat net An1/2/3 : ${fmt(fin.rn1)} / ${fmt(fin.rn2)} / ${fmt(fin.rn3)}
- Seuil de rentabilité An1 : ${fmt(fin.sr1)}
- CAF An1 : ${fmt(fin.caf1)} vs remboursement : ${fmt(fin.remboAnnuel)}
- Investissements totaux : ${fmt(fin.totalInvest)}
- Financement : Apport ${fmt(fin.apport)} + Emprunt ${fmt(fin.capital)}

Rédige UNIQUEMENT les 6 sections suivantes avec ce format EXACT :

[SECTION:RESUME]
(Résumé exécutif : 4 paragraphes percutants. Synthèse du projet, opportunité marché, modèle économique, besoin de financement, chiffres clés. Minimum 200 mots.)
[/SECTION]

[SECTION:PORTEUR]
(Portrait du porteur : parcours, compétences clés, légitimité, expérience sectorielle. Minimum 150 mots.)
[/SECTION]

[SECTION:PROJET]
(Description détaillée : activité, offre, modèle économique, localisation, valeur ajoutée, roadmap. Minimum 200 mots.)
[/SECTION]

[SECTION:MARCHE]
(Étude de marché : taille et tendances du marché, segmentation client, analyse concurrentielle, positionnement. Minimum 200 mots.)
[/SECTION]

[SECTION:STRATEGIE]
(Stratégie commerciale : canaux d'acquisition, politique tarifaire, plan marketing, objectifs, organisation. Minimum 180 mots.)
[/SECTION]

[SECTION:RISQUES]
(5 risques. Format STRICT pour chaque ligne :
RISQUE: nom du risque | NIVEAU: Faible ou Modéré ou Élevé | MESURE: mesure corrective concrète
Une ligne par risque, séparées par un saut de ligne.)
[/SECTION]

Sois précis, professionnel et ancré dans les données fournies. Évite les généralités creuses.`;

    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const aiText = aiResponse.content[0]?.text || '';

    // Parser les sections
    function parseSection(text, key) {
      const re = new RegExp(`\\[SECTION:${key}\\]([\\s\\S]*?)\\[\\/SECTION\\]`);
      const m = text.match(re);
      return m ? m[1].trim() : '';
    }

    const aiSections = {
      resume:   parseSection(aiText, 'RESUME'),
      porteur:  parseSection(aiText, 'PORTEUR'),
      projet:   parseSection(aiText, 'PROJET'),
      marche:   parseSection(aiText, 'MARCHE'),
      strategie:parseSection(aiText, 'STRATEGIE'),
      risques:  parseSection(aiText, 'RISQUES'),
    };

    // ── 4. GÉNÉRATION DU HTML DU BUSINESS PLAN ──────────────────────
    const bpHTML = generateBusinessPlanHTML(formData, fin, aiSections);

    // ── 5. ENVOI EMAIL AU CLIENT ─────────────────────────────────────
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@plania.fr';

    await resend.emails.send({
      from: `PlanIA <${fromEmail}>`,
      to: clientEmail,
      subject: `✅ Votre business plan est prêt — ${formData.nomProjet}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
          <div style="background:#0E0F11;padding:32px;text-align:center;">
            <h1 style="color:#fff;font-size:24px;margin:0;font-weight:400;">Votre business plan est prêt</h1>
            <p style="color:rgba(255,255,255,.6);margin:8px 0 0;font-size:14px;">${formData.nomProjet}</p>
          </div>
          <div style="padding:32px;">
            <p style="font-size:16px;">Bonjour ${formData.prenom},</p>
            <p style="margin:16px 0;color:#555;line-height:1.7;">
              Votre business plan professionnel pour <strong>${formData.nomProjet}</strong> a été généré avec succès.
              Vous le trouverez en pièce jointe à cet email.
            </p>
            <div style="background:#F8F9FB;border:1px solid #E4E6EB;border-radius:8px;padding:20px;margin:20px 0;">
              <p style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#7A7F8E;margin:0 0 12px;">Votre document contient</p>
              <div style="display:grid;gap:6px;">
                ${['Résumé exécutif','Présentation du porteur','Étude de marché','Plan d\'investissement et financement','Prévisionnel financier 3 ans (compte de résultat, CAF, seuil de rentabilité)','Stratégie commerciale','Analyse des risques']
                  .map(s => `<p style="margin:0;font-size:14px;color:#333;">✓ ${s}</p>`).join('')}
              </div>
            </div>
            <p style="color:#555;line-height:1.7;font-size:14px;">
              Le fichier joint est au format HTML — ouvrez-le dans votre navigateur pour le consulter,
              ou utilisez <strong>Fichier → Imprimer → Enregistrer en PDF</strong> pour obtenir un PDF.
            </p>
            <p style="margin-top:24px;color:#555;font-size:14px;">
              Pour toute question : répondez directement à cet email.<br>
              <strong>L'équipe PlanIA</strong>
            </p>
          </div>
          <div style="padding:16px 32px;border-top:1px solid #E4E6EB;text-align:center;font-size:11px;color:#AAA;">
            PlanIA · Business Plan Professionnel IA · Document confidentiel
          </div>
        </div>
      `,
      attachments: [{
        filename: `BusinessPlan_${(formData.nomProjet || 'MonProjet').replace(/\s+/g, '_')}.html`,
        content: Buffer.from(bpHTML).toString('base64'),
      }],
    });

    console.log(`📧 Email envoyé à ${clientEmail}`);

    // ── 6. NOTIFICATION ADMIN ────────────────────────────────────────
    if (process.env.ADMIN_EMAIL) {
      await resend.emails.send({
        from: `PlanIA <${fromEmail}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `💰 Nouvelle vente — ${formData.nomProjet} — 100 €`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;color:#1a1a1a;">
            <h2 style="color:#166534;">💰 Nouvelle vente confirmée !</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:8px;color:#555;border-bottom:1px solid #eee;">Projet</td><td style="padding:8px;font-weight:600;border-bottom:1px solid #eee;">${formData.nomProjet}</td></tr>
              <tr><td style="padding:8px;color:#555;border-bottom:1px solid #eee;">Client</td><td style="padding:8px;border-bottom:1px solid #eee;">${formData.prenom} ${formData.nom}</td></tr>
              <tr><td style="padding:8px;color:#555;border-bottom:1px solid #eee;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;">${clientEmail}</td></tr>
              <tr><td style="padding:8px;color:#555;border-bottom:1px solid #eee;">Montant</td><td style="padding:8px;font-weight:600;color:#166534;border-bottom:1px solid #eee;">100,00 €</td></tr>
              <tr><td style="padding:8px;color:#555;">Session Stripe</td><td style="padding:8px;font-size:11px;font-family:monospace;">${session.id}</td></tr>
            </table>
          </div>
        `,
      });
    }

    return res.status(200).json({ success: true, message: 'Business plan envoyé' });

  } catch (err) {
    console.error('Erreur traitement webhook:', err);
    // On retourne 200 à Stripe même en cas d'erreur interne
    // pour éviter les retentatives en boucle
    return res.status(200).json({ received: true, error: err.message });
  }
};
