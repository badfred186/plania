// lib/projetTemplate.js
const { fmt } = require('./financials');

function generateProjetHTML(data, fin, sections) {
  const today = new Date().toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
  const destLabels = { banque:'Banque / Organisme de crédit', investisseur:'Investisseur / Levée de fonds', subvention:'Subvention / Association', personnel:'Usage personnel' };

  function txt(text) {
    if (!text) return '<p style="color:#999;font-style:italic;font-size:13px;">Section en cours de génération.</p>';
    return text.split('\n').filter(l => l.trim()).map(line => {
      const cleaned = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return `<p style="margin:0 0 12px;line-height:1.8;color:#4a5568;font-size:13.5px;">${cleaned}</p>`;
    }).join('');
  }

  const s = (key) => txt(sections[key] || '');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Présentation du Projet — ${data.nomProjet}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',Arial,sans-serif;color:#2d3748;font-size:13.5px;line-height:1.75;background:#fff}
@media print{body{font-size:11pt}.page-break{page-break-before:always}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.cover{background:linear-gradient(160deg,#0F2540 0%,#1A3A5C 60%,#0D1F35 100%);padding:64px 56px 52px;position:relative;overflow:hidden}
.cover::before{content:'';position:absolute;top:-70px;right:-70px;width:300px;height:300px;background:radial-gradient(circle,rgba(200,151,58,.2) 0%,transparent 70%);border-radius:50%}
.c-eyebrow{font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#C8973A;margin-bottom:10px}
.c-divider{width:56px;height:2px;background:#C8973A;margin-bottom:22px}
.c-title{font-family:'Playfair Display',serif;font-size:40px;font-weight:700;color:#fff;line-height:1.1;margin-bottom:7px;letter-spacing:-.02em}
.c-sub{font-size:15px;color:rgba(255,255,255,.55);margin-bottom:44px;font-weight:300}
.c-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(255,255,255,.08);border-radius:10px;overflow:hidden;max-width:560px}
.ci{background:rgba(255,255,255,.05);padding:13px 16px}
.ci-l{font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.38);margin-bottom:3px}
.ci-v{font-size:13px;font-weight:500;color:#fff}
.body{padding:48px 56px}
.section{margin-bottom:44px}
.sh{display:flex;align-items:center;gap:14px;margin-bottom:22px;padding-bottom:12px;border-bottom:2px solid #EDF2F7;position:relative}
.sh::after{content:'';position:absolute;bottom:-2px;left:0;width:52px;height:2px;background:#C8973A}
.snum{width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#1A3A5C,#2C5282);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.stitle{font-family:'Playfair Display',serif;font-size:22px;font-weight:600;color:#1A3A5C;letter-spacing:-.01em}
.callout{background:#EBF4FF;border:1px solid #BEE3F8;border-left:4px solid #3182CE;border-radius:0 8px 8px 0;padding:14px 18px;margin:16px 0;font-size:13px;color:#2C5282;line-height:1.7}
.highlight{background:linear-gradient(135deg,#FFF8EC,#FFF3D4);border:1px solid #E8D5A3;border-radius:10px;padding:18px 22px;margin:18px 0}
.hl-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#C8973A;margin-bottom:8px}
table{width:100%;border-collapse:collapse;margin:14px 0 20px;font-size:12.5px}
thead tr{background:linear-gradient(135deg,#1A3A5C,#2C5282)}
thead th{color:#fff;padding:9px 13px;text-align:left;font-weight:600;font-size:11px;letter-spacing:.03em}
tbody tr{border-bottom:1px solid #EDF2F7}
tbody tr:nth-child(even){background:#F7FAFC}
tbody td{padding:9px 13px;color:#4a5568}
.tr-gold{background:#FFF8EC!important;font-weight:700;color:#1A3A5C}
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}
.kpi{background:#F7FAFC;border:1px solid #E2E8F0;border-radius:9px;padding:15px}
.kpi-l{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#718096;margin-bottom:5px}
.kpi-v{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#1A3A5C}
.kpi-s{font-size:10px;color:#A0AEC0;margin-top:3px}
.kpi-v.pos{color:#276749}
.footer{display:flex;align-items:center;justify-content:space-between;padding:18px 56px;border-top:1px solid #EDF2F7;background:#F7FAFC;font-size:11px;color:#A0AEC0}
.footer-logo{font-family:'Playfair Display',serif;font-size:13px;font-weight:600;color:#1A3A5C}
</style>
</head>
<body>
<div class="cover">
  <div class="c-eyebrow">Livrable 1 · Présentation du Projet et de l'Entrepreneur</div>
  <div class="c-divider"></div>
  <div class="c-title">${data.nomProjet}</div>
  <div class="c-sub">${data.secteur || ''} · ${data.ville || ''}</div>
  <div class="c-grid">
    <div class="ci"><div class="ci-l">Porteur</div><div class="ci-v">${data.prenom} ${data.nom}</div></div>
    <div class="ci"><div class="ci-l">Statut juridique</div><div class="ci-v">${data.juridique || '—'}</div></div>
    <div class="ci"><div class="ci-l">Lancement</div><div class="ci-v">${data.lancement || 'À définir'}</div></div>
    <div class="ci"><div class="ci-l">Destinataire</div><div class="ci-v">${destLabels[data.dest || data.destinataire] || '—'}</div></div>
    <div class="ci"><div class="ci-l">CA An 1</div><div class="ci-v">${fmt(fin.ca1)}</div></div>
    <div class="ci"><div class="ci-l">Financement demandé</div><div class="ci-v">${fmt(fin.capital)}</div></div>
  </div>
</div>

<div class="body">

<div class="kpi-row">
  <div class="kpi"><div class="kpi-l">CA Année 1</div><div class="kpi-v">${fmt(fin.ca1)}</div><div class="kpi-s">+${Math.round((fin.ca2/fin.ca1-1)*100)||10}% An 2</div></div>
  <div class="kpi"><div class="kpi-l">Résultat net An 1</div><div class="kpi-v pos">${fmt(fin.rn1)}</div><div class="kpi-s">${fin.ca1>0?Math.round(fin.rn1/fin.ca1*100):0}% du CA</div></div>
  <div class="kpi"><div class="kpi-l">Seuil rentabilité</div><div class="kpi-v">${fmt(fin.sr1)}</div><div class="kpi-s">Point mort An 1</div></div>
  <div class="kpi"><div class="kpi-l">Emprunt demandé</div><div class="kpi-v">${fmt(fin.capital)}</div><div class="kpi-s">${data.duree||60} mois</div></div>
</div>

<div class="section"><div class="sh"><div class="snum">01</div><div class="stitle">Résumé exécutif</div></div>${s('resume')}</div>
<div class="section page-break"><div class="sh"><div class="snum">02</div><div class="stitle">Présentation du fondateur</div></div>${s('fondateur')}</div>
<div class="section"><div class="sh"><div class="snum">03</div><div class="stitle">Histoire et vision du projet</div></div>${s('histoire')}</div>
<div class="section page-break"><div class="sh"><div class="snum">04</div><div class="stitle">Produits et services</div></div>${s('produits')}</div>
<div class="section"><div class="sh"><div class="snum">05</div><div class="stitle">Proposition de valeur</div></div>${s('valeur')}</div>
<div class="section page-break"><div class="sh"><div class="snum">06</div><div class="stitle">Modèle économique</div></div>${s('modele')}</div>
<div class="section"><div class="sh"><div class="snum">07</div><div class="stitle">Organisation de l'entreprise</div></div>${s('organisation')}</div>
<div class="section page-break"><div class="sh"><div class="snum">08</div><div class="stitle">Objectifs à court, moyen et long terme</div></div>${s('objectifs')}</div>
<div class="section"><div class="sh"><div class="snum">09</div><div class="stitle">Plan de développement</div></div>${s('developpement')}</div>
<div class="section page-break"><div class="sh"><div class="snum">10</div><div class="stitle">Conclusion</div></div>${s('conclusion')}</div>

</div>
<div class="footer">
  <div class="footer-logo">${data.nomProjet}</div>
  <div>Présentation du projet · ${today} · Confidentiel</div>
  <div>${data.prenom} ${data.nom}</div>
</div>
</body>
</html>`;
}

module.exports = { generateProjetHTML };
