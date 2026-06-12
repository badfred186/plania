// api/create-checkout.js
// Crée une session de paiement Stripe et stocke les données du formulaire

const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  // CORS
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

    // Encode les données dans les metadata Stripe (limite 500 chars par valeur)
    // On découpe en chunks si nécessaire
    const dataStr = JSON.stringify(formData);
    const chunk1 = dataStr.substring(0, 490);
    const chunk2 = dataStr.substring(490, 980);
    const chunk3 = dataStr.substring(980, 1470);
    const chunk4 = dataStr.substring(1470, 1960);
    const chunk5 = dataStr.substring(1960);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: 10000, // 100€ en centimes
          product_data: {
            name: 'Business Plan Professionnel IA',
            description: `Business plan complet pour : ${formData.nomProjet} — Livraison immédiate par email`,
            images: [],
          },
        },
        quantity: 1,
      }],
      customer_email: formData.email,
      metadata: {
        data1: chunk1,
        data2: chunk2,
        data3: chunk3,
        data4: chunk4,
        data5: chunk5,
        email: formData.email,
        nomProjet: formData.nomProjet.substring(0, 100),
        prenom: (formData.prenom || '').substring(0, 50),
        nom: (formData.nom || '').substring(0, 50),
      },
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cancel.html`,
      locale: 'fr',
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });

  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: err.message });
  }
};
