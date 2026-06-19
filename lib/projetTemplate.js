// lib/projetTemplate.js
const { fmt } = require('./financials');

function generateProjetHTML(data, fin, sections) {
  const today = new Date().toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
  const destLabels = {
    banque:'Banque / Organisme de crédit',
    investisseur:'Investisseur / Levée de fonds',
    subvention:'Subvention / Association',
    personnel:'Usage personnel',
  };

  // Nettoie le markdown et génère du HTML propre
  function renderText(text) {
    if (!text) return '<p class="empty">Contenu en cours de rédaction.</p>';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^#{1,3}\s+(.+)$/gm, '') // supprime les titres markdown
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .map(l => `<p>${l}</p>`)
      .join('\n');
  }

  const s = (key) => renderText(sections[key]);
  const ca2Growth = fin.ca1 > 0 ? Math.round((fin.ca2/fin.ca1 - 1)*100) : 10;
  const margeNette = fin.ca1 > 0 ? Math.round(fin.rn1/fin.ca1*100) : 0;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Business Plan — ${data.nomProjet || 'Projet'}</title>
<style>
/* ── RESET & BASE ─────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 10pt; }
body {
  font-family: 'Georgia', 'Times New Roman', serif;
  color: #1C1C2E;
  background: #fff;
  line-height: 1.7;
}

/* ── PRINT ────────────────────────────────────────────────────── */
@media print {
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: avoid; }
  .no-break { page-break-inside: avoid; }
}

/* ── PAGE LAYOUT ──────────────────────────────────────────────── */
.page {
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  position: relative;
  overflow: hidden;
}

