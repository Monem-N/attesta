// Wallonia attestation — template-driven piece generator.
const { PDFDocument, rgb } = globalThis.window?.PDFLib || {};
const W = 595.32;
const H = 841.92;
const M = 40;
const RIGHT = W - M;
const INK = rgb(0.086, 0.094, 0.114);
const SOFT = rgb(0.38, 0.40, 0.43);
const RED = rgb(0.698, 0.227, 0.169);
const GREEN = rgb(0.184, 0.42, 0.31);
const LINE = rgb(0.78, 0.78, 0.75);
const PAPER = rgb(1, 1, 1);
let fontRef = { regular: null, bold: null };
let A = null;
function yOf(page, v) { return page.getHeight() - v; }
function text(page, s, x, y, size, font, color = INK, maxWidth) {
  const v = String(s ?? '');
  if (!v) return;
  if (maxWidth && font && font.widthOfTextAtSize(v, size) > maxWidth && A) {
    A.warnings.push(`text overflows ${maxWidth}pt: ${v.slice(0, 40)}`);
  }
  page.drawText(v, { x, y: yOf(page, y), size, font, color });
  if (A && !A.printed.includes(`text:${v}`)) A.printed.push(`text:${v}`);
  return v;
}
function rule(page, x1, y, x2, color = LINE, thickness = 0.6) {
  page.drawRectangle({ x: x1, y: yOf(page, y), width: x2 - x1, height: thickness, color });
}
function band(page, label, y, color = RED) {
  text(page, label, M, y, 10.5, fontRef.bold, color, RIGHT - M);
  rule(page, M, y + 13, RIGHT, color, 1.1);
  return y + 26;
}
function fieldLine(page, label, value, y, valueW, size = 8.5, labelW = 120) {
  text(page, label, M, y, size, fontRef.regular, SOFT);
  const vx = M + labelW;
  rule(page, vx, y + 3, vx + valueW, LINE, 0.6);
  if (value === '' || value == null) return y + 14;
  const { lines } = wrapText(String(value), (s) => fontRef.regular.widthOfTextAtSize(s, size), Math.max(20, valueW - 4), 1);
  lines.forEach((line) => text(page, line, vx + 2, y - 0.5, size, fontRef.regular, INK));
  return y + 14;
}
function checkboxRow(page, label, y, checked, size = 8.5) {
  const s = 9;
  page.drawRectangle({ x: M, y: yOf(page, y + s), width: s, height: s, borderColor: INK, borderWidth: 0.8, color: PAPER });
  if (checked) {
    page.drawRectangle({ x: M + 1.4, y: yOf(page, y + s - 1.4), width: s - 2.8, height: s - 2.8, color: RED });
    if (A && !A.ticked.includes(label)) A.ticked.push(label);
  }
  text(page, label, M + s + 6, y, size, fontRef.regular, INK);
  return y + 14;
}
function radioOption(page, x, y, selected, size = 8.5) {
  const r = 4;
  page.drawCircle({ x, y: yOf(page, y), radius: r, borderColor: INK, borderWidth: 0.8, color: PAPER });
  if (selected) { page.drawCircle({ x, y: yOf(page, y), radius: r - 1.6, color: RED }); if (A) A.ticked.push(`radio:${x}:${y}`); }
  return x + 18;
}
function wrapText(text, widthOf, maxWidth, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = []; let cur = '';
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (widthOf(trial, 9) <= maxWidth || !cur) cur = trial; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  const clipped = lines.length > maxLines;
  return { lines: maxLines ? lines.slice(0, maxLines) : lines, clipped };
}
function footer(page, num, total = 9) {
  text(page, `${num} / ${total}`, W - M - 40, H - 24, 8, fontRef.regular, SOFT);
}

