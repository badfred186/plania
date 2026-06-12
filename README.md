# 🚀 PlanIA — Guide d'installation complet
## De zéro à en ligne en moins de 2 heures

---

## 📁 Structure du projet

```
planIA/
├── api/
│   ├── create-checkout.js    ← Crée la session de paiement Stripe
│   └── webhook.js            ← Reçoit paiement → génère plan → envoie email
├── lib/
│   ├── financials.js         ← Calculs financiers automatiques
│   └── pdfTemplate.js        ← Template HTML du business plan
├── public/
│   ├── index.html            ← Site web complet (landing + formulaire)
│   ├── success.html          ← Page de retour après paiement
│   └── cancel.html           ← Page si paiement annulé
├── package.json
├── vercel.json
└── .env.example              ← Template des variables d'environnement
```

---

## ÉTAPE 1 — Créer les 4 comptes (30 min)

### 1.1 GitHub (pour héberger le code)
1. Va sur **github.com** → "Sign up"
2. Crée un compte gratuit
3. Crée un nouveau repository : "plania" (public ou privé, au choix)

### 1.2 Vercel (hébergement gratuit)
1. Va sur **vercel.com** → "Sign up with GitHub"
2. Connecte ton compte GitHub
3. Clique "Add New Project"

### 1.3 Stripe (paiement)
1. Va sur **stripe.com** → "Commencer"
2. Remplis le formulaire d'inscription
3. Active le mode **Test** pour commencer (interrupteur en haut à droite)

### 1.4 Resend (emails)
1. Va sur **resend.com** → "Sign up"
2. Crée un compte avec ton email
3. Va dans **API Keys** → "Create API Key" → copie la clé

---

## ÉTAPE 2 — Mettre le code sur GitHub (15 min)

### Option A : Via l'interface GitHub (le plus simple)
1. Dans ton repository GitHub → clique "uploading an existing file"
2. Glisse-dépose tous les fichiers du projet
3. Respecte la structure des dossiers (api/, lib/, public/)
4. Clique "Commit changes"

### Option B : Via Git (si tu as Git installé)
```bash
cd planIA
git init
git add .
git commit -m "Premier commit PlanIA"
git remote add origin https://github.com/TON_USERNAME/plania.git
git push -u origin main
```

---

## ÉTAPE 3 — Déployer sur Vercel (10 min)

1. Sur **vercel.com** → "Add New Project"
2. Sélectionne ton repository GitHub "plania"
3. Clique "Deploy" — Vercel détecte automatiquement la configuration
4. Attend 1-2 minutes → tu obtiens une URL : `https://plania-xxx.vercel.app`
5. **Note cette URL** — c'est l'adresse de ton site

---

## ÉTAPE 4 — Configurer les variables d'environnement (20 min)

### 4.1 Récupérer les clés

**Stripe :**
1. Dashboard Stripe → Développeurs → Clés API
2. Copie la **Clé secrète** (commence par `sk_test_` ou `sk_live_`)

**Anthropic :**
1. Va sur **console.anthropic.com**
2. API Keys → Create Key → copie la clé (`sk-ant-api03-...`)

**Resend :**
1. Dashboard Resend → API Keys → copie la clé (`re_...`)

### 4.2 Ajouter les variables dans Vercel
1. Dashboard Vercel → ton projet → **Settings** → **Environment Variables**
2. Ajoute ces variables une par une :

| Nom | Valeur |
|-----|--------|
| `STRIPE_SECRET_KEY` | `sk_test_XXXXXXXX` (ta clé Stripe) |
| `STRIPE_WEBHOOK_SECRET` | (voir étape suivante) |
| `ANTHROPIC_API_KEY` | `sk-ant-api03-XXXXXXXX` |
| `RESEND_API_KEY` | `re_XXXXXXXX` |
| `RESEND_FROM_EMAIL` | `noreply@plania.vercel.app` (ou ton domaine) |
| `ADMIN_EMAIL` | `tonemail@gmail.com` |
| `NEXT_PUBLIC_SITE_URL` | `https://plania-xxx.vercel.app` |

3. Clique "Save" pour chaque variable

---

## ÉTAPE 5 — Configurer le Webhook Stripe (15 min)

Le webhook est essentiel — c'est lui qui déclenche la génération du business plan après paiement.