/* ── COUVERTURE ───────────────────────────────────────────────── */
.cover {
  background: linear-gradient(145deg, #0A1628 0%, #1A2F50 40%, #0D2040 100%);
  min-height: 297mm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0;
  position: relative;
}

.cover-accent-bar {
  height: 5px;
  background: linear-gradient(90deg, #C8973A, #E8B84B, #C8973A);
}

.cover-content {
  flex: 1;
  padding: 48px 52px 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.cover-doc-type {
  font-family: 'Arial', sans-serif;
  font-size: 8pt;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #C8973A;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.cover-doc-type::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(200,151,58,0.4);
}

.cover-title {
  font-family: 'Georgia', serif;
  font-size: 42pt;
  font-weight: 700;
  color: #FFFFFF;
  line-height: 1.08;
  letter-spacing: -0.02em;
  margin-bottom: 14px;
}

.cover-subtitle {
  font-family: 'Arial', sans-serif;
  font-size: 12pt;
  color: rgba(255,255,255,0.55);
  font-weight: 300;
  margin-bottom: 44px;
  letter-spacing: 0.02em;
}

.cover-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  background: rgba(255,255,255,0.06);
  border-radius: 8px;
  overflow: hidden;
  max-width: 540px;
}

.cover-cell {
  background: rgba(255,255,255,0.04);
  padding: 14px 20px;
}
.cover-cell-label {
  font-family: 'Arial', sans-serif;
  font-size: 7pt;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
  margin-bottom: 5px;
}
.cover-cell-value {
  font-family: 'Arial', sans-serif;
  font-size: 11pt;
  font-weight: 500;
  color: #FFFFFF;
}

.cover-footer {
  padding: 24px 52px;
  border-top: 1px solid rgba(255,255,255,0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.cover-footer-brand {
  font-family: 'Georgia', serif;
  font-size: 13pt;
  font-weight: 700;
  color: rgba(255,255,255,0.3);
  letter-spacing: 0.08em;
}
.cover-footer-date {
  font-family: 'Arial', sans-serif;
  font-size: 8pt;
  color: rgba(255,255,255,0.3);
}

/* ── KPI PAGE ──────────────────────────────────────────────────── */
.kpi-page {
  min-height: 297mm;
  padding: 52px;
  background: #FAFAF8;
  display: flex;
  flex-direction: column;
}

.kpi-header {
  margin-bottom: 36px;
  padding-bottom: 20px;
  border-bottom: 2px solid #1A2F50;
}
.kpi-header-label {
  font-family: 'Arial', sans-serif;
  font-size: 7.5pt;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #C8973A;
  margin-bottom: 6px;
}
.kpi-header-title {
  font-family: 'Georgia', serif;
  font-size: 22pt;
  color: #1A2F50;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 36px;
}
.kpi-card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-top: 3px solid #1A2F50;
  border-radius: 4px;
  padding: 20px 16px;
}
.kpi-card.gold { border-top-color: #C8973A; }
.kpi-card.green { border-top-color: #276749; }
.kpi-card-label {
  font-family: 'Arial', sans-serif;
  font-size: 7pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #718096;
  margin-bottom: 10px;
}
.kpi-card-value {
  font-family: 'Georgia', serif;
  font-size: 20pt;
  font-weight: 700;
  color: #1A2F50;
  line-height: 1.1;
}
.kpi-card-value.green { color: #276749; }
.kpi-card-sub {
  font-family: 'Arial', sans-serif;
  font-size: 8pt;
  color: #A0AEC0;
  margin-top: 6px;
}

/* ── SECTION LAYOUT ────────────────────────────────────────────── */
.content-page {
  min-height: 297mm;
  padding: 48px 52px;
  display: flex;
  flex-direction: column;
}

.section-block {
  margin-bottom: 40px;
}

.section-header {
  display: flex;
  align-items: flex-start;
  gap: 18px;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1.5px solid #E2E8F0;
  position: relative;
}
.section-header::after {
  content: '';
  position: absolute;
  bottom: -1.5px;
  left: 0;
  width: 64px;
  height: 1.5px;
  background: #C8973A;
}

.section-num {
  width: 36px;
  height: 36px;
  background: #1A2F50;
  color: #FFFFFF;
  font-family: 'Arial', sans-serif;
  font-size: 11pt;
  font-weight: 700;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.section-title {
  font-family: 'Georgia', serif;
  font-size: 18pt;
  font-weight: 700;
  color: #1A2F50;
  line-height: 1.2;
}

.section-content p {
  font-family: 'Georgia', serif;
  font-size: 10.5pt;
  color: #2D3748;
  line-height: 1.8;
  margin-bottom: 12px;
  text-align: justify;
  hyphens: auto;
}
.section-content p:last-child { margin-bottom: 0; }
.section-content strong { color: #1A2F50; font-weight: 700; }
.section-content .empty {
  font-style: italic;
  color: #A0AEC0;
  font-size: 9pt;
}

/* ── HIGHLIGHT BOX ─────────────────────────────────────────────── */
.highlight-box {
  background: linear-gradient(135deg, #FFF8EC, #FFF3D4);
  border-left: 4px solid #C8973A;
  border-radius: 0 6px 6px 0;
  padding: 18px 22px;
  margin: 18px 0;
}
.highlight-box-title {
  font-family: 'Arial', sans-serif;
  font-size: 8pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #8B6914;
  margin-bottom: 10px;
}
.highlight-box p {
  font-family: 'Arial', sans-serif;
  font-size: 10pt;
  color: #2D3748;
  line-height: 1.65;
  margin-bottom: 6px;
}
.highlight-box p:last-child { margin-bottom: 0; }
.highlight-box strong { color: #1A2F50; }

/* ── TABLE ─────────────────────────────────────────────────────── */
.data-table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0 24px;
  font-family: 'Arial', sans-serif;
  font-size: 9pt;
}
.data-table thead tr {
  background: #1A2F50;
}
.data-table thead th {
  color: #FFFFFF;
  padding: 10px 14px;
  text-align: left;
  font-weight: 700;
  font-size: 8pt;
  letter-spacing: 0.05em;
}
.data-table tbody tr {
  border-bottom: 1px solid #EDF2F7;
}
.data-table tbody tr:nth-child(even) {
  background: #F7FAFC;
}
.data-table tbody td {
  padding: 9px 14px;
  color: #4A5568;
  vertical-align: top;
}
.data-table .row-total {
  background: #FFF8EC !important;
  font-weight: 700;
  color: #1A2F50;
  border-top: 2px solid #C8973A;
}
.data-table .row-positive {
  background: #F0FFF4 !important;
  color: #276749;
  font-weight: 700;
}
.data-table .col-right { text-align: right; }

/* ── PAGE FOOTER ────────────────────────────────────────────────── */
.page-footer {
  margin-top: auto;
  padding-top: 20px;
  border-top: 1px solid #EDF2F7;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'Arial', sans-serif;
  font-size: 7.5pt;
  color: #A0AEC0;
}
.page-footer-brand {
  font-weight: 700;
  color: #1A2F50;
  letter-spacing: 0.06em;
}

/* ── SEPARATOR ──────────────────────────────────────────────────── */
.section-divider {
  height: 40px;
}
</style>
</head>
<body>

<!-- ══ PAGE 1 : COUVERTURE ══════════════════════════════════════ -->
<div class="page">
<div class="cover">
  <div class="cover-accent-bar"></div>
  <div class="cover-content">
    <div class="cover-doc-type">Livrable 1 · Présentation du Projet et de l'Entrepreneur</div>
    <div class="cover-title">${data.nomProjet || 'Mon Projet'}</div>
    <div class="cover-subtitle">${data.secteur || ''} · ${data.ville || ''}</div>
    <div class="cover-grid">
      <div class="cover-cell">
        <div class="cover-cell-label">Porteur de projet</div>
        <div class="cover-cell-value">${data.prenom || ''} ${data.nom || ''}</div>
      </div>
      <div class="cover-cell">
        <div class="cover-cell-label">Statut juridique</div>
        <div class="cover-cell-value">${data.juridique || '—'}</div>
      </div>
      <div class="cover-cell">
        <div class="cover-cell-label">Lancement prévu</div>
        <div class="cover-cell-value">${data.lancement || 'À définir'}</div>
      </div>
      <div class="cover-cell">
        <div class="cover-cell-label">Destinataire</div>
        <div class="cover-cell-value">${destLabels[data.dest || data.destinataire] || '—'}</div>
      </div>
      <div class="cover-cell">
        <div class="cover-cell-label">CA prévisionnel An 1</div>
        <div class="cover-cell-value">${fmt(fin.ca1)}</div>
      </div>
      <div class="cover-cell">
        <div class="cover-cell-label">Financement demandé</div>
        <div class="cover-cell-value">${fmt(fin.capital)}</div>
      </div>
    </div>
  </div>
  <div class="cover-footer">
    <div class="cover-footer-brand">PlanIA</div>
    <div class="cover-footer-date">Document confidentiel · ${today}</div>
  </div>
</div>
</div>

<!-- ══ PAGE 2 : KPIs + RÉSUMÉ ══════════════════════════════════ -->
<div class="page">
<div class="kpi-page">
  <div class="kpi-header">
    <div class="kpi-header-label">Indicateurs clés · Synthèse financière</div>
    <div class="kpi-header-title">Vue d'ensemble du projet</div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-card-label">CA Année 1</div>
      <div class="kpi-card-value">${fmt(fin.ca1)}</div>
      <div class="kpi-card-sub">+${ca2Growth}% en Année 2</div>
    </div>
    <div class="kpi-card green">
      <div class="kpi-card-label">Résultat net An 1</div>
      <div class="kpi-card-value green">${fmt(fin.rn1)}</div>
      <div class="kpi-card-sub">${margeNette}% du chiffre d'affaires</div>
    </div>
    <div class="kpi-card gold">
      <div class="kpi-card-label">Seuil de rentabilité</div>
      <div class="kpi-card-value">${fmt(fin.sr1)}</div>
      <div class="kpi-card-sub">Atteint en Année 1</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-card-label">Emprunt demandé</div>
      <div class="kpi-card-value">${fmt(fin.capital)}</div>
      <div class="kpi-card-sub">${data.duree || 60} mois à ${data.taux || 4.5}%</div>
    </div>
  </div>

  <div class="highlight-box">
    <div class="highlight-box-title">Synthèse financière · Plan de financement</div>
    <p>
      <strong>Investissement total :</strong> ${fmt(fin.totalInvest)} —
      <strong>Apport personnel :</strong> ${fmt(fin.apport)} (${fin.totalRessources > 0 ? Math.round(fin.apport/fin.totalRessources*100) : 0}%) —
      <strong>Emprunt bancaire :</strong> ${fmt(fin.capital)} (${fin.totalRessources > 0 ? Math.round(fin.capital/fin.totalRessources*100) : 0}%)
    </p>
    <p>
      <strong>Capacité d'autofinancement An 1 :</strong> ${fmt(fin.caf1)} —
      Ratio CAF / Remboursement : <strong>${fin.remboAnnuel > 0 ? (fin.caf1/fin.remboAnnuel).toFixed(1) : '—'}x</strong> — solidité financière confirmée.
    </p>
  </div>

  <div class="section-block">
    <div class="section-header">
      <div class="section-num">01</div>
      <div class="section-title">Résumé exécutif</div>
    </div>
    <div class="section-content">${s('resume')}</div>
  </div>

  <div class="page-footer">
    <div class="page-footer-brand">${data.nomProjet || ''}</div>
    <div>Présentation du Projet · ${today} · Confidentiel</div>
    <div>2</div>
  </div>
</div>
</div>

<!-- ══ PAGE 3 : FONDATEUR + HISTOIRE ══════════════════════════════ -->
<div class="page">
<div class="content-page">

  <div class="section-block no-break">
    <div class="section-header">
      <div class="section-num">02</div>
      <div class="section-title">Présentation du fondateur</div>
    </div>
    <div class="section-content">${s('fondateur')}</div>
  </div>

  <div class="section-divider"></div>

  <div class="section-block no-break">
    <div class="section-header">
      <div class="section-num">03</div>
      <div class="section-title">Histoire et vision du projet</div>
    </div>
    <div class="section-content">${s('histoire')}</div>
  </div>

  <div class="page-footer">
    <div class="page-footer-brand">${data.nomProjet || ''}</div>
    <div>Présentation du Projet · ${today} · Confidentiel</div>
    <div>3</div>
  </div>
</div>
</div>

<!-- ══ PAGE 4 : PRODUITS + VALEUR ════════════════════════════════ -->
<div class="page">
<div class="content-page">

  <div class="section-block no-break">
    <div class="section-header">
      <div class="section-num">04</div>
      <div class="section-title">Produits et services</div>
    </div>
    <div class="section-content">${s('produits')}</div>
  </div>

  <div class="section-divider"></div>

  <div class="section-block no-break">
    <div class="section-header">
      <div class="section-num">05</div>
      <div class="section-title">Proposition de valeur</div>
    </div>
    <div class="section-content">${s('valeur')}</div>
  </div>

  <div class="page-footer">
    <div class="page-footer-brand">${data.nomProjet || ''}</div>
    <div>Présentation du Projet · ${today} · Confidentiel</div>
    <div>4</div>
  </div>
</div>
</div>

<!-- ══ PAGE 5 : MODÈLE ÉCONOMIQUE + ORGANISATION ════════════════ -->
<div class="page">
<div class="content-page">

  <div class="section-block no-break">
    <div class="section-header">
      <div class="section-num">06</div>
      <div class="section-title">Modèle économique</div>
    </div>
    <div class="section-content">${s('modele')}</div>
  </div>

  <div class="section-divider"></div>

  <div class="section-block no-break">
    <div class="section-header">
      <div class="section-num">07</div>
      <div class="section-title">Organisation de l'entreprise</div>
    </div>
    <div class="section-content">${s('organisation')}</div>
  </div>

  <div class="page-footer">
    <div class="page-footer-brand">${data.nomProjet || ''}</div>
    <div>Présentation du Projet · ${today} · Confidentiel</div>
    <div>5</div>
  </div>
</div>
</div>

<!-- ══ PAGE 6 : OBJECTIFS + DÉVELOPPEMENT ════════════════════════ -->
<div class="page">
<div class="content-page">

  <div class="section-block no-break">
    <div class="section-header">
      <div class="section-num">08</div>
      <div class="section-title">Objectifs à court, moyen et long terme</div>
    </div>
    <div class="section-content">${s('objectifs')}</div>
  </div>

  <div class="section-divider"></div>

  <div class="section-block no-break">
    <div class="section-header">
      <div class="section-num">09</div>
      <div class="section-title">Plan de développement</div>
    </div>
    <div class="section-content">${s('developpement')}</div>
  </div>

  <div class="page-footer">
    <div class="page-footer-brand">${data.nomProjet || ''}</div>
    <div>Présentation du Projet · ${today} · Confidentiel</div>
    <div>6</div>
  </div>
</div>
</div>

<!-- ══ PAGE 7 : CONCLUSION ════════════════════════════════════════ -->
<div class="page">
<div class="content-page">

  <div class="section-block no-break">
    <div class="section-header">
      <div class="section-num">10</div>
      <div class="section-title">Conclusion</div>
    </div>
    <div class="section-content">${s('conclusion')}</div>
  </div>

  <div class="section-divider"></div>

  <div class="highlight-box">
    <div class="highlight-box-title">Récapitulatif financier · Confiance du porteur</div>
    <p>
      Le projet <strong>${data.nomProjet || ''}</strong> présente un modèle financier solide avec un résultat net positif
      dès la première année (<strong>${fmt(fin.rn1)}</strong>) et un seuil de rentabilité atteint à <strong>${fmt(fin.sr1)}</strong>.
    </p>
    <p>
      La capacité d'autofinancement générée (<strong>${fmt(fin.caf1)}</strong>) couvre le remboursement de l'emprunt
      avec un ratio de <strong>${fin.remboAnnuel > 0 ? (fin.caf1/fin.remboAnnuel).toFixed(1) : '—'}x</strong>,
      garantissant une excellente solidité financière et rassurante pour tout partenaire bancaire ou investisseur.
    </p>
  </div>

  <div class="page-footer">
    <div class="page-footer-brand">${data.nomProjet || ''}</div>
    <div>Présentation du Projet · ${today} · Confidentiel</div>
    <div>7</div>
  </div>
</div>
</div>

</body>
</html>`;
}

module.exports = { generateProjetHTML };