export function drawMasthead(page, logos, y) {
  const title = 'Attestation de contrôle d\'un générateur de chaleur';
  if (logos.wallonie) { page.drawImage(logos.wallonie, { x: M, y: yOf(page, y), width: 44, height: 44 }); text(page, 'Wallonie', M, y + 48, 9, fontRef.bold, INK, 120); }
  if (logos.dgo4) { const cx = W / 2 - 24; page.drawImage(logos.dgo4, { x: cx, y: yOf(page, y), width: 48, height: 42 }); text(page, 'DG0 4', cx + 4, y + 48, 9, fontRef.bold, RED, 60); }
  if (logos.airClimat) { const rx = W - M - 100; page.drawImage(logos.airClimat, { x: rx, y: yOf(page, y), width: 92, height: 30 }); text(page, 'agence wallonne de l\'air et du climat', rx, y + 36, 7.5, fontRef.regular, SOFT, 95); }
  rule(page, M, y + 62, RIGHT, RED, 2.5);
  text(page, title, M, y + 76, 14, fontRef.bold, INK, RIGHT - M);
  return y + 96;
}
export function drawControlId(page, controlDate, attestNumber, y) {
  text(page, 'Date du contrôle:', M, y, 8.5, fontRef.regular, SOFT, 120);
  text(page, controlDate || '', M + 120, y, 8.5, fontRef.regular, INK, 100);
  text(page, 'N° attestation:', M + 260, y, 8.5, fontRef.regular, SOFT, 100);
  text(page, attestNumber || '', M + 340, y, 8.5, fontRef.regular, INK, 80);
  return y + 18;
}

export function drawTechnicianBlock(page, d, y) {
  y = band(page, 'Technicien(2)', y);
  text(page, 'Agrément', M, y, 8.5, fontRef.regular, SOFT);
  let x = M + 60;
  for (const [lab, sel] of [['L', d.techCategory === 'Technicien agréé L'], ['GI', d.techCategory === 'Technicien agréé GI'], ['GII', d.techCategory === 'Technicien agréé GII']]) { x = radioOption(page, x, y, sel); text(page, lab, x, y, 8.5, fontRef.regular, INK); x += 14; }
  text(page, 'Technicien spécialisé en combustibles solides', x + 10, y, 8, fontRef.regular, INK);
  y += 18;
  y = fieldLine(page, 'Nom et prénom', d.techName || '', y, 220);
  y = fieldLine(page, 'N° d\'agrément (si CL ou CG)', d.techAgrement || '', y, 120);
  y = fieldLine(page, 'Nom entreprise', d.company || '', y, 220);
  y = fieldLine(page, 'N° entreprise (BCE)', d.bce || '', y, 150);
  y = fieldLine(page, 'Téléphone', d.techPhone || '', y, 120);
  y = fieldLine(page, 'Fax ou courriel', d.techEmail || '', y, 150);
  return y + 10;
}

