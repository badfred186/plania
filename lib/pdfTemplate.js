// lib/pdfTemplate.js
// Génère le HTML du business plan (converti en PDF côté client ou envoyé tel quel)

const { fmt } = require('./financials');

function generateBusinessPlanHTML(data, fin, aiSections) {
  const today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const destLabels = {
    banque: 'Banque / Organisme de crédit',
    investisseur: 'Investisseur / Levée de fonds',
    subvention: 'Subvention / Association',
    personnel: 'Usage personnel / Comptable',
  };

  function section(text) {
    if (!text) return '<p style="color:#888;font-style:italic">Section générée par IA.</p>';
    return text.split('\n').filter(l => l.trim()).map(line => {
      if (line.startsWith('RISQUE:')) {
        const parts = line.split('|');
        const risque  = (parts[0] || '').replace('RISQUE:', '').trim();
        const niveau  = (parts[1] || '').replace('NIVEAU:', '').trim();
        const mesure  = (parts[2] || '').replace('MESURE:', '').trim();
        const colors  = { 'Élevé': '#FEE2E2|#991B1B', 'Modéré': '#FEF3C7|#92400E', 'Faible': '#DCFCE7|#166534' };
        const [bg, fg] = (colors[niveau] || '#F3F4F6|#374151').split('|');
        return `<div style="border-left:3px solid ${fg};padding:10px 14px;margin:8px 0;background:#FAFAFA;">
          <strong>${risque}</strong>
          <span style="background:${bg};color:${fg};font-size:10px;font-weight:600;padding:2px 7px;border-radius:3px;margin-left:8px;">${niveau}</span>
          <br><span style="color:#555;font-size:13px;">→ ${mesure}</span>
        </div>`;
      }
      return `<p style="margin:6px 0;line-height:1.75;color:#333;">${line}</p>`;
    }).join('');
  }

  const rowStyle = 'padding:8px 12px;border-bottom:1px solid #E4E6EB;';
  const thStyle  = 'background:#1F3864;color:#fff;padding:9px 12px;text-align:left;font-size:12px;';
  const totalStyle = 'background:#F5EDD6;font-weight:600;padding:8px 12px;border-top:2px solid #E8D5A3;';
  const headStyle  = 'background:#F0F2F5;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:8px 12px;';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Business Plan — ${data.nomProjet}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Inter:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #1a1a1a; font-size: 14px; line-height: 1.6; background: #fff; }
  @media print {
    .page-break { page-break-before: always; }
    body { font-size: 11pt; }
  }
  .cover { background: #0E0F11; color: #fff; padding: 60px 56px; min-height: 320px; }
  .cover-eyebrow { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.5); margin-bottom: 24px; }
  .cover-title { font-family: 'Playfair Display', Georgia, serif; font-size: 38px; font-weight: 400; line-height: 1.15; margin-bottom: 6px; }
  .cover-sub { font-size: 16px; color: rgba(255,255,255,.6); margin-bottom: 40px; }
  .cover-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 48px; }
  .cover-item strong { display: block; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: rgba(255,255,255,.45); margin-bottom: 2px; font-weight: 400; }
  .cover-item span { font-size: 14px; font-weight: 500; color: #fff; }
  .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 32px 0; }
  .kpi { background: #F8F9FB; border: 1px solid #E4E6EB; border-radius: 6px; padding: 16px; }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #7A7F8E; margin-bottom: 4px; }
  .kpi-value { font-family: 'Playfair Display', serif; font-size: 22px; color: #0E0F11; }
  .kpi-sub { font-size: 10px; color: #7A7F8E; margin-top: 3px; }
  .body { padding: 40px 56px; }
  .section { margin-bottom: 36px; }
  .section-header { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; padding-bottom: 10px; border-bottom: 2px solid #0E0F11; }
  .section-num { font-size: 10px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: #C9A84C; background: #F5EDD6; border: 1px solid #E8D5A3; padding: 2px 8px; border-radius: 4px; }
  .section-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 400; color: #0E0F11; }
  .sub-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #0E0F11; margin: 18px 0 10px; padding-left: 10px; border-left: 2px solid #C9A84C; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 18px; font-size: 13px; }
  th { ${thStyle} }
  td { ${rowStyle} color: #444; }
  tr:nth-child(even) td { background: #FAFAFA; }
  .callout { background: #F5EDD6; border: 1px solid #E8D5A3; border-left: 3px solid #C9A84C; border-radius: 4px; padding: 12px 16px; font-size: 13px; color: #555; margin: 10px 0 18px; line-height: 1.65; }
  .callout strong { color: #0E0F11; }
  .positive { color: #166534; font-weight: 600; }
  .num { text-align: right; font-family: monospace; font-size: 12px; }
  .footer { text-align: center; padding: 32px; font-size: 11px; color: #AAA; border-top: 1px solid #E4E6EB; margin-top: 40px; }
</style>
</head>
<body>

<!-- COUVERTURE -->
<div class="cover">
  <div class="cover-eyebrow">Business Plan · ${today}</div>
  <div class="cover-title">${data.nomProjet}</div>
  <div class="cover-sub">${data.secteur} · ${data.ville}</div>
  <div class="cover-grid">
    <div class="cover-item"><strong>Porteur de projet</strong><span>${data.prenom} ${data.nom}</span></div>
    <div class="cover-item"><strong>Statut juridique</strong><span>${data.juridique}</span></div>
    <div class="cover-item"><strong>Lancement prévu</strong><span>${data.lancement || 'À définir'}</span></div>
    <div class="cover-item"><strong>Destinataire</strong><span>${destLabels[data.destinataire] || '—'}</span></div>
    <div class="cover-item"><strong>Investissement total</strong><span>${fmt(fin.totalInvest)}</span></div>
    <div class="cover-item"><strong>Financement demandé</strong><span>${fmt(fin.capital)}</span></div>
    <div class="cover-item"><strong>CA prévisionnel An 1</strong><span>${fmt(fin.ca1)}</span></div>
    <div class="cover-item"><strong>Contact</strong><span>${data.email}</span></div>
  </div>
</div>

<div class="body">

<!-- KPIs -->
<div class="kpi-row">
  <div class="kpi"><div class="kpi-label">CA Année 1</div><div class="kpi-value">${fmt(fin.ca1)}</div><div class="kpi-sub">+${Math.round((fin.ca2/fin.ca1-1)*100)}% en An 2</div></div>
  <div class="kpi"><div class="kpi-label">Résultat net An 1</div><div class="kpi-value" style="color:${fin.rn1>=0?'#166534':'#991B1B'}">${fmt(fin.rn1)}</div><div class="kpi-sub">${fin.ca1>0?Math.round(fin.rn1/fin.ca1*100):0}% du CA</div></div>
  <div class="kpi"><div class="kpi-label">Seuil de rentabilité</div><div class="kpi-value">${fmt(fin.sr1)}</div><div class="kpi-sub">Point mort An 1</div></div>
  <div class="kpi"><div class="kpi-label">Emprunt demandé</div><div class="kpi-value">${fmt(fin.capital)}</div><div class="kpi-sub">${data.duree || 60} mois à ${data.taux || 4.5}%</div></div>
</div>

<!-- 01 RÉSUMÉ EXÉCUTIF -->
<div class="section">
  <div class="section-header"><span class="section-num">01</span><span class="section-title">Résumé exécutif</span></div>
  ${section(aiSections.resume)}
</div>

<!-- 02 PORTEUR -->
<div class="section">
  <div class="section-header"><span class="section-num">02</span><span class="section-title">Porteur de projet</span></div>
  ${section(aiSections.porteur)}
</div>

<!-- 03 PROJET -->
<div class="section page-break">
  <div class="section-header"><span class="section-num">03</span><span class="section-title">Présentation du projet</span></div>
  ${section(aiSections.projet)}
</div>

<!-- 04 MARCHÉ -->
<div class="section">
  <div class="section-header"><span class="section-num">04</span><span class="section-title">Étude de marché</span></div>
  ${section(aiSections.marche)}
</div>

<!-- 05 INVESTISSEMENTS -->
<div class="section page-break">
  <div class="section-header"><span class="section-num">05</span><span class="section-title">Investissements et financement</span></div>
  <div class="sub-title">Plan d'investissement</div>
  <table>
    <thead><tr><th>Poste</th><th style="text-align:right">Montant HT</th></tr></thead>
    <tbody>
      ${fin.fraisEtab>0?`<tr><td>Frais d'établissement</td><td class="num">${fmt(fin.fraisEtab)}</td></tr>`:''}
      ${fin.materiel>0?`<tr><td>Matériel / équipements</td><td class="num">${fmt(fin.materiel)}</td></tr>`:''}
      ${fin.travaux>0?`<tr><td>Travaux et aménagements</td><td class="num">${fmt(fin.travaux)}</td></tr>`:''}
      ${fin.mobilier>0?`<tr><td>Mobilier / matériel bureau</td><td class="num">${fmt(fin.mobilier)}</td></tr>`:''}
      ${fin.logiciels>0?`<tr><td>Logiciels / formations</td><td class="num">${fmt(fin.logiciels)}</td></tr>`:''}
      ${fin.comm>0?`<tr><td>Communication / site web</td><td class="num">${fmt(fin.comm)}</td></tr>`:''}
      ${fin.stock>0?`<tr><td>Stock initial</td><td class="num">${fmt(fin.stock)}</td></tr>`:''}
      ${fin.caution>0?`<tr><td>Caution / dépôt de garantie</td><td class="num">${fmt(fin.caution)}</td></tr>`:''}
      ${fin.tresorerie>0?`<tr><td>Trésorerie de départ</td><td class="num">${fmt(fin.tresorerie)}</td></tr>`:''}
      <tr style="${totalStyle}"><td><strong>TOTAL BESOINS</strong></td><td class="num"><strong>${fmt(fin.totalInvest)}</strong></td></tr>
    </tbody>
  </table>
  <div class="sub-title">Plan de financement</div>
  <table>
    <thead><tr><th>Source</th><th style="text-align:right">Montant</th></tr></thead>
    <tbody>
      <tr><td>Apport personnel</td><td class="num">${fmt(fin.apport)}</td></tr>
      ${fin.capital>0?`<tr><td>Emprunt bancaire (${data.taux||4.5}% — ${data.duree||60} mois — ${fmt(fin.mensualite)}/mois)</td><td class="num">${fmt(fin.capital)}</td></tr>`:''}
      ${data.aides?`<tr><td>Aides / Subventions : ${data.aides}</td><td class="num">Voir détail</td></tr>`:''}
      <tr style="${totalStyle}"><td><strong>TOTAL RESSOURCES</strong></td><td class="num"><strong>${fmt(fin.totalRessources)}</strong></td></tr>
      <tr style="background:#DCFCE7;font-weight:600;padding:8px 12px;"><td style="padding:8px 12px;color:#166534;"><strong>SOLDE (Ressources - Besoins)</strong></td><td class="num positive" style="padding:8px 12px;">${fmt(fin.totalRessources - fin.totalInvest)}</td></tr>
    </tbody>
  </table>
</div>

<!-- 06 PRÉVISIONNEL FINANCIER -->
<div class="section page-break">
  <div class="section-header"><span class="section-num">06</span><span class="section-title">Prévisionnel financier sur 3 ans</span></div>
  <div class="sub-title">Compte de résultats prévisionnel</div>
  <table>
    <thead><tr><th></th><th style="text-align:right">Année 1</th><th style="text-align:right">Année 2</th><th style="text-align:right">Année 3</th></tr></thead>
    <tbody>
      <tr style="${headStyle}"><td style="${headStyle}">Produits d'exploitation</td><td style="${headStyle}"></td><td style="${headStyle}"></td><td style="${headStyle}"></td></tr>
      <tr><td>Chiffre d'affaires HT</td><td class="num">${fmt(fin.ca1)}</td><td class="num">${fmt(fin.ca2)}</td><td class="num">${fmt(fin.ca3)}</td></tr>
      <tr><td>Charges variables (${fin.cvPct}% du CA)</td><td class="num">${fmt(fin.cv1)}</td><td class="num">${fmt(fin.cv2)}</td><td class="num">${fmt(fin.cv3)}</td></tr>
      <tr style="${totalStyle}"><td>Marge brute</td><td class="num">${fmt(fin.mb1)}</td><td class="num">${fmt(fin.mb2)}</td><td class="num">${fmt(fin.mb3)}</td></tr>
      <tr style="${headStyle}"><td style="${headStyle}">Charges d'exploitation</td><td style="${headStyle}"></td><td style="${headStyle}"></td><td style="${headStyle}"></td></tr>
      ${fin.loyer?`<tr><td>Loyer et charges</td><td class="num">${fmt(fin.loyer)}</td><td class="num">${fmt(fin.loyer)}</td><td class="num">${fmt(fin.loyer)}</td></tr>`:''}
      ${fin.assurance?`<tr><td>Assurances</td><td class="num">${fmt(fin.assurance)}</td><td class="num">${fmt(fin.assurance)}</td><td class="num">${fmt(fin.assurance)}</td></tr>`:''}
      ${fin.tel?`<tr><td>Téléphone / Internet</td><td class="num">${fmt(fin.tel)}</td><td class="num">${fmt(fin.tel)}</td><td class="num">${fmt(fin.tel)}</td></tr>`:''}
      ${fin.compta?`<tr><td>Expert-comptable</td><td class="num">${fmt(fin.compta)}</td><td class="num">${fmt(fin.compta)}</td><td class="num">${fmt(fin.compta)}</td></tr>`:''}
      ${fin.pub?`<tr><td>Publicité / Communication</td><td class="num">${fmt(fin.pub)}</td><td class="num">${fmt(fin.pub)}</td><td class="num">${fmt(fin.pub)}</td></tr>`:''}
      ${fin.autres?`<tr><td>Autres charges fixes</td><td class="num">${fmt(fin.autres)}</td><td class="num">${fmt(fin.autres)}</td><td class="num">${fmt(fin.autres)}</td></tr>`:''}
      ${fin.salAnnuel>0?`<tr><td>Rémunération dirigeant (${data.salaire||0} €/mois net)</td><td class="num">${fmt(fin.salAnnuel)}</td><td class="num">${fmt(fin.salAnnuel)}</td><td class="num">${fmt(fin.salAnnuel)}</td></tr>`:''}
      ${fin.chargesSoc>0?`<tr><td>Charges sociales dirigeant (~45%)</td><td class="num">${fmt(fin.chargesSoc)}</td><td class="num">${fmt(fin.chargesSoc)}</td><td class="num">${fmt(fin.chargesSoc)}</td></tr>`:''}
      <tr style="${totalStyle}"><td>EBE (Excédent Brut d'Exploitation)</td><td class="num">${fmt(fin.ebe1)}</td><td class="num">${fmt(fin.ebe2)}</td><td class="num">${fmt(fin.ebe3)}</td></tr>
      <tr><td>Dotations aux amortissements</td><td class="num">${fmt(fin.amort)}</td><td class="num">${fmt(fin.amort)}</td><td class="num">${fmt(fin.amort)}</td></tr>
      <tr><td>Charges financières (intérêts)</td><td class="num">${fmt(fin.intAn1)}</td><td class="num">${fmt(fin.intAn2)}</td><td class="num">${fmt(fin.intAn3)}</td></tr>
      <tr style="${totalStyle}"><td>Résultat avant IS</td><td class="num">${fmt(fin.ravt1)}</td><td class="num">${fmt(fin.ravt2)}</td><td class="num">${fmt(fin.ravt3)}</td></tr>
      <tr><td>Impôt sur les sociétés (IS)</td><td class="num">${fmt(fin.is1)}</td><td class="num">${fmt(fin.is2)}</td><td class="num">${fmt(fin.is3)}</td></tr>
      <tr style="${totalStyle}"><td><strong>RÉSULTAT NET COMPTABLE</strong></td><td class="num positive">${fmt(fin.rn1)}</td><td class="num positive">${fmt(fin.rn2)}</td><td class="num positive">${fmt(fin.rn3)}</td></tr>
    </tbody>
  </table>

  <div class="sub-title">Capacité d'autofinancement (CAF)</div>
  <table>
    <thead><tr><th></th><th style="text-align:right">An 1</th><th style="text-align:right">An 2</th><th style="text-align:right">An 3</th></tr></thead>
    <tbody>
      <tr><td>Résultat net</td><td class="num">${fmt(fin.rn1)}</td><td class="num">${fmt(fin.rn2)}</td><td class="num">${fmt(fin.rn3)}</td></tr>
      <tr><td>+ Amortissements</td><td class="num">${fmt(fin.amort)}</td><td class="num">${fmt(fin.amort)}</td><td class="num">${fmt(fin.amort)}</td></tr>
      <tr style="${totalStyle}"><td>CAF</td><td class="num">${fmt(fin.caf1)}</td><td class="num">${fmt(fin.caf2)}</td><td class="num">${fmt(fin.caf3)}</td></tr>
      <tr><td>- Remboursement emprunt annuel</td><td class="num">${fmt(fin.remboAnnuel)}</td><td class="num">${fmt(fin.remboAnnuel)}</td><td class="num">${fmt(fin.remboAnnuel)}</td></tr>
      <tr style="background:#DCFCE7;font-weight:600;"><td style="padding:8px 12px;color:#166534;">Autofinancement net</td><td class="num positive" style="padding:8px 12px;">${fmt(fin.caf1-fin.remboAnnuel)}</td><td class="num positive" style="padding:8px 12px;">${fmt(fin.caf2-fin.remboAnnuel)}</td><td class="num positive" style="padding:8px 12px;">${fmt(fin.caf3-fin.remboAnnuel)}</td></tr>
    </tbody>
  </table>

  <div class="callout">
    <strong>Seuil de rentabilité An 1 :</strong> ${fmt(fin.sr1)} —
    Le CA prévisionnel (${fmt(fin.ca1)}) dépasse le seuil de <strong>${fin.ca1>0&&fin.sr1>0?Math.round((fin.ca1/fin.sr1-1)*100):0}%</strong>.
    ${fin.caf1>fin.remboAnnuel
      ? `La CAF couvre le remboursement avec un ratio de <strong>${(fin.caf1/fin.remboAnnuel).toFixed(1)}x</strong> — capacité de remboursement solide et rassurante.`
      : 'Attention : surveiller la trésorerie en An 1.'
    }
  </div>
</div>

<!-- 07 STRATÉGIE -->
<div class="section page-break">
  <div class="section-header"><span class="section-num">07</span><span class="section-title">Stratégie commerciale et organisation</span></div>
  ${section(aiSections.strategie)}
</div>

<!-- 08 RISQUES -->
<div class="section">
  <div class="section-header"><span class="section-num">08</span><span class="section-title">Analyse des risques et mesures correctives</span></div>
  ${section(aiSections.risques)}
</div>

</div><!-- /body -->

<div class="footer">
  Business Plan généré par PlanIA · ${today} · Document confidentiel
</div>
</body>
</html>`;
}

module.exports = { generateBusinessPlanHTML };
