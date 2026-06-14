// lib/pdfTemplate.js
const { fmt } = require('./financials');

function generateBusinessPlanHTML(data, fin, aiSections) {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const destLabels = {
    banque: 'Banque / Organisme de crédit',
    investisseur: 'Investisseur / Levée de fonds',
    subvention: 'Subvention / Association',
    personnel: 'Usage personnel / Comptable',
  };

  function cleanText(text) {
    if (!text) return '';
    // Nettoie les ** markdown
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  function section(text) {
    if (!text) return '<p style="color:#999;font-style:italic;font-size:13px;">Section en cours de génération.</p>';
    return text.split('\n').filter(l => l.trim()).map(line => {
      // Risques
      if (line.includes('RISQUE:') || line.includes('**RISQUE:**')) {
        const cleaned = line.replace(/\*\*/g, '');
        const parts = cleaned.split('|');
        const risque = (parts[0] || '').replace('RISQUE:', '').trim();
        const niveau = (parts[1] || '').replace('NIVEAU:', '').trim();
        const mesure = (parts[2] || '').replace('MESURE:', '').trim();
        const niveauColors = {
          'Élevé':  { bg: '#FFF0F0', border: '#E53E3E', badge: '#E53E3E', text: '#fff' },
          'Modéré': { bg: '#FFFBEB', border: '#D69E2E', badge: '#D69E2E', text: '#fff' },
          'Faible': { bg: '#F0FFF4', border: '#38A169', badge: '#38A169', text: '#fff' },
        };
        const c = niveauColors[niveau] || { bg: '#F7FAFC', border: '#718096', badge: '#718096', text: '#fff' };
        return `
          <div style="background:${c.bg};border-left:4px solid ${c.border};border-radius:0 8px 8px 0;padding:14px 18px;margin:10px 0;display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <span style="font-weight:700;color:#1a1a2e;font-size:14px;">${risque}</span>
              <span style="background:${c.badge};color:${c.text};font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.06em;text-transform:uppercase;">${niveau}</span>
            </div>
            <div style="color:#4a5568;font-size:13px;line-height:1.6;">
              <span style="color:${c.border};font-weight:600;">→ </span>${mesure}
            </div>
          </div>`;
      }
      // Titres markdown
      if (line.startsWith('# ')) return `<h2 style="font-family:'Playfair Display',serif;font-size:18px;color:#1a1a2e;margin:20px 0 8px;font-weight:600;">${line.replace('# ','')}</h2>`;
      if (line.startsWith('## ')) return `<h3 style="font-size:15px;color:#2d3748;font-weight:600;margin:14px 0 6px;">${line.replace('## ','')}</h3>`;
      // Nettoyage markdown bold
      const cleaned = cleanText(line);
      return `<p style="margin:6px 0;line-height:1.8;color:#2d3748;font-size:13.5px;">${cleaned}</p>`;
    }).join('');
  }

  const accentColor = '#1A3A5C';   // Bleu marine foncé
  const accentLight = '#EBF4FF';   // Bleu très clair
  const gold        = '#C8973A';   // Or foncé
  const goldLight   = '#FFF8EC';   // Or très clair

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Business Plan — ${data.nomProjet || 'Mon Projet'}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', Arial, sans-serif; background: #fff; color: #2d3748; font-size: 14px; line-height: 1.6; }

@media print {
  .no-print { display: none !important; }
  .page-break { page-break-before: always; }
  body { font-size: 11pt; }
  .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .section-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .kpi-card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table thead { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}

/* ── BARRE DE TÉLÉCHARGEMENT ── */
.download-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
  background: linear-gradient(135deg, #1A3A5C, #2C5282);
  color: white; padding: 12px 28px;
  display: flex; align-items: center; justify-content: space-between;
  box-shadow: 0 2px 20px rgba(0,0,0,.2);
  font-family: 'Inter', sans-serif;
}
.download-bar-title { font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 10px; }
.download-bar-title span { background: rgba(255,255,255,.15); padding: 3px 10px; border-radius: 20px; font-size: 12px; }
.dl-btn {
  background: #C8973A; color: white; border: none;
  padding: 10px 24px; border-radius: 8px;
  font-size: 13px; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; gap: 8px;
  transition: background .2s;
  font-family: 'Inter', sans-serif;
}
.dl-btn:hover { background: #B8872A; }
body { padding-top: 62px; }
@media print { body { padding-top: 0; } }

/* ── COUVERTURE ── */
.cover {
  background: linear-gradient(160deg, #0F2540 0%, #1A3A5C 50%, #0D1F35 100%);
  padding: 60px 56px 50px;
  position: relative; overflow: hidden;
}
.cover::before {
  content: '';
  position: absolute; top: -60px; right: -60px;
  width: 300px; height: 300px;
  background: radial-gradient(circle, rgba(200,151,58,.25) 0%, transparent 70%);
  border-radius: 50%;
}
.cover::after {
  content: '';
  position: absolute; bottom: -40px; left: -40px;
  width: 200px; height: 200px;
  background: radial-gradient(circle, rgba(255,255,255,.05) 0%, transparent 70%);
  border-radius: 50%;
}
.cover-label {
  font-size: 11px; font-weight: 600; letter-spacing: .2em;
  text-transform: uppercase; color: #C8973A;
  margin-bottom: 24px;
  display: flex; align-items: center; gap: 12px;
}
.cover-label::after { content: ''; display: block; height: 1px; width: 60px; background: #C8973A; }
.cover-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 44px; font-weight: 700; color: #fff;
  line-height: 1.15; margin-bottom: 8px;
  letter-spacing: -.01em;
}
.cover-subtitle {
  font-size: 17px; color: rgba(255,255,255,.6);
  margin-bottom: 48px; font-weight: 300;
}
.cover-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 1px; background: rgba(255,255,255,.08);
  border-radius: 12px; overflow: hidden;
  max-width: 600px;
}
.cover-item {
  background: rgba(255,255,255,.05);
  padding: 14px 18px;
}
.cover-item-label {
  font-size: 10px; font-weight: 600;
  letter-spacing: .1em; text-transform: uppercase;
  color: rgba(255,255,255,.4); margin-bottom: 4px;
}
.cover-item-value {
  font-size: 14px; font-weight: 500; color: #fff;
}

/* ── KPIs ── */
.kpi-section {
  padding: 0 56px;
  margin-top: -1px;
  background: #F7FAFC;
  border-bottom: 1px solid #E2E8F0;
}
.kpi-row {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 0;
}
.kpi-card {
  padding: 22px 20px;
  border-right: 1px solid #E2E8F0;
  background: #fff;
}
.kpi-card:last-child { border-right: none; }
.kpi-label {
  font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: .1em;
  color: #718096; margin-bottom: 6px;
}
.kpi-value {
  font-family: 'Playfair Display', serif;
  font-size: 22px; font-weight: 700;
  color: #1A3A5C; line-height: 1;
}
.kpi-sub { font-size: 11px; color: #A0AEC0; margin-top: 4px; }
.kpi-value.positive { color: #276749; }

/* ── BODY ── */
.body { padding: 44px 56px; }

/* ── SECTIONS ── */
.bp-section { margin-bottom: 44px; }
.section-header {
  display: flex; align-items: center; gap: 16px;
  margin-bottom: 22px;
  padding-bottom: 14px;
  border-bottom: 2px solid #EDF2F7;
  position: relative;
}
.section-header::after {
  content: '';
  position: absolute; bottom: -2px; left: 0;
  width: 60px; height: 2px;
  background: #C8973A;
}
.section-num {
  width: 36px; height: 36px; border-radius: 10px;
  background: linear-gradient(135deg, #1A3A5C, #2C5282);
  color: #fff; font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-family: 'Inter', sans-serif;
}
.section-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 22px; font-weight: 600; color: #1A3A5C;
  letter-spacing: -.01em;
}

/* ── CALLOUT ── */
.callout {
  background: #EBF4FF;
  border: 1px solid #BEE3F8;
  border-left: 4px solid #3182CE;
  border-radius: 0 8px 8px 0;
  padding: 14px 18px;
  font-size: 13px; color: #2C5282;
  line-height: 1.65; margin: 14px 0;
}

/* ── TABLES ── */
table { width: 100%; border-collapse: collapse; margin: 14px 0 22px; font-size: 13px; }
thead tr { background: linear-gradient(135deg, #1A3A5C, #2C5282); }
thead th { color: #fff; padding: 11px 14px; text-align: left; font-weight: 600; font-size: 12px; letter-spacing: .03em; }
tbody tr { border-bottom: 1px solid #EDF2F7; transition: background .1s; }
tbody tr:nth-child(even) { background: #F7FAFC; }
tbody tr:hover { background: #EBF4FF; }
tbody td { padding: 10px 14px; color: #4a5568; }
.total-row td { background: ${goldLight} !important; font-weight: 700; color: #1A3A5C; border-top: 2px solid ${gold}; font-size: 13px; }
.head-row td { background: #EDF2F7 !important; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #4a5568; }
.positive-row td { background: #F0FFF4 !important; color: #276749; font-weight: 700; }
.num { text-align: right; font-family: 'Inter', monospace; font-size: 12px; }

/* ── SUBSECTION ── */
.sub-title {
  font-size: 12px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .1em;
  color: #1A3A5C; margin: 22px 0 10px;
  padding-left: 12px;
  border-left: 3px solid #C8973A;
}

/* ── FOOTER ── */
.doc-footer {
  text-align: center; padding: 28px 56px;
  border-top: 1px solid #EDF2F7;
  font-size: 11px; color: #A0AEC0;
  background: #F7FAFC;
  display: flex; align-items: center; justify-content: space-between;
}
.footer-logo {
  font-family: 'Playfair Display', serif;
  font-size: 14px; font-weight: 600; color: #1A3A5C;
}
</style>
</head>
<body>

<!-- BARRE TÉLÉCHARGEMENT PDF -->
<div class="download-bar no-print">
  <div class="download-bar-title">
    📄 Business Plan — ${data.nomProjet || 'Mon Projet'}
    <span>Document confidentiel</span>
  </div>
  <button class="dl-btn" onclick="savePDF()">
    ⬇ Enregistrer en PDF
  </button>
</div>

<!-- COUVERTURE -->
<div class="cover">
  <div class="cover-label">Business Plan Professionnel · ${today}</div>
  <div class="cover-title">${data.nomProjet || 'Mon Projet'}</div>
  <div class="cover-subtitle">${data.secteur || ''} · ${data.ville || ''}</div>
  <div class="cover-grid">
    <div class="cover-item">
      <div class="cover-item-label">Porteur de projet</div>
      <div class="cover-item-value">${data.prenom || ''} ${data.nom || ''}</div>
    </div>
    <div class="cover-item">
      <div class="cover-item-label">Statut juridique</div>
      <div class="cover-item-value">${data.juridique || '—'}</div>
    </div>
    <div class="cover-item">
      <div class="cover-item-label">Lancement prévu</div>
      <div class="cover-item-value">${data.lancement || 'À définir'}</div>
    </div>
    <div class="cover-item">
      <div class="cover-item-label">Destinataire</div>
      <div class="cover-item-value">${destLabels[data.destinataire] || '—'}</div>
    </div>
    <div class="cover-item">
      <div class="cover-item-label">Investissement total</div>
      <div class="cover-item-value">${fmt(fin.totalInvest)}</div>
    </div>
    <div class="cover-item">
      <div class="cover-item-label">Financement demandé</div>
      <div class="cover-item-value">${fmt(fin.capital)}</div>
    </div>
    <div class="cover-item">
      <div class="cover-item-label">CA prévisionnel An 1</div>
      <div class="cover-item-value">${fmt(fin.ca1)}</div>
    </div>
    <div class="cover-item">
      <div class="cover-item-label">Contact</div>
      <div class="cover-item-value">${data.email || '—'}</div>
    </div>
  </div>
</div>

<!-- KPIs -->
<div class="kpi-section">
  <div class="kpi-row">
    <div class="kpi-card">
      <div class="kpi-label">CA Année 1</div>
      <div class="kpi-value">${fmt(fin.ca1)}</div>
      <div class="kpi-sub">+${Math.round((fin.ca2/fin.ca1-1)*100)||10}% en An 2</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Résultat net An 1</div>
      <div class="kpi-value positive">${fmt(fin.rn1)}</div>
      <div class="kpi-sub">${fin.ca1>0?Math.round(fin.rn1/fin.ca1*100):0}% du CA</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Seuil de rentabilité</div>
      <div class="kpi-value">${fmt(fin.sr1)}</div>
      <div class="kpi-sub">Point mort An 1</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Emprunt demandé</div>
      <div class="kpi-value">${fmt(fin.capital)}</div>
      <div class="kpi-sub">${data.duree||60} mois à ${data.taux||4.5}%</div>
    </div>
  </div>
</div>

<!-- BODY -->
<div class="body">

<!-- 01 RÉSUMÉ -->
<div class="bp-section">
  <div class="section-header">
    <div class="section-num">01</div>
    <div class="section-title">Résumé exécutif</div>
  </div>
  ${section(aiSections.resume)}
</div>

<!-- 02 PORTEUR -->
<div class="bp-section page-break">
  <div class="section-header">
    <div class="section-num">02</div>
    <div class="section-title">Porteur de projet</div>
  </div>
  ${section(aiSections.porteur)}
</div>

<!-- 03 PROJET -->
<div class="bp-section">
  <div class="section-header">
    <div class="section-num">03</div>
    <div class="section-title">Présentation du projet</div>
  </div>
  ${section(aiSections.projet)}
</div>

<!-- 04 MARCHÉ -->
<div class="bp-section page-break">
  <div class="section-header">
    <div class="section-num">04</div>
    <div class="section-title">Étude de marché</div>
  </div>
  ${section(aiSections.marche)}
</div>

<!-- 05 INVESTISSEMENTS -->
<div class="bp-section page-break">
  <div class="section-header">
    <div class="section-num">05</div>
    <div class="section-title">Investissements et financement</div>
  </div>

  <div class="sub-title">Plan d'investissement</div>
  <table>
    <thead><tr><th>Poste d'investissement</th><th style="text-align:right">Montant HT</th></tr></thead>
    <tbody>
      ${fin.fraisEtab>0?`<tr><td>Frais d'établissement (création société, frais juridiques)</td><td class="num">${fmt(fin.fraisEtab)}</td></tr>`:''}
      ${fin.materiel>0?`<tr><td>Matériel et équipements professionnels</td><td class="num">${fmt(fin.materiel)}</td></tr>`:''}
      ${fin.travaux>0?`<tr><td>Travaux et aménagements des locaux</td><td class="num">${fmt(fin.travaux)}</td></tr>`:''}
      ${fin.mobilier>0?`<tr><td>Mobilier et matériel de bureau</td><td class="num">${fmt(fin.mobilier)}</td></tr>`:''}
      ${fin.logiciels>0?`<tr><td>Logiciels, licences et formations</td><td class="num">${fmt(fin.logiciels)}</td></tr>`:''}
      ${fin.comm>0?`<tr><td>Communication, site web et identité visuelle</td><td class="num">${fmt(fin.comm)}</td></tr>`:''}
      ${fin.stock>0?`<tr><td>Stock initial de démarrage</td><td class="num">${fmt(fin.stock)}</td></tr>`:''}
      ${fin.caution>0?`<tr><td>Caution et dépôt de garantie</td><td class="num">${fmt(fin.caution)}</td></tr>`:''}
      ${fin.tresorerie>0?`<tr><td>Trésorerie de départ</td><td class="num">${fmt(fin.tresorerie)}</td></tr>`:''}
      <tr class="total-row"><td><strong>TOTAL BESOINS</strong></td><td class="num"><strong>${fmt(fin.totalInvest)}</strong></td></tr>
    </tbody>
  </table>

  <div class="sub-title">Plan de financement</div>
  <table>
    <thead><tr><th>Source de financement</th><th style="text-align:right">Montant</th></tr></thead>
    <tbody>
      <tr><td>Apport personnel du porteur de projet</td><td class="num">${fmt(fin.apport)}</td></tr>
      ${fin.capital>0?`<tr><td>Emprunt bancaire (${data.taux||4.5}% — ${data.duree||60} mois — ${fmt(fin.mensualite)}/mois)</td><td class="num">${fmt(fin.capital)}</td></tr>`:''}
      ${data.aides?`<tr><td>Aides et subventions : ${data.aides}</td><td class="num">Voir détail</td></tr>`:''}
      <tr class="total-row"><td><strong>TOTAL RESSOURCES</strong></td><td class="num"><strong>${fmt(fin.totalRessources)}</strong></td></tr>
      <tr class="positive-row"><td><strong>SOLDE (Ressources — Besoins)</strong></td><td class="num">${fmt(fin.totalRessources - fin.totalInvest)}</td></tr>
    </tbody>
  </table>
</div>

<!-- 06 PRÉVISIONNEL -->
<div class="bp-section page-break">
  <div class="section-header">
    <div class="section-num">06</div>
    <div class="section-title">Prévisionnel financier sur 3 ans</div>
  </div>

  <div class="sub-title">Compte de résultats prévisionnel</div>
  <table>
    <thead>
      <tr>
        <th style="width:50%"></th>
        <th style="text-align:right">Année 1</th>
        <th style="text-align:right">Année 2</th>
        <th style="text-align:right">Année 3</th>
      </tr>
    </thead>
    <tbody>
      <tr class="head-row"><td colspan="4">Produits d'exploitation</td></tr>
      <tr><td>Chiffre d'affaires HT</td><td class="num">${fmt(fin.ca1)}</td><td class="num">${fmt(fin.ca2)}</td><td class="num">${fmt(fin.ca3)}</td></tr>
      <tr><td>Charges variables (${fin.cvPct||21}% du CA)</td><td class="num">${fmt(fin.cv1)}</td><td class="num">${fmt(fin.cv2)}</td><td class="num">${fmt(fin.cv3)}</td></tr>
      <tr class="total-row"><td>Marge brute</td><td class="num">${fmt(fin.mb1)}</td><td class="num">${fmt(fin.mb2)}</td><td class="num">${fmt(fin.mb3)}</td></tr>
      <tr class="head-row"><td colspan="4">Charges d'exploitation</td></tr>
      ${fin.loyer?`<tr><td>Loyer et charges locatives</td><td class="num">${fmt(fin.loyer)}</td><td class="num">${fmt(fin.loyer)}</td><td class="num">${fmt(fin.loyer)}</td></tr>`:''}
      ${fin.assurance?`<tr><td>Assurances professionnelles</td><td class="num">${fmt(fin.assurance)}</td><td class="num">${fmt(fin.assurance)}</td><td class="num">${fmt(fin.assurance)}</td></tr>`:''}
      ${fin.tel?`<tr><td>Téléphone et Internet</td><td class="num">${fmt(fin.tel)}</td><td class="num">${fmt(fin.tel)}</td><td class="num">${fmt(fin.tel)}</td></tr>`:''}
      ${fin.compta?`<tr><td>Honoraires expert-comptable</td><td class="num">${fmt(fin.compta)}</td><td class="num">${fmt(fin.compta)}</td><td class="num">${fmt(fin.compta)}</td></tr>`:''}
      ${fin.pub?`<tr><td>Publicité et communication</td><td class="num">${fmt(fin.pub)}</td><td class="num">${fmt(fin.pub)}</td><td class="num">${fmt(fin.pub)}</td></tr>`:''}
      ${fin.autres?`<tr><td>Autres charges fixes</td><td class="num">${fmt(fin.autres)}</td><td class="num">${fmt(fin.autres)}</td><td class="num">${fmt(fin.autres)}</td></tr>`:''}
      ${fin.salAnnuel>0?`<tr><td>Rémunération dirigeant net (${data.salaire||0} €/mois)</td><td class="num">${fmt(fin.salAnnuel)}</td><td class="num">${fmt(fin.salAnnuel)}</td><td class="num">${fmt(fin.salAnnuel)}</td></tr>`:''}
      ${fin.chargesSoc>0?`<tr><td>Charges sociales dirigeant (~45%)</td><td class="num">${fmt(fin.chargesSoc)}</td><td class="num">${fmt(fin.chargesSoc)}</td><td class="num">${fmt(fin.chargesSoc)}</td></tr>`:''}
      <tr class="total-row"><td>EBE — Excédent Brut d'Exploitation</td><td class="num">${fmt(fin.ebe1)}</td><td class="num">${fmt(fin.ebe2)}</td><td class="num">${fmt(fin.ebe3)}</td></tr>
      <tr><td>Dotations aux amortissements</td><td class="num">${fmt(fin.amort)}</td><td class="num">${fmt(fin.amort)}</td><td class="num">${fmt(fin.amort)}</td></tr>
      <tr><td>Charges financières (intérêts emprunt)</td><td class="num">${fmt(fin.intAn1)}</td><td class="num">${fmt(fin.intAn2)}</td><td class="num">${fmt(fin.intAn3)}</td></tr>
      <tr class="total-row"><td>Résultat avant impôts</td><td class="num">${fmt(fin.ravt1)}</td><td class="num">${fmt(fin.ravt2)}</td><td class="num">${fmt(fin.ravt3)}</td></tr>
      <tr><td>Impôt sur les sociétés (IS)</td><td class="num">${fmt(fin.is1)}</td><td class="num">${fmt(fin.is2)}</td><td class="num">${fmt(fin.is3)}</td></tr>
      <tr class="positive-row"><td><strong>RÉSULTAT NET COMPTABLE</strong></td><td class="num"><strong>${fmt(fin.rn1)}</strong></td><td class="num"><strong>${fmt(fin.rn2)}</strong></td><td class="num"><strong>${fmt(fin.rn3)}</strong></td></tr>
    </tbody>
  </table>

  <div class="sub-title">Capacité d'autofinancement (CAF)</div>
  <table>
    <thead><tr><th></th><th style="text-align:right">An 1</th><th style="text-align:right">An 2</th><th style="text-align:right">An 3</th></tr></thead>
    <tbody>
      <tr><td>Résultat net</td><td class="num">${fmt(fin.rn1)}</td><td class="num">${fmt(fin.rn2)}</td><td class="num">${fmt(fin.rn3)}</td></tr>
      <tr><td>+ Dotations aux amortissements</td><td class="num">${fmt(fin.amort)}</td><td class="num">${fmt(fin.amort)}</td><td class="num">${fmt(fin.amort)}</td></tr>
      <tr class="total-row"><td>Capacité d'autofinancement (CAF)</td><td class="num">${fmt(fin.caf1)}</td><td class="num">${fmt(fin.caf2)}</td><td class="num">${fmt(fin.caf3)}</td></tr>
      <tr><td>— Remboursement emprunt annuel</td><td class="num">${fmt(fin.remboAnnuel)}</td><td class="num">${fmt(fin.remboAnnuel)}</td><td class="num">${fmt(fin.remboAnnuel)}</td></tr>
      <tr class="positive-row"><td><strong>Autofinancement net</strong></td><td class="num">${fmt(fin.caf1-fin.remboAnnuel)}</td><td class="num">${fmt(fin.caf2-fin.remboAnnuel)}</td><td class="num">${fmt(fin.caf3-fin.remboAnnuel)}</td></tr>
    </tbody>
  </table>

  <div class="callout">
    <strong>📊 Seuil de rentabilité An 1 :</strong> ${fmt(fin.sr1)} —
    Le CA prévisionnel (${fmt(fin.ca1)}) dépasse le seuil de
    <strong>${fin.ca1>0&&fin.sr1>0?Math.round((fin.ca1/fin.sr1-1)*100):0}%</strong>.
    ${fin.caf1>fin.remboAnnuel
      ? `La CAF couvre le remboursement avec un ratio de <strong>${(fin.caf1/fin.remboAnnuel).toFixed(1)}x</strong> — capacité de remboursement solide et rassurante pour l'établissement prêteur.`
      : `Attention : surveiller attentivement la trésorerie en An 1.`}
  </div>
</div>

<!-- 07 STRATÉGIE -->
<div class="bp-section page-break">
  <div class="section-header">
    <div class="section-num">07</div>
    <div class="section-title">Stratégie commerciale et organisation</div>
  </div>
  ${section(aiSections.strategie)}
</div>

<!-- 08 RISQUES -->
<div class="bp-section">
  <div class="section-header">
    <div class="section-num">08</div>
    <div class="section-title">Analyse des risques et mesures correctives</div>
  </div>
  ${section(aiSections.risques)}
</div>

</div><!-- /body -->

<!-- FOOTER -->
<div class="doc-footer no-print">
  <div class="footer-logo">PlanIA</div>
  <div>Business Plan Professionnel · ${today} · Document confidentiel</div>
  <div>${data.prenom||''} ${data.nom||''}</div>
</div>

<script>
function savePDF() {
  var bar = document.querySelector('.download-bar');
  if (bar) bar.style.display = 'none';
  document.body.style.paddingTop = '0';
  window.print();
  setTimeout(function() {
    if (bar) bar.style.display = 'flex';
    document.body.style.paddingTop = '62px';
  }, 2000);
}
window.onload = function() {
  setTimeout(savePDF, 1800);
};
</script>
</body>
</html>`;
}

module.exports = { generateBusinessPlanHTML };
