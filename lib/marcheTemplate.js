// lib/marcheTemplate.js
const { fmt } = require('./financials');

function generateMarcheHTML(data, fin, sections) {
  const today = new Date().toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });

  function renderText(text) {
    if (!text) return '<p class="empty">Contenu en cours de rédaction.</p>';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^#{1,3}\s+(.+)$/gm, '')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .map(l => `<p>${l}</p>`)
      .join('\n');
  }

  function renderSWOT(text) {
    if (!text) return '<p class="empty">Analyse SWOT en cours de génération.</p>';
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const forces = [], faiblesses = [], opportunites = [], menaces = [];
    lines.forEach(line => {
      if (/^F\s*:/i.test(line)) forces.push(line.replace(/^F\s*:\s*/i, '').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>'));
      else if (/^W\s*:/i.test(line)) faiblesses.push(line.replace(/^W\s*:\s*/i, '').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>'));
      else if (/^O\s*:/i.test(line)) opportunites.push(line.replace(/^O\s*:\s*/i, '').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>'));
      else if (/^T\s*:/i.test(line)) menaces.push(line.replace(/^T\s*:\s*/i, '').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>'));
    });
    const mkItems = (items, color) => items.length > 0
      ? items.map(i => `<div class="swot-item" style="border-left:2px solid ${color};padding-left:10px;margin-bottom:7px;font-size:9pt;color:#2D3748;line-height:1.6;">${i}</div>`).join('')
      : '<div style="font-size:9pt;color:#A0AEC0;font-style:italic;">À compléter</div>';
    return `
      <div class="swot-grid">
        <div class="swot-cell swot-s">
          <div class="swot-cell-header"><span class="swot-badge" style="background:#1A2F50;">S</span><span>Forces</span></div>
          ${mkItems(forces,'#1A2F50')}
        </div>
        <div class="swot-cell swot-w">
          <div class="swot-cell-header"><span class="swot-badge" style="background:#C53030;">W</span><span>Faiblesses</span></div>
          ${mkItems(faiblesses,'#C53030')}
        </div>
        <div class="swot-cell swot-o">
          <div class="swot-cell-header"><span class="swot-badge" style="background:#276749;">O</span><span>Opportunités</span></div>
          ${mkItems(opportunites,'#276749')}
        </div>
        <div class="swot-cell swot-t">
          <div class="swot-cell-header"><span class="swot-badge" style="background:#C05621;">T</span><span>Menaces</span></div>
          ${mkItems(menaces,'#C05621')}
        </div>
      </div>`;
  }

  const s = (key) => key === 'swot' ? renderSWOT(sections[key]) : renderText(sections[key]);
  const ca2Growth = fin.ca1 > 0 ? Math.round((fin.ca2/fin.ca1 - 1)*100) : 10;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Étude de Marché & Stratégie — ${data.nomProjet || 'Projet'}</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 10pt; }
body { font-family: 'Georgia','Times New Roman',serif; color: #1C1C2E; background: #fff; line-height: 1.7; }
@media print {
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: avoid; }
  .no-break { page-break-inside: avoid; }
}
.page { width: 210mm; min-height: 297mm; margin: 0 auto; position: relative; overflow: hidden; }

/* ── COUVERTURE MARCHÉ (violet foncé) ── */
.cover { background: linear-gradient(145deg, #12112A 0%, #1E1B4B 45%, #0F0E20 100%); min-height: 297mm; display: flex; flex-direction: column; justify-content: space-between; padding: 0; }
.cover-accent-bar { height: 5px; background: linear-gradient(90deg, #C8973A, #E8B84B, #C8973A); }
.cover-content { flex: 1; padding: 48px 52px 40px; display: flex; flex-direction: column; justify-content: center; }
.cover-doc-type { font-family:'Arial',sans-serif; font-size: 8pt; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #C8973A; margin-bottom: 12px; display: flex; align-items: center; gap: 12px; }
.cover-doc-type::after { content: ''; flex: 1; height: 1px; background: rgba(200,151,58,0.4); }
.cover-title { font-family:'Georgia',serif; font-size: 42pt; font-weight: 700; color: #FFFFFF; line-height: 1.08; letter-spacing: -0.02em; margin-bottom: 14px; }
.cover-subtitle { font-family:'Arial',sans-serif; font-size: 12pt; color: rgba(255,255,255,0.55); font-weight: 300; margin-bottom: 44px; }
.cover-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; background: rgba(255,255,255,0.06); border-radius: 8px; overflow: hidden; max-width: 480px; }
.cover-cell { background: rgba(255,255,255,0.04); padding: 14px 20px; }
.cover-cell-label { font-family:'Arial',sans-serif; font-size: 7pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 5px; }
.cover-cell-value { font-family:'Arial',sans-serif; font-size: 11pt; font-weight: 500; color: #FFFFFF; }
.cover-footer { padding: 24px 52px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; }
.cover-footer-brand { font-family:'Georgia',serif; font-size: 13pt; font-weight: 700; color: rgba(255,255,255,0.3); letter-spacing: 0.08em; }
.cover-footer-date { font-family:'Arial',sans-serif; font-size: 8pt; color: rgba(255,255,255,0.3); }

/* ── CONTENT ── */
.content-page { min-height: 297mm; padding: 48px 52px; display: flex; flex-direction: column; }
.section-block { margin-bottom: 38px; }
.section-header { display: flex; align-items: flex-start; gap: 18px; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 1.5px solid #E2E8F0; position: relative; }
.section-header::after { content: ''; position: absolute; bottom: -1.5px; left: 0; width: 64px; height: 1.5px; background: #C8973A; }
.section-num { width: 36px; height: 36px; background: #1E1B4B; color: #FFFFFF; font-family:'Arial',sans-serif; font-size: 11pt; font-weight: 700; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
.section-title { font-family:'Georgia',serif; font-size: 18pt; font-weight: 700; color: #1E1B4B; line-height: 1.2; }
.section-content p { font-family:'Georgia',serif; font-size: 10.5pt; color: #2D3748; line-height: 1.8; margin-bottom: 12px; text-align: justify; hyphens: auto; }
.section-content p:last-child { margin-bottom: 0; }
.section-content strong { color: #1E1B4B; font-weight: 700; }
.section-content .empty { font-style: italic; color: #A0AEC0; font-size: 9pt; }
.section-divider { height: 36px; }

/* ── SWOT ── */
.swot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; margin: 16px 0; background: #E2E8F0; border-radius: 8px; overflow: hidden; }
.swot-cell { padding: 20px; }
.swot-s { background: #EBF4FF; }
.swot-w { background: #FEF2F2; }
.swot-o { background: #F0FFF4; }
.swot-t { background: #FFFBEB; }
.swot-cell-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; font-family:'Arial',sans-serif; font-size: 10pt; font-weight: 700; color: #1C1C2E; }
.swot-badge { color: #fff; font-size: 9pt; font-weight: 700; padding: 3px 9px; border-radius: 20px; font-family:'Arial',sans-serif; }

/* ── HIGHLIGHT ── */
.highlight-box { background: linear-gradient(135deg,#FFF8EC,#FFF3D4); border-left: 4px solid #C8973A; border-radius: 0 6px 6px 0; padding: 18px 22px; margin: 18px 0; }
.highlight-box-title { font-family:'Arial',sans-serif; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #8B6914; margin-bottom: 10px; }
.highlight-box p { font-family:'Arial',sans-serif; font-size: 10pt; color: #2D3748; line-height: 1.65; margin-bottom: 6px; }
.highlight-box p:last-child { margin-bottom: 0; }
.highlight-box strong { color: #1E1B4B; }

/* ── TABLE ── */
.data-table { width: 100%; border-collapse: collapse; margin: 16px 0 20px; font-family:'Arial',sans-serif; font-size: 9pt; }
.data-table thead tr { background: #1E1B4B; }
.data-table thead th { color: #fff; padding: 9px 13px; text-align: left; font-weight: 700; font-size: 8pt; letter-spacing: 0.05em; }
.data-table tbody tr { border-bottom: 1px solid #EDF2F7; }
.data-table tbody tr:nth-child(even) { background: #F7FAFC; }
.data-table tbody td { padding: 9px 13px; color: #4A5568; vertical-align: top; }
.data-table .row-gold { background: #FFF8EC !important; font-weight: 700; color: #1E1B4B; border-top: 2px solid #C8973A; }

/* ── PAGE FOOTER ── */
.page-footer { margin-top: auto; padding-top: 20px; border-top: 1px solid #EDF2F7; display: flex; justify-content: space-between; align-items: center; font-family:'Arial',sans-serif; font-size: 7.5pt; color: #A0AEC0; }
.page-footer-brand { font-weight: 700; color: #1E1B4B; letter-spacing: 0.06em; }
</style>
</head>
<body>

<!-- PAGE 1 : COUVERTURE -->
<div class="page">
<div class="cover">
  <div class="cover-accent-bar"></div>
  <div class="cover-content">
    <div class="cover-doc-type">Livrable 2 · Étude de Marché et Stratégie</div>
    <div class="cover-title">${data.nomProjet || 'Mon Projet'}</div>
    <div class="cover-subtitle">Analyse du marché · Positionnement · Stratégie de développement</div>
    <div class="cover-grid">
      <div class="cover-cell"><div class="cover-cell-label">Projet</div><div class="cover-cell-value">${data.nomProjet || '—'}</div></div>
      <div class="cover-cell"><div class="cover-cell-label">Secteur</div><div class="cover-cell-value">${data.secteur || '—'}</div></div>
      <div class="cover-cell"><div class="cover-cell-label">Zone géographique</div><div class="cover-cell-value">${data.ville || '—'}</div></div>
      <div class="cover-cell"><div class="cover-cell-label">Date d'analyse</div><div class="cover-cell-value">${today}</div></div>
    </div>
  </div>
  <div class="cover-footer">
    <div class="cover-footer-brand">PlanIA</div>
    <div class="cover-footer-date">Document confidentiel · ${today}</div>
  </div>
</div>
</div>

<!-- PAGE 2 : MARCHÉ + TENDANCES -->
<div class="page">
<div class="content-page">
  <div class="section-block no-break">
    <div class="section-header"><div class="section-num">01</div><div class="section-title">Analyse du marché</div></div>
    <div class="section-content">${s('marche')}</div>
  </div>
  <div class="section-divider"></div>
  <div class="section-block no-break">
    <div class="section-header"><div class="section-num">02</div><div class="section-title">Tendances du secteur</div></div>
    <div class="section-content">${s('tendances')}</div>
  </div>
  <div class="page-footer">
    <div class="page-footer-brand">${data.nomProjet || ''}</div>
    <div>Étude de Marché & Stratégie · ${today} · Confidentiel</div>
    <div>2</div>
  </div>
</div>
</div>

<!-- PAGE 3 : CONCURRENCE + CIBLES -->
<div class="page">
<div class="content-page">
  <div class="section-block no-break">
    <div class="section-header"><div class="section-num">03</div><div class="section-title">Analyse de la concurrence</div></div>
    <div class="section-content">${s('concurrence')}</div>
  </div>
  <div class="section-divider"></div>
  <div class="section-block no-break">
    <div class="section-header"><div class="section-num">04</div><div class="section-title">Segmentation et cibles clients</div></div>
    <div class="section-content">${s('cibles')}</div>
  </div>
  <div class="page-footer">
    <div class="page-footer-brand">${data.nomProjet || ''}</div>
    <div>Étude de Marché & Stratégie · ${today} · Confidentiel</div>
    <div>3</div>
  </div>
</div>
</div>

<!-- PAGE 4 : POSITIONNEMENT + AVANTAGES -->
<div class="page">
<div class="content-page">
  <div class="section-block no-break">
    <div class="section-header"><div class="section-num">05</div><div class="section-title">Positionnement stratégique</div></div>
    <div class="section-content">${s('positionnement')}</div>
  </div>
  <div class="section-divider"></div>
  <div class="section-block no-break">
    <div class="section-header"><div class="section-num">06</div><div class="section-title">Avantages concurrentiels</div></div>
    <div class="section-content">${s('avantages')}</div>
  </div>
  <div class="page-footer">
    <div class="page-footer-brand">${data.nomProjet || ''}</div>
    <div>Étude de Marché & Stratégie · ${today} · Confidentiel</div>
    <div>4</div>
  </div>
</div>
</div>

<!-- PAGE 5 : SWOT -->
<div class="page">
<div class="content-page">
  <div class="section-block no-break">
    <div class="section-header"><div class="section-num">07</div><div class="section-title">Analyse SWOT</div></div>
    <div class="section-content">${s('swot')}</div>
  </div>
  <div class="page-footer">
    <div class="page-footer-brand">${data.nomProjet || ''}</div>
    <div>Étude de Marché & Stratégie · ${today} · Confidentiel</div>
    <div>5</div>
  </div>
</div>
</div>

<!-- PAGE 6 : MARKETING + COMMERCIALE -->
<div class="page">
<div class="content-page">
  <div class="section-block no-break">
    <div class="section-header"><div class="section-num">08</div><div class="section-title">Stratégie marketing</div></div>
    <div class="section-content">${s('marketing')}</div>
  </div>
  <div class="section-divider"></div>
  <div class="section-block no-break">
    <div class="section-header"><div class="section-num">09</div><div class="section-title">Stratégie commerciale et acquisition</div></div>
    <div class="section-content">${s('commerciale')}</div>
  </div>
  <div class="page-footer">
    <div class="page-footer-brand">${data.nomProjet || ''}</div>
    <div>Étude de Marché & Stratégie · ${today} · Confidentiel</div>
    <div>6</div>
  </div>
</div>
</div>

<!-- PAGE 7 : CROISSANCE + CONCLUSION -->
<div class="page">
<div class="content-page">
  <div class="section-block no-break">
    <div class="section-header"><div class="section-num">10</div><div class="section-title">Perspectives de croissance</div></div>
    <div class="section-content">${s('croissance')}</div>
  </div>
  <div class="section-divider"></div>
  <div class="highlight-box">
    <div class="highlight-box-title">Synthèse stratégique · Conclusion</div>
    <p>
      Le marché de <strong>${data.secteur || 'ce secteur'}</strong> offre une opportunité réelle pour <strong>${data.nomProjet || ''}</strong>.
      Le positionnement différenciant retenu, combiné à une stratégie d'acquisition ciblée et à des avantages concurrentiels défendables,
      permet d'envisager une croissance régulière de <strong>+${ca2Growth}% dès l'Année 2</strong>.
    </p>
    <p>
      L'analyse SWOT confirme la cohérence du projet avec les dynamiques du marché et la capacité du porteur à saisir
      les opportunités identifiées tout en maîtrisant les risques inhérents à toute création d'entreprise.
    </p>
  </div>
  <div class="page-footer">
    <div class="page-footer-brand">${data.nomProjet || ''}</div>
    <div>Étude de Marché & Stratégie · ${today} · Confidentiel</div>
    <div>7</div>
  </div>
</div>
</div>

</body>
</html>`;
}

module.exports = { generateMarcheHTML };
