// api/create-checkout.js
const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const formData = req.body;

    if (!formData || !formData.email || !formData.nomProjet) {
      return res.status(400).json({ error: 'Données manquantes' });
    }

    const isPremium = formData.offre === 'premium';
    const prix = isPremium ? 20000 : 10000; // centimes
    const nomProduit = isPremium
      ? 'Pack Premium — Excel + 2 PDF Professionnels'
      : 'Business Plan Professionnel — PDF Complet';
    const descProduit = isPremium
      ? `Fichier Excel financier + PDF Présentation + PDF Étude de marché — ${formData.nomProjet}`
      : `Business plan complet 8 sections — ${formData.nomProjet}`;

    // Découpage des données en chunks (limite 500 chars/metadata Stripe)
    const dataStr = JSON.stringify(formData);
    const chunkSize = 490;
    const chunks = {};
    for (let i = 0; i < 5; i++) {
      chunks[`data${i+1}`] = dataStr.substring(i * chunkSize, (i+1) * chunkSize);
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: prix,
          product_data: {
            name: nomProduit,
            description: descProduit,
          },
        },
        quantity: 1,
      }],
      customer_email: formData.email,
      metadata: {
        ...chunks,
        email: formData.email,
        nomProjet: (formData.nomProjet || '').substring(0, 100),
        prenom: (formData.prenom || '').substring(0, 50),
        nom: (formData.nom || '').substring(0, 50),
        offre: formData.offre || 'simple',
      },
      success_url: `${siteUrl}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/`,
      locale: 'fr',
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });

  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: err.message });
  }
};
