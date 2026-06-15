// lib/excelGenerator.js
// Génère le fichier Excel financier et retourne son contenu en base64
// Utilise ExcelJS (à ajouter dans package.json)

const { calcFinancials } = require('./financials');

function generateExcelBase64(data, fin) {
  return new Promise(async (resolve) => {
    try {
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      wb.creator = 'PlanIA';
      wb.created = new Date();

      // ── COULEURS ──────────────────────────────────────────────────
      const DARK_BLUE  = '0F2540';
      const MID_BLUE   = '1A3A5C';
      const LIGHT_BLUE = 'EBF4FF';
      const GOLD       = 'C8973A';
      const GOLD_LIGHT = 'FFF8EC';
      const GREEN      = '276749';
      const GREEN_L    = 'F0FFF4';
      const WHITE      = 'FFFFFF';
      const LIGHT_GRAY = 'F7FAFC';
      const INPUT_BLUE = '0000CC';

      const moneyFmt = '# ##0" €";(# ##0" €");"-"';
      const pctFmt = '0.0%';

      function cell(ws, row, col, value, opts = {}) {
        const c = ws.getCell(row, col);
        c.value = value;
        if (opts.bold) c.font = { ...c.font, bold: true };
        if (opts.size) c.font = { ...c.font, size: opts.size };
        if (opts.color) c.font = { ...c.font, color: { argb: 'FF' + opts.color } };
        if (opts.bg) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + opts.bg } };
        if (opts.fmt) c.numFmt = opts.fmt;
        if (opts.h) c.alignment = { ...c.alignment, horizontal: opts.h };
        if (opts.wrap) c.alignment = { ...c.alignment, wrapText: true };
        c.alignment = { vertical: 'middle', ...c.alignment };
        const borderStyle = { style: 'thin', color: { argb: 'FFE2E8F0' } };
        c.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };
        return c;
      }

      function headerRow(ws, row, cols, titles) {
        titles.forEach((title, i) => {
          const c = ws.getCell(row, cols[i]);
          c.value = title;
          c.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + MID_BLUE } };
          c.alignment = { horizontal: 'center', vertical: 'middle' };
          const b = { style: 'thin', color: { argb: 'FFE2E8F0' } };
          c.border = { top: b, left: b, bottom: b, right: b };
        });
        ws.getRow(row).height = 22;
      }

      function mergeTitle(ws, row, c1, c2, title, bg = DARK_BLUE) {
        ws.mergeCells(row, c1, row, c2);
        const c = ws.getCell(row, c1);
        c.value = title;
        c.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(row).height = 26;
      }

      // ═══════════════════════════════════════════════════════════════
      // FEUILLE 1 — HYPOTHÈSES & INVESTISSEMENTS
      // ═══════════════════════════════════════════════════════════════
      const ws1 = wb.addWorksheet('1. Hypothèses & Investissements');
      ws1.showGridLines = false;
      ws1.getColumn(1).width = 2;
      ws1.getColumn(2).width = 40;
      ws1.getColumn(3).width = 18;
      ws1.getColumn(4).width = 16;
      ws1.getColumn(5).width = 18;

      // Titre
      ws1.mergeCells(1, 1, 1, 5);
      const t1 = ws1.getCell(1, 1);
      t1.value = `HYPOTHÈSES FINANCIÈRES — ${(data.nomProjet||'').toUpperCase()}`;
      t1.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
      t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + DARK_BLUE } };
      t1.alignment = { horizontal: 'center', vertical: 'middle' };
      ws1.getRow(1).height = 36;

      ws1.mergeCells(2, 1, 2, 5);
      const t2 = ws1.getCell(2, 1);
      t2.value = `${data.prenom||''} ${data.nom||''} · ${data.juridique||''} · ${data.ville||''} · Lancement : ${data.lancement||'À définir'}`;
      t2.font = { size: 9, color: { argb: 'FF718096' }, italic: true, name: 'Arial' };
      t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAFC' } };
      t2.alignment = { horizontal: 'center', vertical: 'middle' };

      // ── INVESTISSEMENTS ──
      let r = 4;
      mergeTitle(ws1, r, 2, 5, 'PLAN D\'INVESTISSEMENT', MID_BLUE);
      r++;
      headerRow(ws1, r, [2,3,4,5], ["Poste d'investissement", "Montant HT (€)", "Amort. (ans)", "Amort. annuel (€)"]);
      r++;

      const invData = [
        ["Frais d'établissement", data.fraisEtab||0, 5],
        ["Matériel et équipements", data.materiel||0, 5],
        ["Travaux et aménagements", data.travaux||0, 10],
        ["Mobilier et matériel bureau", data.mobilier||0, 5],
        ["Logiciels et formations", data.logiciels||0, 3],
        ["Communication et site web", data.comm||0, 3],
        ["Stock initial", data.stock||0, 1],
        ["Caution et dépôt de garantie", data.caution||0, 1],
        ["Trésorerie de départ", data.tresorerie||0, 0],
      ];
      const invStart = r;
      invData.forEach(([label, val, amortAns], i) => {
        const bg = i % 2 === 0 ? WHITE : LIGHT_GRAY;
        cell(ws1, r, 2, label, { bg });
        const cv = ws1.getCell(r, 3);
        cv.value = val || null;
        cv.font = { size: 10, color: { argb: 'FF' + INPUT_BLUE }, name: 'Arial' };
        cv.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
        cv.numFmt = moneyFmt; cv.alignment = { horizontal: 'right', vertical: 'middle' };
        const b = { style: 'thin', color: { argb: 'FFE2E8F0' } };
        cv.border = { top: b, left: b, bottom: b, right: b };

        cell(ws1, r, 4, amortAns || null, { bg, h: 'center' });
        const ca = ws1.getCell(r, 5);
        ca.value = amortAns > 0 && val > 0 ? { formula: `C${r}/${amortAns}` } : null;
        ca.font = { size: 10, name: 'Arial' };
        ca.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
        ca.numFmt = moneyFmt; ca.alignment = { horizontal: 'right', vertical: 'middle' };
        ca.border = { top: b, left: b, bottom: b, right: b };
        ws1.getRow(r).height = 18;
        r++;
      });

      const totalR = r;
      cell(ws1, r, 2, 'TOTAL BESOINS', { bold: true, bg: GOLD_LIGHT, color: DARK_BLUE });
      const totC = ws1.getCell(r, 3);
      totC.value = { formula: `SUM(C${invStart}:C${r-1})` };
      totC.font = { bold: true, size: 10, color: { argb: 'FF' + DARK_BLUE }, name: 'Arial' };
      totC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + GOLD_LIGHT } };
      totC.numFmt = moneyFmt; totC.alignment = { horizontal: 'right', vertical: 'middle' };
      const bGold = { style: 'medium', color: { argb: 'FF' + GOLD } };
      const bThin = { style: 'thin', color: { argb: 'FFE2E8F0' } };
      totC.border = { top: bGold, left: bThin, bottom: bGold, right: bThin };
      ws1.getRow(r).height = 22;
      r += 2;

      // ── FINANCEMENT ──
      mergeTitle(ws1, r, 2, 5, 'PLAN DE FINANCEMENT', MID_BLUE);
      r++;
      headerRow(ws1, r, [2,3,4], ["Source", "Montant (€)", "% du total"]);
      r++;

      const finData = [
        ["Apport personnel", data.apport||0],
        ["Emprunt bancaire", data.emprunt||0],
        ["Subventions et aides", 0],
      ];
      const finStart = r;
      finData.forEach(([label, val], i) => {
        const bg = i % 2 === 0 ? WHITE : LIGHT_GRAY;
        cell(ws1, r, 2, label, { bg });
        const cv = ws1.getCell(r, 3);
        cv.value = val || null;
        cv.font = { size: 10, color: { argb: 'FF' + INPUT_BLUE }, name: 'Arial' };
        cv.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
        cv.numFmt = moneyFmt; cv.alignment = { horizontal: 'right', vertical: 'middle' };
        const b = { style: 'thin', color: { argb: 'FFE2E8F0' } };
        cv.border = { top: b, left: b, bottom: b, right: b };
        const pc = ws1.getCell(r, 4);
        pc.value = { formula: `IF(SUM(C${finStart}:C${finStart+2})=0,0,C${r}/SUM(C${finStart}:C${finStart+2}))` };
        pc.font = { size: 10, name: 'Arial' };
        pc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
        pc.numFmt = pctFmt; pc.alignment = { horizontal: 'right', vertical: 'middle' };
        pc.border = { top: b, left: b, bottom: b, right: b };
        ws1.getRow(r).height = 18;
        r++;
      });

      const totFinR = r;
      cell(ws1, r, 2, 'TOTAL RESSOURCES', { bold: true, bg: GREEN_L, color: GREEN });
      const totFin = ws1.getCell(r, 3);
      totFin.value = { formula: `SUM(C${finStart}:C${r-1})` };
      totFin.font = { bold: true, size: 10, color: { argb: 'FF' + GREEN }, name: 'Arial' };
      totFin.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + GREEN_L } };
      totFin.numFmt = moneyFmt; totFin.alignment = { horizontal: 'right', vertical: 'middle' };
      const bG = { style: 'thin', color: { argb: 'FFE2E8F0' } };
      totFin.border = { top: bG, left: bG, bottom: bG, right: bG };
      ws1.getRow(r).height = 22;
      r++;

      cell(ws1, r, 2, 'SOLDE (Ressources - Besoins)', { bold: true, bg: LIGHT_BLUE, color: MID_BLUE });
      const solde = ws1.getCell(r, 3);
      solde.value = { formula: `C${totFinR}-C${totalR}` };
      solde.font = { bold: true, size: 10, color: { argb: 'FF' + MID_BLUE }, name: 'Arial' };
      solde.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + LIGHT_BLUE } };
      solde.numFmt = moneyFmt; solde.alignment = { horizontal: 'right', vertical: 'middle' };
      solde.border = { top: bG, left: bG, bottom: bG, right: bG };

      // ═══════════════════════════════════════════════════════════════
      // FEUILLE 2 — COMPTE DE RÉSULTAT
      // ═══════════════════════════════════════════════════════════════
      const ws2 = wb.addWorksheet('2. Compte de Résultat');
      ws2.showGridLines = false;
      ws2.getColumn(1).width = 2;
      ws2.getColumn(2).width = 42;
      ws2.getColumn(3).width = 18;
      ws2.getColumn(4).width = 18;
      ws2.getColumn(5).width = 18;

      ws2.mergeCells(1, 1, 1, 5);
      const t2a = ws2.getCell(1, 1);
      t2a.value = `COMPTE DE RÉSULTATS PRÉVISIONNEL — ${(data.nomProjet||'').toUpperCase()}`;
      t2a.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
      t2a.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + DARK_BLUE } };
      t2a.alignment = { horizontal: 'center', vertical: 'middle' };
      ws2.getRow(1).height = 36;

      let r2 = 3;
      headerRow(ws2, r2, [2,3,4,5], ['LIBELLÉ', 'ANNÉE 1', 'ANNÉE 2', 'ANNÉE 3']);
      r2++;

      const cvPct = (data.cvPct || 21) / 100;
      const salAn = (data.salaire || 0) * 12;
      const chargesSoc = Math.round(salAn * 0.45);

      function crLine(ws, r, label, v1, v2, v3, opts = {}) {
        const bg = opts.total ? GOLD_LIGHT : opts.positive ? GREEN_L : opts.head ? LIGHT_BLUE : (r % 2 === 0 ? WHITE : LIGHT_GRAY);
        const color = opts.total ? DARK_BLUE : opts.positive ? GREEN : opts.head ? MID_BLUE : '4A5568';
        const bStyle = { style: 'thin', color: { argb: 'FFE2E8F0' } };
        const c2 = ws.getCell(r, 2);
        c2.value = label;
        c2.font = { bold: !!opts.bold, size: 10, color: { argb: 'FF' + color }, name: 'Arial' };
        c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
        c2.alignment = { vertical: 'middle' };
        c2.border = { top: bStyle, left: bStyle, bottom: bStyle, right: bStyle };
        [3,4,5].forEach((col, i) => {
          const vals = [v1, v2, v3];
          const cv = ws.getCell(r, col);
          cv.value = vals[i];
          cv.font = { bold: !!opts.bold, size: 10, color: { argb: 'FF' + color }, name: 'Arial' };
          cv.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
          cv.numFmt = moneyFmt;
          cv.alignment = { horizontal: 'right', vertical: 'middle' };
          cv.border = { top: bStyle, left: bStyle, bottom: bStyle, right: bStyle };
        });
        ws.getRow(r).height = 18;
        return r + 1;
      }

      const ca1 = data.ca1 || 0, ca2 = fin.ca2 || 0, ca3 = fin.ca3 || 0;
      const caRow = r2;
      r2 = crLine(ws2, r2, 'Chiffre d\'affaires HT', ca1, ca2, ca3, {});

      const cvRow = r2;
      r2 = crLine(ws2, r2, `Charges variables (${data.cvPct||21}% du CA)`,
        { formula: `C${caRow}*${cvPct}` }, { formula: `D${caRow}*${cvPct}` }, { formula: `E${caRow}*${cvPct}` });

      const mbRow = r2;
      r2 = crLine(ws2, r2, 'MARGE BRUTE',
        { formula: `C${caRow}-C${cvRow}` }, { formula: `D${caRow}-D${cvRow}` }, { formula: `E${caRow}-E${cvRow}` },
        { total: true, bold: true });

      const charges = [
        ['Loyer et charges', data.loyer||0],
        ['Assurances', data.assurance||0],
        ['Téléphone / Internet', data.tel||0],
        ['Expert-comptable', data.compta||0],
        ['Publicité / Communication', data.pub||0],
        ['Autres charges fixes', data.autresCharges||0],
      ];
      const cfStart = r2;
      charges.forEach(([label, val]) => {
        r2 = crLine(ws2, r2, label, val, val, val);
      });
      r2 = crLine(ws2, r2, `Rémunération dirigeant (${data.salaire||0} €/mois net)`, salAn, salAn, salAn);
      r2 = crLine(ws2, r2, 'Charges sociales dirigeant (~45%)', chargesSoc, chargesSoc, chargesSoc);
      const cfEnd = r2 - 1;

      const ebeRow = r2;
      r2 = crLine(ws2, r2, 'EBE — EXCÉDENT BRUT D\'EXPLOITATION',
        { formula: `C${mbRow}-SUM(C${cfStart}:C${cfEnd})` },
        { formula: `D${mbRow}-SUM(D${cfStart}:D${cfEnd})` },
        { formula: `E${mbRow}-SUM(E${cfStart}:E${cfEnd})` },
        { total: true, bold: true });

      // Amortissements
      let amortAn = 0;
      [[data.fraisEtab||0,5],[data.materiel||0,5],[data.travaux||0,10],[data.mobilier||0,5],[data.logiciels||0,3],[data.comm||0,3]]
        .forEach(([v,a]) => { if (a>0) amortAn += Math.round(v/a); });
      const amortRow = r2;
      r2 = crLine(ws2, r2, 'Dotations aux amortissements', amortAn, amortAn, amortAn);

      const intAn1 = Math.round((data.emprunt||0)*(data.taux||4.5)/100);
      const intAn2 = Math.round(intAn1*0.65), intAn3 = Math.round(intAn1*0.35);
      const intRow = r2;
      r2 = crLine(ws2, r2, 'Charges financières (intérêts)', intAn1, intAn2, intAn3);

      const ravtRow = r2;
      r2 = crLine(ws2, r2, 'RÉSULTAT AVANT IMPÔTS',
        { formula: `C${ebeRow}-C${amortRow}-C${intRow}` },
        { formula: `D${ebeRow}-D${amortRow}-D${intRow}` },
        { formula: `E${ebeRow}-E${amortRow}-E${intRow}` },
        { head: true, bold: true });

      const isFormula = (col) => `IF(${col}${ravtRow}<=0,0,IF(${col}${ravtRow}<=42500,${col}${ravtRow}*0.15,42500*0.15+(${col}${ravtRow}-42500)*0.25))`;
      const isRow = r2;
      r2 = crLine(ws2, r2, 'Impôt sur les sociétés (IS)',
        { formula: isFormula('C') }, { formula: isFormula('D') }, { formula: isFormula('E') });

      const rnRow = r2;
      r2 = crLine(ws2, r2, 'RÉSULTAT NET COMPTABLE',
        { formula: `C${ravtRow}-C${isRow}` }, { formula: `D${ravtRow}-D${isRow}` }, { formula: `E${ravtRow}-E${isRow}` },
        { positive: true, bold: true });

      // CAF
      r2++;
      const cafStart = r2;
      r2 = crLine(ws2, r2, 'Résultat net', { formula: `C${rnRow}` }, { formula: `D${rnRow}` }, { formula: `E${rnRow}` });
      r2 = crLine(ws2, r2, '+ Amortissements', amortAn, amortAn, amortAn);
      const cafRow = r2;
      r2 = crLine(ws2, r2, 'CAPACITÉ D\'AUTOFINANCEMENT (CAF)',
        { formula: `SUM(C${cafStart}:C${r2-1})` }, { formula: `SUM(D${cafStart}:D${r2-1})` }, { formula: `SUM(E${cafStart}:E${r2-1})` },
        { positive: true, bold: true });

      // Seuil de rentabilité
      r2++;
      const tmcvRow = r2;
      r2 = crLine(ws2, r2, 'Taux de marge sur coûts variables',
        { formula: `IF(C${caRow}=0,0,(C${caRow}-C${cvRow})/C${caRow})` },
        { formula: `IF(D${caRow}=0,0,(D${caRow}-D${cvRow})/D${caRow})` },
        { formula: `IF(E${caRow}=0,0,(E${caRow}-E${cvRow})/E${caRow})` });
      [3,4,5].forEach(col => {
        ws2.getCell(r2-1, col).numFmt = pctFmt;
      });
      const cfTotRow = r2;
      r2 = crLine(ws2, r2, 'Coûts fixes totaux',
        { formula: `SUM(C${cfStart}:C${cfEnd})+C${amortRow}+C${intRow}` },
        { formula: `SUM(D${cfStart}:D${cfEnd})+D${amortRow}+D${intRow}` },
        { formula: `SUM(E${cfStart}:E${cfEnd})+E${amortRow}+E${intRow}` });
      r2 = crLine(ws2, r2, 'SEUIL DE RENTABILITÉ',
        { formula: `IF(C${tmcvRow}=0,0,C${cfTotRow}/C${tmcvRow})` },
        { formula: `IF(D${tmcvRow}=0,0,D${cfTotRow}/D${tmcvRow})` },
        { formula: `IF(E${tmcvRow}=0,0,E${cfTotRow}/E${tmcvRow})` },
        { total: true, bold: true });

      // ═══════════════════════════════════════════════════════════════
      // FEUILLE 3 — TRÉSORERIE MENSUELLE
      // ═══════════════════════════════════════════════════════════════
      const ws3 = wb.addWorksheet('3. Trésorerie Mensuelle An 1');
      ws3.showGridLines = false;
      ws3.getColumn(1).width = 2;
      ws3.getColumn(2).width = 32;
      const months = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc','TOTAL'];
      months.forEach((_, i) => { ws3.getColumn(i+3).width = 11; });

      ws3.mergeCells(1, 1, 1, 15);
      const t3 = ws3.getCell(1, 1);
      t3.value = `PLAN DE TRÉSORERIE MENSUEL — ANNÉE 1 — ${(data.nomProjet||'').toUpperCase()}`;
      t3.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
      t3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + DARK_BLUE } };
      t3.alignment = { horizontal: 'center', vertical: 'middle' };
      ws3.getRow(1).height = 30;

      let r3 = 3;
      headerRow(ws3, r3, Array.from({length:14},(_, i)=>i+2), ['',...months]);
      ws3.getRow(r3).height = 22;
      r3++;

      const caMensuel = Math.round(ca1/12);
      const cvMensuel = Math.round(ca1*cvPct/12);
      const cfMensuel = Math.round(((data.loyer||0)+(data.assurance||0)+(data.tel||0)+(data.compta||0)+(data.pub||0)+(data.autresCharges||0))/12);
      const dirMensuel = Math.round((salAn+chargesSoc)/12);
      const taux = (data.taux||4.5)/100;
      const tauxM = taux/12;
      const capital = data.emprunt||0;
      const duree = data.duree||60;
      const mensualite = capital > 0 && tauxM > 0 ? Math.round(capital*tauxM/(1-Math.pow(1+tauxM,-duree))) : (capital>0?Math.round(capital/duree):0);
      const invTotal = (data.fraisEtab||0)+(data.materiel||0)+(data.travaux||0)+(data.mobilier||0)+(data.logiciels||0)+(data.comm||0)+(data.stock||0)+(data.caution||0);

      function tresoLine(ws, r, label, vals, opts = {}) {
        const bg = opts.enc ? 'F0FFF4' : opts.dec ? 'FEF2F2' : opts.total ? GOLD_LIGHT : opts.cum ? GREEN_L : opts.solde ? LIGHT_BLUE : (r%2===0?WHITE:LIGHT_GRAY);
        const color = opts.enc ? GREEN : opts.dec ? 'C53030' : opts.total ? DARK_BLUE : opts.cum ? GREEN : opts.solde ? MID_BLUE : '4A5568';
        const bStyle = { style: 'thin', color: { argb: 'FFE2E8F0' } };
        const c = ws.getCell(r, 2);
        c.value = label;
        c.font = { bold: !!opts.bold, size: 9, color: { argb: 'FF' + color }, name: 'Arial' };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
        c.alignment = { vertical: 'middle' };
        c.border = { top: bStyle, left: bStyle, bottom: bStyle, right: bStyle };
        vals.forEach((v, i) => {
          const cv = ws.getCell(r, i+3);
          cv.value = v;
          cv.font = { bold: !!opts.bold, size: 9, color: { argb: 'FF' + (opts.input ? INPUT_BLUE : color) }, name: 'Arial' };
          cv.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
          cv.numFmt = moneyFmt;
          cv.alignment = { horizontal: 'right', vertical: 'middle' };
          cv.border = { top: bStyle, left: bStyle, bottom: bStyle, right: bStyle };
        });
        ws.getRow(r).height = 18;
        return r + 1;
      }

      // Encaissements
      const apportVals = [(data.apport||0)+capital, ...Array(11).fill(null), { formula:`SUM(C${r3}:N${r3})` }];
      const apportRow = r3;
      r3 = tresoLine(ws3, r3, 'Apport + Emprunt (mois 1)', apportVals, { input: true });

      const caVals = [...Array(12).fill(caMensuel), { formula:`SUM(C${r3}:N${r3})` }];
      const caTresoRow = r3;
      r3 = tresoLine(ws3, r3, 'Chiffre d\'affaires mensuel', caVals, { input: true });

      const encTotalRow = r3;
      const encVals = [...Array(12).fill(null).map((_,i)=>({ formula:`C${apportRow+i<apportRow+1?apportRow:r3-2}+C${caTresoRow}`.replace('C','ABCDEFGHIJKLMN'[i+2])+'TODO' })), {formula:`SUM(C${r3}:N${r3})`}];
      // Simple: somme des 2 lignes précédentes
      const encValsSimple = Array.from({length:12},(_,i)=>({ formula:`${['C','D','E','F','G','H','I','J','K','L','M','N'][i]}${apportRow}+${['C','D','E','F','G','H','I','J','K','L','M','N'][i]}${caTresoRow}` }));
      encValsSimple.push({ formula:`SUM(C${r3}:N${r3})` });
      r3 = tresoLine(ws3, r3, 'TOTAL ENCAISSEMENTS', encValsSimple, { total: true, bold: true });
      const encTotR = r3 - 1;

      // Décaissements
      const invVals = [invTotal, ...Array(11).fill(null), { formula:`SUM(C${r3}:N${r3})` }];
      const invRow = r3;
      r3 = tresoLine(ws3, r3, 'Investissements initiaux (mois 1)', invVals, { input: true });
      const cvVals = [...Array(12).fill(cvMensuel), { formula:`SUM(C${r3}:N${r3})` }];
      const cvTRow = r3;
      r3 = tresoLine(ws3, r3, 'Charges variables', cvVals, { input: true });
      const cfVals = [...Array(12).fill(cfMensuel), { formula:`SUM(C${r3}:N${r3})` }];
      const cfTRow = r3;
      r3 = tresoLine(ws3, r3, 'Charges fixes', cfVals, { input: true });
      const dirVals = [...Array(12).fill(dirMensuel), { formula:`SUM(C${r3}:N${r3})` }];
      const dirTRow = r3;
      r3 = tresoLine(ws3, r3, 'Rémunération + charges sociales', dirVals, { input: true });
      const emprVals = [...Array(12).fill(mensualite), { formula:`SUM(C${r3}:N${r3})` }];
      const emprTRow = r3;
      r3 = tresoLine(ws3, r3, 'Remboursement emprunt', emprVals, { input: true });

      const decValsSimple = Array.from({length:12},(_,i)=>{
        const c = ['C','D','E','F','G','H','I','J','K','L','M','N'][i];
        return { formula:`${c}${invRow}+${c}${cvTRow}+${c}${cfTRow}+${c}${dirTRow}+${c}${emprTRow}` };
      });
      decValsSimple.push({ formula:`SUM(C${r3}:N${r3})` });
      r3 = tresoLine(ws3, r3, 'TOTAL DÉCAISSEMENTS', decValsSimple, { total: true, bold: true });
      const decTotR = r3 - 1;

      r3++;
      const soldeRow = r3;
      const soldeVals = Array.from({length:12},(_,i)=>{ const c=['C','D','E','F','G','H','I','J','K','L','M','N'][i]; return {formula:`${c}${encTotR}-${c}${decTotR}`}; });
      soldeVals.push({ formula:`SUM(C${r3}:N${r3})` });
      r3 = tresoLine(ws3, r3, 'SOLDE MENSUEL', soldeVals, { solde: true, bold: true });

      const cumRow = r3;
      const cumVals = Array.from({length:12},(_,i)=>{
        const c=['C','D','E','F','G','H','I','J','K','L','M','N'][i];
        if (i===0) return { formula:`C${soldeRow}` };
        const prev=['C','D','E','F','G','H','I','J','K','L','M','N'][i-1];
        return { formula:`${prev}${cumRow}+${c}${soldeRow}` };
      });
      cumVals.push(null);
      r3 = tresoLine(ws3, r3, 'TRÉSORERIE CUMULÉE', cumVals, { cum: true, bold: true });

      // ═══════════════════════════════════════════════════════════════
      // FEUILLE 4 — INDICATEURS CLÉS
      // ═══════════════════════════════════════════════════════════════
      const ws4 = wb.addWorksheet('4. Indicateurs Clés');
      ws4.showGridLines = false;
      ws4.getColumn(1).width = 2;
      ws4.getColumn(2).width = 42;
      ws4.getColumn(3).width = 20;
      ws4.getColumn(4).width = 20;
      ws4.getColumn(5).width = 20;

      ws4.mergeCells(1, 1, 1, 5);
      const t4 = ws4.getCell(1, 1);
      t4.value = 'TABLEAU DE BORD — INDICATEURS FINANCIERS CLÉS';
      t4.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
      t4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + DARK_BLUE } };
      t4.alignment = { horizontal: 'center', vertical: 'middle' };
      ws4.getRow(1).height = 36;

      let r4 = 3;
      headerRow(ws4, r4, [2,3,4,5], ['INDICATEUR', 'ANNÉE 1', 'ANNÉE 2', 'ANNÉE 3']);
      ws4.getRow(r4).height = 22;
      r4++;

      const kpis = [
        ['Chiffre d\'affaires HT', ca1, ca2, ca3, moneyFmt, false],
        ['Marge brute', fin.mb1, fin.mb2, fin.mb3, moneyFmt, false],
        ['Taux de marge brute', fin.tauxMVC/100, (fin.mb2/ca2)||0, (fin.mb3/ca3)||0, pctFmt, false],
        ['EBE', fin.ebe1, fin.ebe2, fin.ebe3, moneyFmt, false],
        ['Résultat net', fin.rn1, fin.rn2, fin.rn3, moneyFmt, true],
        ['Marge nette', ca1>0?fin.rn1/ca1:0, ca2>0?fin.rn2/ca2:0, ca3>0?fin.rn3/ca3:0, pctFmt, false],
        ['Seuil de rentabilité', fin.sr1, 0, 0, moneyFmt, false],
        ['Capacité d\'autofinancement', fin.caf1, fin.caf2, fin.caf3, moneyFmt, false],
        ['Ratio CAF / Remboursement', fin.remboAnnuel>0?fin.caf1/fin.remboAnnuel:0, fin.remboAnnuel>0?fin.caf2/fin.remboAnnuel:0, fin.remboAnnuel>0?fin.caf3/fin.remboAnnuel:0, '0.0"x"', false],
      ];

      kpis.forEach(([label, v1, v2, v3, fmt, highlight], i) => {
        const bg = highlight ? GOLD_LIGHT : (i%2===0?WHITE:LIGHT_GRAY);
        const color = highlight ? DARK_BLUE : '4A5568';
        const bStyle = { style: 'thin', color: { argb: 'FFE2E8F0' } };
        [2,3,4,5].forEach((col, j) => {
          const cv = ws4.getCell(r4, col);
          cv.value = j===0 ? label : [v1,v2,v3][j-1];
          cv.font = { bold: !!highlight, size: 10, color: { argb: 'FF' + color }, name: 'Arial' };
          cv.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
          if (j > 0) { cv.numFmt = fmt; cv.alignment = { horizontal: 'right', vertical: 'middle' }; }
          else { cv.alignment = { vertical: 'middle' }; }
          cv.border = { top: bStyle, left: bStyle, bottom: bStyle, right: bStyle };
        });
        ws4.getRow(r4).height = 20;
        r4++;
      });

      // Freeze panes
      [ws1,ws2,ws3,ws4].forEach(ws => { ws.views = [{ state: 'frozen', ySplit: 2, xSplit: 0 }]; });

      // Export en base64
      const buffer = await wb.xlsx.writeBuffer();
      resolve(Buffer.from(buffer).toString('base64'));

    } catch (err) {
      console.error('Excel generation error:', err);
      resolve(null);
    }
  });
}

module.exports = { generateExcelBase64 };
