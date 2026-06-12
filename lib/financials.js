// lib/financials.js
// Calculs financiers automatiques du business plan

function calcFinancials(data) {
  const ca1 = parseFloat(data.ca1) || 0;
  const growthStr = data.croissance || '+10% / +10%';
  const g = growthStr.match(/(\d+)/g) || ['10', '10'];
  const g2 = 1 + (parseFloat(g[0]) || 10) / 100;
  const g3 = 1 + (parseFloat(g[1] || g[0]) || 10) / 100;
  const ca2 = Math.round(ca1 * g2);
  const ca3 = Math.round(ca2 * g3);

  const cvPct = (parseFloat(data.cvPct) || 21) / 100;
  const cv1 = Math.round(ca1 * cvPct);
  const cv2 = Math.round(ca2 * cvPct);
  const cv3 = Math.round(ca3 * cvPct);
  const mb1 = ca1 - cv1, mb2 = ca2 - cv2, mb3 = ca3 - cv3;

  const loyer      = parseFloat(data.loyer) || 0;
  const assurance  = parseFloat(data.assurance) || 0;
  const tel        = parseFloat(data.tel) || 0;
  const compta     = parseFloat(data.compta) || 0;
  const pub        = parseFloat(data.pub) || 0;
  const autres     = parseFloat(data.autresCharges) || 0;
  const cf = loyer + assurance + tel + compta + pub + autres;

  const salNet      = parseFloat(data.salaire) || 0;
  const salAnnuel   = salNet * 12;
  const chargesSoc  = Math.round(salAnnuel * 0.45);
  const totalDir    = salAnnuel + chargesSoc;

  // Amortissements
  const materiel   = parseFloat(data.materiel) || 0;
  const travaux    = parseFloat(data.travaux) || 0;
  const mobilier   = parseFloat(data.mobilier) || 0;
  const logiciels  = parseFloat(data.logiciels) || 0;
  const comm       = parseFloat(data.comm) || 0;
  const fraisEtab  = parseFloat(data.fraisEtab) || 0;
  const amort = Math.round(
    materiel/5 + travaux/10 + mobilier/5 + logiciels/3 + comm/3 + fraisEtab/5
  );

  const ebe1 = mb1 - cf - totalDir;
  const ebe2 = mb2 - cf - totalDir;
  const ebe3 = mb3 - cf - totalDir;

  // Emprunt
  const capital  = parseFloat(data.emprunt) || 0;
  const taux     = (parseFloat(data.taux) || 4.5) / 100;
  const duree    = parseFloat(data.duree) || 60;
  const tauxM    = taux / 12;
  const mensualite = capital > 0
    ? capital * tauxM / (1 - Math.pow(1 + tauxM, -duree))
    : 0;
  const remboAnnuel = mensualite * 12;
  const intAn1 = capital * taux;
  const intAn2 = intAn1 * 0.65;
  const intAn3 = intAn1 * 0.35;

  const ravt1 = ebe1 - amort - intAn1;
  const ravt2 = ebe2 - amort - intAn2;
  const ravt3 = ebe3 - amort - intAn3;

  const calcIS = (r) => {
    if (r <= 0) return 0;
    return r <= 42500 ? r * 0.15 : 42500 * 0.15 + (r - 42500) * 0.25;
  };
  const is1 = calcIS(ravt1), is2 = calcIS(ravt2), is3 = calcIS(ravt3);
  const rn1 = ravt1 - is1, rn2 = ravt2 - is2, rn3 = ravt3 - is3;
  const caf1 = rn1 + amort, caf2 = rn2 + amort, caf3 = rn3 + amort;

  const coutsFixes = cf + totalDir + amort + intAn1;
  const tauxMVC = ca1 > 0 ? mb1 / ca1 : 0.79;
  const sr1 = tauxMVC > 0 ? coutsFixes / tauxMVC : 0;

  const stock      = parseFloat(data.stock) || 0;
  const caution    = parseFloat(data.caution) || 0;
  const tresorerie = parseFloat(data.tresorerie) || 0;
  const totalInvest = fraisEtab + materiel + travaux + mobilier +
    logiciels + comm + stock + caution + tresorerie;
  const apport = parseFloat(data.apport) || 0;
  const totalRessources = apport + capital;

  return {
    ca1, ca2, ca3, cv1, cv2, cv3, mb1, mb2, mb3,
    cf, totalDir, salAnnuel, chargesSoc,
    amort, ebe1, ebe2, ebe3,
    mensualite, remboAnnuel, intAn1, intAn2, intAn3,
    ravt1, ravt2, ravt3, is1, is2, is3,
    rn1, rn2, rn3, caf1, caf2, caf3,
    sr1, totalInvest, apport, capital, totalRessources,
    loyer, assurance, tel, compta, pub, autres,
    materiel, travaux, mobilier, logiciels, comm,
    fraisEtab, stock, caution, tresorerie,
    tauxMVC: Math.round(tauxMVC * 100),
    cvPct: Math.round(cvPct * 100),
  };
}

function fmt(n) {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(Math.round(n || 0)) + ' €';
}

module.exports = { calcFinancials, fmt };