export function drawDemandeurBlock(page, d, y) {
  y = band(page, 'Demandeur du contrôle', y);
  text(page, 'Type de demandeur', M, y, 8.5, fontRef.regular, SOFT);
  let x = M + 80;
  for (const [lab, sel] of [['Propriétaire', d.requester === 'Propriétaire'], ['Locataire', d.requester === 'Locataire'], ['Autre', d.requester === 'Autre']]) { x = radioOption(page, x, y, sel); text(page, lab, x, y, 8.5, fontRef.regular, INK); x += 12; }
  y += 18;
  y = fieldLine(page, 'Nom et prénom', d.clientName || '', y, 220);
  y = fieldLine(page, 'Entreprise (si pertinent)', d.clientCompany || '', y, 180);
  y = fieldLine(page, 'Rue', d.clientStreetName || '', y, 150);
  y = fieldLine(page, 'Numéro', d.clientStreetNumber || '', y, 80);
  y = fieldLine(page, 'Code postal & localité', d.clientCity || '', y, 200);
  y = fieldLine(page, 'Téléphone', d.clientPhone || '', y, 120);
  y = fieldLine(page, 'Courriel', d.clientEmail || '', y, 150);
  y = fieldLine(page, 'Localisation du générateur si différente', d.applianceLocation || '', y, 250);
  return y + 10;
}
export function drawCombustiblesBlock(page, d, y) {
  y = band(page, 'Combustibles (si multicombustible, mentionner les différents combustibles)', y);
  const fuel = String(d.fuelDetail || '').toLowerCase();
  const solidOpts = ['Pellets bois', 'Bûches', 'Plaquettes', 'Céréales', 'Charbon', 'Autre', 'Autre'];
  const liquidOpts = ['Gasoil', 'Gasoil extra', 'Fuel lourd', 'Propane', 'Butane', 'Biogaz', 'Autre'];
  const gasOpts = ['Gaz nat. G20', 'Gaz nat. G25', '', '', '', '', ''];
  const checkedSolid = solidOpts.some((o) => fuel.includes(o.toLowerCase()));
  const checkedLiquid = liquidOpts.some((o) => fuel.includes(o.toLowerCase()));
  const checkedGas = gasOpts.some((o) => fuel.includes(o.toLowerCase()));
  text(page, 'Solide', M, y, 8.5, fontRef.regular, SOFT);
  text(page, 'Liquide', M + 130, y, 8.5, fontRef.regular, SOFT);
  text(page, 'Gazeux', M + 260, y, 8.5, fontRef.regular, SOFT);
  y += 12;
  const rows = 7;
  for (let i = 0; i < rows; i++) {
    const yy = y + i * 11;
    const sx = M;
    page.drawRectangle({ x: sx, y: yOf(page, yy + 3), width: 7, height: 7, borderColor: INK, borderWidth: 0.6, color: PAPER });
    if (i === 0 && checkedSolid) page.drawRectangle({ x: sx + 1.2, y: yOf(page, yy + 4.2), width: 4.6, height: 4.6, color: RED });
    text(page, solidOpts[i] || '', sx + 10, yy, 7.5, fontRef.regular, INK, 110);
    const lx = M + 130;
    page.drawRectangle({ x: lx, y: yOf(page, yy + 3), width: 7, height: 7, borderColor: INK, borderWidth: 0.6, color: PAPER });
    if (i === 0 && checkedLiquid) page.drawRectangle({ x: lx + 1.2, y: yOf(page, yy + 4.2), width: 4.6, height: 4.6, color: RED });
    text(page, liquidOpts[i] || '', lx + 10, yy, 7.5, fontRef.regular, INK, 110);
    const gx = M + 260;
    page.drawRectangle({ x: gx, y: yOf(page, yy + 3), width: 7, height: 7, borderColor: INK, borderWidth: 0.6, color: PAPER });
    if (i === 0 && checkedGas) page.drawRectangle({ x: gx + 1.2, y: yOf(page, yy + 4.2), width: 4.6, height: 4.6, color: RED });
    text(page, gasOpts[i] || '', gx + 10, yy, 7.5, fontRef.regular, INK, 100);
  }
  return y + rows * 11 + 10;
}

