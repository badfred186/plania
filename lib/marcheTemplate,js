// lib/marcheTemplate.js
const { fmt } = require('./financials');

function generateMarcheHTML(data, fin, sections) {
  const today = new Date().toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });

  function txt(text) {
    if (!text) return '<p style="color:#999;font-style:italic;font-size:13px;">Section en cours de génération.</p>';
    return text.split('\n').filter(l => l.trim()).map(line => {
      const cleaned = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return `<p style="margin:0 0 12px;line-height:1.8;color:#4a5568;font-size:13.5px;">${cleaned}</p>`;
    }).join('');
  }

  function swotSection(text) {
    if (!text) return '<p style="color:#999;font-style:italic">Section en cours de génération.</p>';
    const lines = text.split('\n').filter(l => l.trim());
    const forces = [], faiblesses = [], opportunites = [], menaces = [];
    lines.forEach(line => {
      if (line.startsWith('F:')) forces.push(line.replace('F:','').trim());
      else if (line.startsWith('W:')) faiblesses.push(line.replace('W:','').trim());
      else if (line.startsWith('O:')) opportunites.push(line.replace('O:','').trim());
      else if (line.startsWith('T:')) menaces.push(line.replace('T:','').trim());
    });
    const mkList = (items, color) => items.length
      ? items.map(i => `<li style="list-style:none;padding-left:14px;position:relative;margin-bottom:4px;font-size:12.5px;color:#4a5568"><span style="position:absolute;left:0;color:${color}">→</span>${i.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}</li>`).join('')
      : '<li style="list-style:none;font-size:12.5px;color:#999;font-style:italic">À compléter</li>';
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;border-radius:12px;overflow:hidden;margin:16px 0">
        <div style="background:#EBF4FF;padding:20px">
          <div style="font-weight:700;font-size:13px;margin-bottom:10px;display:flex;align-items:center;gap:8px">
            <span style="background:#2B6CB0;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:.06em">FORCES</span>
          </div>
          <ul style="padding:0">${mkList(forces,'#2B6CB0')}</ul>
        </div>
        <div style="background:#FEF2F2;padding:20px">
          <div style="font-weight:700;font-size:13px;margin-bottom:10px;display:flex;align-items:center;gap:8px">
            <span style="background:#C53030;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:.06em">FAIBLESSES</span>
          </div>
          <ul style="padding:0">${mkList(faiblesses,'#C53030')}</ul>
        </div>
        <div style="background:#F0FFF4;padding:20px">
          <div style="font-weight:700;font-size:13px;margin-bottom:10px;display:flex;align-items:center;gap:8px">
            <span style="background:#276749;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:.06em">OPPORTUNITÉS</span>
          </div>
          <ul style="padding:0">${mkList(opportunites,'#276749')}</ul>
        </div>
        <div style="background:#FFFBEB;padding:20px">
          <div style="font-weight:700;font-size:13px;margin-bottom:10px;display:flex;align-items:center;gap:8px">
            <span style="background:#C05621;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:.06em">MENACES</span>
          </div>
          <ul style="padding:0">${mkList(menaces,'#C05621')}</ul>
        </div>
      </div>`;
  }

  const s = (key) => key === 'swot' ? swotSection(sections[key]) : txt(sections[key] || '');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Étude de Marché & Stratégie — ${data.nomProjet}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',Arial,sans-serif;color:#2d3748;font-size:13.5px;line-height:1.75;background:#fff}
@media print{body{font-size:11pt}.page-break{page-break-before:always}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.cover{background:linear-gradient(160deg,#1A1A2E 0%,#2D2D5E 60%,#0D0D1F 100%);padding:64px 56px 52px;position:relative;overflow:hidden}
.cover::before{content:'';position:absolute;top:-70px;right:-70px;width:300px;height:300px;background:radial-gradient(circle,rgba(200,151,58,.15) 0%,transparent 70%);border-radius:50%}
.c-eyebrow{font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#C8973A;margin-bottom:10px}
.c-divider{width:56px;height:2px;background:#C8973A;margin-bottom:22px}
.c-title{font-family:'Playfair Display',serif;font-size:40px;font-weight:700;color:#fff;line-height:1.1;margin-bottom:7px;letter-spacing:-.02em}
.c-sub{font-size:15px;color:rgba(255,255,255,.5);margin-bottom:44px;font-weight:300}
.c-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(255,255,255,.08);border-radius:10px;overflow:hidden;max-width:560px}
.ci{background:rgba(255,255,255,.05);padding:13px 16px}
.ci-l{font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.35);margin-bottom:3px}
.ci-v{font-size:13px;font-weight:500;color:#fff}
.body{padding:48px 56px}
.section{margin-bottom:44px}
.sh{display:flex;align-items:center;gap:14px;margin-bottom:22px;padding-bottom:12px;border-bottom:2px solid #EDF2F7;position:relative}
.sh::after{content:'';position:absolute;bottom:-2px;left:0;width:52px;height:2px;background:#C8973A}
.snum{width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#1A1A2E,#2D2D5E);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.stitle{font-family:'Playfair Display',serif;font-size:22px;font-weight:600;color:#1A1A2E;letter-spacing:-.01em}
.callout{background:#EDE9FE;border:1px solid #C4B5FD;border-left:4px solid #7C3AED;border-radius:0 8px 8px 0;padding:14px 18px;margin:16px 0;font-size:13px;color:#4C1D95;line-height:1.7}
table{width:100%;border-collapse:collapse;margin:14px 0 20px;font-size:12.5px}
thead tr{background:linear-gradient(135deg,#1A1A2E,#2D2D5E)}
thead th{color:#fff;padding:9px 13px;text-align:left;font-weight:600;font-size:11px;letter-spacing:.03em}
tbody tr{border-bottom:1px solid #EDF2F7}
tbody tr:nth-child(even){background:#F7FAFC}
tbody td{padding:9px 13px;color:#4a5568}
.tr-gold{background:#FFF8EC!important;font-weight:700;color:#1A1A2E}
.footer{display:flex;align-items:center;justify-content:space-between;padding:18px 56px;border-top:1px solid #EDF2F7;background:#F7FAFC;font-size:11px;color:#A0AEC0}
.footer-logo{font-family:'Playfair Display',serif;font-size:13px;font-weight:600;color:#1A1A2E}
</style>
</head>
<body>
<div class="cover">
  <div class="c-eyebrow">Livrable 2 · Étude de Marché et Stratégie</div>
  <div class="c-divider"></div>
  <div class="c-title">${data.nomProjet}</div>
  <div class="c-sub">Analyse du marché · Positionnement · Stratégie de développement</div>
  <div class="c-grid">
    <div class="ci"><div class="ci-l">Projet</div><div class="ci-v">${data.nomProjet}</div></div>
    <div class="ci"><div class="ci-l">Secteur</div><div class="ci-v">${data.secteur || '—'}</div></div>
    <div class="ci"><div class="ci-l">Zone géographique</div><div class="ci-v">${data.ville || '—'}</div></div>
    <div class="ci"><div class="ci-l">Date d'analyse</div><div class="ci-v">${today}</div></div>
  </div>
</div>

<div class="body">
<div class="section"><div class="sh"><div class="snum">01</div><div class="stitle">Analyse du marché</div></div>${s('marche')}</div>
<div class="section page-break"><div class="sh"><div class="snum">02</div><div class="stitle">Tendances du secteur</div></div>${s('tendances')}</div>
<div class="section"><div class="sh"><div class="snum">03</div><div class="stitle">Analyse de la concurrence</div></div>${s('concurrence')}</div>
<div class="section page-break"><div class="sh"><div class="snum">04</div><div class="stitle">Segmentation et cibles clients</div></div>${s('cibles')}</div>
<div class="section"><div class="sh"><div class="snum">05</div><div class="stitle">Positionnement stratégique</div></div>${s('positionnement')}</div>
<div class="section page-break"><div class="sh"><div class="snum">06</div><div class="stitle">Avantages concurrentiels</div></div>${s('avantages')}</div>
<div class="section"><div class="sh"><div class="snum">07</div><div class="stitle">Analyse SWOT</div></div>${s('swot')}</div>
<div class="section page-break"><div class="sh"><div class="snum">08</div><div class="stitle">Stratégie marketing</div></div>${s('marketing')}</div>
<div class="section"><div class="sh"><div class="snum">09</div><div class="stitle">Stratégie commerciale et acquisition</div></div>${s('commerciale')}</div>
<div class="section page-break"><div class="sh"><div class="snum">10</div><div class="stitle">Perspectives de croissance</div></div>${s('croissance')}</div>
</div>

<div class="footer">
  <div class="footer-logo">${data.nomProjet}</div>
  <div>Étude de marché & Stratégie · ${today} · Confidentiel</div>
  <div>${data.prenom} ${data.nom}</div>
</div>
</body>
</html>`;
}

module.exports = { generateMarcheHTML };