1. Dashboard Stripe → **Développeurs** → **Webhooks** → "Ajouter un endpoint"
2. URL de l'endpoint : `https://plania-xxx.vercel.app/api/webhook`
3. Sélectionner les événements : coche **`checkout.session.completed`**
4. Clique "Ajouter l'endpoint"
5. Stripe affiche le **Secret de signature** (commence par `whsec_...`)
6. Copie ce secret
7. Retourne dans Vercel → Settings → Environment Variables
8. Ajoute `STRIPE_WEBHOOK_SECRET` = `whsec_XXXXXXXX`
9. **Redéploie** : Vercel → ton projet → Deployments → "Redeploy"

---

## ÉTAPE 6 — Tester en mode Test (20 min)

### Test du formulaire
1. Ouvre ton site : `https://plania-xxx.vercel.app`
2. Remplis le formulaire complet (6 étapes)
3. Sur la page de paiement, clique "Payer"

### Test du paiement Stripe
Utilise la carte de test Stripe :
- **Numéro** : `4242 4242 4242 4242`
- **Date** : n'importe quelle date future (ex: 12/34)
- **CVC** : `123`

### Vérifier que tout fonctionne
1. Le paiement est confirmé → tu es redirigé vers l'écran de succès ✓
2. Tu reçois l'email de notification (ton ADMIN_EMAIL) ✓
3. Le client (l'email du formulaire) reçoit le business plan en pièce jointe ✓
4. Dashboard Stripe → Paiements → la transaction apparaît ✓

---

## ÉTAPE 7 — Passer en mode LIVE (5 min)

Quand tu es prêt à encaisser de vrais paiements :

1. Dashboard Stripe → désactive le mode Test (interrupteur en haut)
2. Récupère la **vraie clé secrète** (`sk_live_...`)
3. Crée un **vrai webhook** avec l'URL de ton site (refais l'étape 5 en mode Live)
4. Dans Vercel → Settings → Environment Variables → mets à jour :
   - `STRIPE_SECRET_KEY` = `sk_live_XXXXXXXXX`
   - `STRIPE_WEBHOOK_SECRET` = `whsec_XXXXXXXXX` (le nouveau secret Live)
5. Redéploie

---

## ÉTAPE 8 — Configurer l'envoi email (optionnel mais recommandé)

Pour envoyer depuis votre propre domaine (ex: noreply@monsite.fr) :

**Si tu as un domaine :**
1. Resend → **Domains** → "Add Domain"
2. Entre ton domaine (ex: `monsite.fr`)
3. Resend te donne des enregistrements DNS à ajouter chez ton registrar
4. Une fois vérifié, change `RESEND_FROM_EMAIL` en `noreply@monsite.fr`

**Si tu n'as pas de domaine encore :**
- Utilise `onboarding@resend.dev` pour les tests
- Pour la production, il faut absolument un domaine vérifié

---

## 💡 Conseils pour la mise en production

### Domaine personnalisé
1. Achète un domaine sur **OVH** (5-15€/an) ou **Namecheap**
2. Dans Vercel → Settings → Domains → ajoute ton domaine
3. Suis les instructions pour pointer les DNS vers Vercel

### Améliorer la délivrabilité des emails
1. Vérifie ton domaine dans Resend (SPF + DKIM)
2. Évite les mots spam dans l'objet des emails

### Suivre tes ventes
- Dashboard Stripe → Paiements (chiffre d'affaires en temps réel)
- Dashboard Resend → Emails (suivi des livraisons)

---

## 🔧 Résolution des problèmes courants

| Problème | Solution |
|---------|----------|
| Le business plan n'arrive pas par email | Vérifie le dossier spam + vérifier les logs Vercel |
| Erreur 401 sur l'API Claude | Clé API incorrecte dans les variables Vercel |
| Webhook Stripe ne se déclenche pas | Vérifie l'URL du webhook et le secret `STRIPE_WEBHOOK_SECRET` |
| Erreur lors du paiement | Vérifie que `STRIPE_SECRET_KEY` est correct et en mode Live |
| Email Resend non livré | Domaine non vérifié — utilise `onboarding@resend.dev` pour tester |

---

## 📞 Support

Pour toute question : **Fmrprod95@gmail.com**

---

## 💰 Coûts mensuels en production

| Service | Coût |
|---------|------|
| Vercel | Gratuit |
| Stripe | 1,5% + 0,25€ par vente |
| API Claude | ~0,80€ par plan généré |
| Resend | Gratuit jusqu'à 3 000 emails/mois |
| **Total pour 50 ventes** | **~90€ de frais → 4 910€ net** |