export function drawGeneratorBlock(page, d, y) {
  y = band(page, 'Générateur de chaleur', y);
  y = fieldLine(page, 'Nb de générateurs dans le local de chauffe', d.genCount || '1', y, 60);
  text(page, 'Raccordement:', M, y, 8.5, fontRef.regular, SOFT, 80);
  let x = M + 90;
  const racc = d.raccordement || 'B';
  x = radioOption(page, x, y, racc === 'B'); text(page, 'B (3)', x, y, 8.5, fontRef.regular, INK); x += 30;
  x = radioOption(page, x, y, racc === 'C'); text(page, 'C 53 (3)', x, y, 8.5, fontRef.regular, INK);
  y += 14;
  y = fieldLine(page, 'À condensation', d.condensation === 'oui' ? 'oui' : 'non', y, 60);
  y = fieldLine(page, 'Plaque signalétique', d.plaque === 'Présente' ? 'Présent et conforme' : 'Absent', y, 120);
  y = fieldLine(page, 'Année de construction', String(d.year || ''), y, 80);
  y = fieldLine(page, 'Marque', d.make || '', y, 120);
  y = fieldLine(page, 'Type', d.burnerModel || d.model || '', y, 120);
  y = fieldLine(page, 'N° série', d.serial || '', y, 120);
  y = fieldLine(page, 'Puissance nominale utile (kW)', String(d.powerKw || ''), y, 80);
  y = band(page, 'Brûleur', y, RED);
  y = fieldLine(page, '1 allure / plusieurs / modulant', d.burnerType || '1 allure', y, 200);
  y = fieldLine(page, 'Type (unit / air pulsé)', d.unitOrPulsed || 'unit', y, 150);
  y = fieldLine(page, 'Prémixage (prémix / non-premix)', d.premix || 'prémix', y, 150);
  y = fieldLine(page, 'Marque brûleur', d.burnerModel || '', y, 100);
  y = fieldLine(page, 'N° série brûleur', d.serial || '', y, 100);
  return y + 10;
}

export function drawVentilationBlock(page, d, y) {
  y = band(page, 'Ventilation local de chauffe – Amenée d\'air comburant – Evacuation des gaz de combustion', y);
  text(page, 'Introduction de la demande initiale de permis d\'urbanisme du bâtiment contenant le local de chauffe(6):', M, y, 7.5, fontRef.regular, SOFT, RIGHT - M);
  y += 10;
  const before = /avant/i.test(String(d.permisDate || ''));
  text(page, 'Avant le 29/05/2009(7)  (>', M, y, 8, fontRef.regular, SOFT, 140);
  y = checkboxRow(page, 'Respect de la norme ou du code de bonne pratique applicable au moment du placement de l\'installation', y + 8, before);
  y += 14;
  text(page, 'Après le 29/05/2009(7)', M, y, 8, fontRef.regular, SOFT, 120);
  y += 8;
  const ventSel = d.ventLocal === 'NON' ? 'NON' : 'OUI';
  const airSel = d.airSupply === 'NON' ? 'NON' : 'OUI';
  const flueSel = d.flue === 'NON' ? 'NON' : 'OUI';
  y = checkboxRow(page, `Conformité de la ventilation du local de chauffe:  OUI   NON   (${ventSel})`, ventSel === 'OUI', y);
  y = checkboxRow(page, `Conformité du dispositif d\'amenée d\'air comburant:  OUI   NON   (${airSel})`, airSel === 'OUI', y);
  y = checkboxRow(page, `Conformité du dispositif d\'évacuation des gaz de combustion:  OUI   NON   (${flueSel})`, flueSel === 'OUI', y);
  y += 6;
  text(page, 'En cas de non-conformité > Causes de non-conformité et actions à entreprendre:', M, y, 7.5, fontRef.regular, SOFT, RIGHT - M);
  y += 8;
  y = fieldLine(page, '', d.causes || '', y, RIGHT - M - 10);
  return y + 10;
}
export function drawOrificesBlock(page, d, y) {
  y = band(page, 'Orifices de mesure (générateurs combustibles liquides et gazeux)', y);
  text(page, 'Le générateur est-il dispensé de l\'obligation d\'être équipé d\'orifices de mesure(8)?', M, y, 7.5, fontRef.regular, SOFT, RIGHT - M);
  y += 10;
  const opts = ['Présent et conforme', 'Présent et non conforme', 'Absent et techniquement non réalisable'];
  const sel = d.orifices || 'Présent et conforme';
  opts.forEach((o) => { y = checkboxRow(page, o, y, o === sel); });
  y = fieldLine(page, 'Remarque – Cause de non-conformité:', d.remarks || '', y, RIGHT - M - 10);
  return y + 10;
}
