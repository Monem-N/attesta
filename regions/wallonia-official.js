// Wallonia overlay on the OFFICIAL published form (assets/wa-attestation-blank.pdf),
// reconstructed from the accepted reference (Zied.pdf). Unlike the generic overlay,
// coordinates are calibrated to the *published* layout (branded header + logos), and
// checkmarks are drawn as red ✓ glyphs at the printed option positions.
//
// Coordinate note: [page, x, yTop] where yTop is the glyph-top in PDF points,
// matching the reference's text baseline layout (origin top-left, A4 595x842).
import {evaluateCriteria} from './wallonia-criteria.js';
import {scalarText} from '../input-validation.js';

const RED = [0.698, 0.227, 0.169];

// ---- free-text / value fields: field -> [page, x, yTop] -------------------
export const WA_TEXT = {
  controlDate:      [0, 127, 124],
  attestNumber:     [0, 365, 124],
  techName:         [0, 149, 187],
  techAgrement:     [0, 163, 200],
  company:          [0, 149, 212],
  bce:              [0, 149, 233],
  techPhone:        [0, 91, 223],
  techEmail:        [0, 222, 223],
  clientName:       [0, 391, 190],
  clientCompany:    [0, 470, 190],
  clientStreetName: [0, 391, 211],
  clientStreetNumber:[0, 510, 211],
  clientCity:       [0, 391, 222],
  clientPhone:      [0, 360, 233],
  clientEmail:      [0, 430, 233],
  applianceLocation:[0, 360, 248],
  genCount:         [0, 215, 353],
  powerKw:          [0, 155, 451],
  year:             [0, 175, 397],
  make:             [0, 93, 428],
  model:            [0, 195, 430],
  serial:           [0, 94, 439],
  // page 2 measurement values (Allure 1 / Pmin row)
  smoke:            [1, 211, 203],
  flueTemp:         [1, 269, 203],
  co2:              [1, 323, 203],
  o2:               [1, 376, 203],
  co:               [1, 437, 203],
  efficiency:       [1, 496, 203],
  measureDate:      [1, 160, 198],
  measureTime:      [1, 166, 209],
  analyzerMake:     [1, 330, 185],
  analyzerSerial:   [1, 460, 185],
  chimneyPressure:  [1, 430, 487],
  pumpPressure:     [1, 470, 498],
  nozzleMake:       [1, 150, 509],
  nozzleFlow:       [1, 340, 509],
  nozzleAngle:      [1, 470, 509],
  waterTemp:        [1, 110, 145],
  defects:          [1, 200, 636],
  techSignatureName:[3, 60, 223],
  recipientName:    [3, 301, 222],
};

// ---- checkmark targets: field -> array of {v: matcherRegExp, p:[page,x,y]} -
// Each selected value ticks the printed option at (x,y). Coordinates are the ✓
// anchor (just left of the printed label), calibrated to the reference.
const T = (page, x, y) => [page, x, y];
export const WA_TICKS = {
  techCategory: [
    {v:/gii/i, p:T(0,200,157)}, {v:/gi/i, p:T(0,171,157)}, {v:/\bl\b|^l$/i, p:T(0,144,157)},
    {v:/solide/i, p:T(0,65,168)}, {v:/agréé/i, p:T(0,65,157)},
  ],
  requester: [
    {v:/propri/i, p:T(0,306,157)}, {v:/locair/i, p:T(0,306,168)}, {v:/autre/i, p:T(0,306,178)},
  ],
  fuelDetail: [
    {v:/g20/i, p:T(0,120,316)}, {v:/g25/i, p:T(0,183,316)}, {v:/propane/i, p:T(0,246,316)},
    {v:/butane/i, p:T(0,309,316)}, {v:/biogaz/i, p:T(0,372,316)},
    {v:/pellets/i, p:T(0,120,294)}, {v:/b[uû]ches/i, p:T(0,183,294)},
    {v:/plaquettes/i, p:T(0,246,294)}, {v:/c[eé]r[eé]ales/i, p:T(0,309,294)},
    {v:/charbon/i, p:T(0,372,294)},
    {v:/gasoil extra/i, p:T(0,183,305)}, {v:/(^| )gasoil/i, p:T(0,120,305)},
    {v:/fuel lourd/i, p:T(0,246,305)},
  ],
  burnerType: [
    {v:/1 allure/i, p:T(0,305,352)}, {v:/plusieurs/i, p:T(0,350,352)}, {v:/modulant/i, p:T(0,489,347)},
  ],
  unitOrPulsed: [{v:/air.?puls/i, p:T(0,433,358)}, {v:/^unit/i, p:T(0,350,362)}],
  premix: [{v:/non.?premix/i, p:T(0,481,369)}, {v:/^pr[eé]mix/i, p:T(0,433,368)}],
  condensation: [{v:/^oui/i, p:T(0,138,395)}, {v:/^non/i, p:T(0,188,395)}],
  plaque: [{v:/absente/i, p:T(0,140,406)}, {v:/pr[eé]sente/i, p:T(0,188,406)}],
  fluid: [{v:/eau/i, p:T(0,372,436)}, {v:/vapeur/i, p:T(0,426,436)}, {v:/huile/i, p:T(0,372,447)}],
  production: [
    {v:/chauff.*ecs|ecs.*chauff/i, p:T(0,472,458)}, {v:/^chauffage/i, p:T(0,372,458)},
    {v:/^ecs/i, p:T(0,426,458)},
  ],
  raccordement: [{v:/^b/i, p:T(0,110,384)}, {v:/^c/i, p:T(0,183,384)}],
  permisDate: [{v:/avant/i, p:T(0,66,514)}, {v:/apr[eè]s/i, p:T(0,66,535)}],
  ventLocal: [{v:/oui/i, p:T(0,402,557)}, {v:/non/i, p:T(0,453,557)}],
  airSupply: [{v:/oui/i, p:T(0,402,568)}, {v:/non/i, p:T(0,453,568)}],
  flue: [{v:/oui/i, p:T(0,402,578)}, {v:/non/i, p:T(0,453,578)}],
  orifices: [
    {v:/pr[eé]sent et conforme/i, p:T(0,66,674)}, {v:/pr[eé]sent et non conforme/i, p:T(0,66,685)},
    {v:/absent/i, p:T(0,66,695)},
  ],
  // page 2 — comparison verdicts (per measurement column). y=315 OK, y=330 non OK.
  cmpSmoke:     [{v:/^ok/i, p:T(1,211,315)}, {v:/non ok/i, p:T(1,211,330)}],
  cmpFlueTemp:  [{v:/^ok/i, p:T(1,267,315)}, {v:/non ok/i, p:T(1,267,330)}],
  cmpCo2:       [{v:/^ok/i, p:T(1,322,315)}, {v:/non ok/i, p:T(1,322,330)}],
  cmpO2:        [{v:/^ok/i, p:T(1,378,315)}, {v:/non ok/i, p:T(1,378,330)}],
  cmpCo:        [{v:/^ok/i, p:T(1,434,315)}, {v:/non ok/i, p:T(1,434,330)}],
  cmpEfficiency:[{v:/^ok/i, p:T(1,490,315)}, {v:/non ok/i, p:T(1,490,330)}],
  globalResult: [{v:/^ok/i, p:T(1,164,344)}, {v:/non ok/i, p:T(1,233,344)}],
  conformity:   [{v:/^oui|^conforme/i, p:T(1,65,623)}, {v:/^non/i, p:T(1,125,623)}],
  solidSmoke:   [{v:/^oui/i, p:T(1,348,544)}, {v:/^non/i, p:T(1,399,544)}],
  solidFlue:    [{v:/^oui/i, p:T(1,348,555)}, {v:/^non/i, p:T(1,399,555)}],
  // page 3 — diagnostic tree answers (OUI x=467, NON x=512)
  diagReport:   [{v:/^oui/i, p:T(2,459,132)}, {v:/^non/i, p:T(2,504,132)}],
  diagModified: [{v:/^oui/i, p:T(2,459,180)}, {v:/^non/i, p:T(2,504,180)}],
  diagAfter2015:[{v:/^oui/i, p:T(2,459,250)}, {v:/^non/i, p:T(2,504,250)}],
  diagTwoYears: [{v:/^oui/i, p:T(2,459,295)}, {v:/^non/i, p:T(2,504,295)}],
  diagDeferred: [{v:/^oui/i, p:T(2,459,398)}, {v:/^non/i, p:T(2,504,398)}],
  // page 3 — regulation & circulation pumps
  regulationMode:[{v:/auto/i, p:T(2,200,580)}, {v:/man/i, p:T(2,249,580)}],
  thermostat:   [{v:/^oui/i, p:T(2,200,619)}, {v:/^non/i, p:T(2,249,619)}],
  clock:        [{v:/^oui/i, p:T(2,200,646)}, {v:/^non/i, p:T(2,249,646)}],
  night:        [{v:/^oui/i, p:T(2,200,675)}, {v:/^non/i, p:T(2,249,675)}],
  pumpIssue:    [{v:/^oui/i, p:T(2,447,600)}, {v:/^non/i, p:T(2,495,600)}],
  // page 4 — follow-up action selector (checkbox at x≈63)
  followUp: [
    {v:/prochaine inspection/i, p:T(3,63,129)}, {v:/mise en conformit/i, p:T(3,63,151)},
    {v:/remise en service/i, p:T(3,63,162)}, {v:/entretien/i, p:T(3,63,173)},
    {v:/diagnostic/i, p:T(3,63,184)},
  ],
  recipientCapacity: [{v:/./, p:T(3,355,234)}], // capacity text handled in WA_TEXT_EXTRA
};

// Fields whose value is a plain string printed at a fixed spot (not a checkbox).
const WA_EXTRA_TEXT = {
  recipientCapacity: [3, 363, 234],
};

function matches(value, re) {
  if (value == null || value === '') return false;
  if (re.v) return re.v.test(scalarText(value));
  return false;
}

export function fmtDots(v) {
  const text = scalarText(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : text;
}

export async function overlayWallonia(templateBytes, data, fontBytes, audit) {
  const { PDFDocument, rgb } = globalThis.window.PDFLib;
  const doc = await PDFDocument.load(templateBytes);
  if (globalThis.window?.fontkit) doc.registerFontkit(globalThis.window.fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const pages = doc.getPages();
  const ink = rgb(0.086, 0.094, 0.114);
  const red = rgb(...RED);
  const d = data;

  const drawText = (page, str, x, yTop, size = 9, color = ink) => {
    const value = scalarText(str);
    if (!value) return;
    const y = page.getHeight() - yTop - size * 0.9;
    const opts = { x, y, size, font, color };
    try { page.drawText(value, opts); }
    catch (e) {
      try { page.drawText(value.replace(/[^\x20-\x7E]/g, '?'), opts); }
      catch (e2) { if (audit) audit.omitted.push(value.slice(0, 20)); }
    }
  };
  const drawTick = (page, x, yTop) => {
    const size = 10;
    const y = page.getHeight() - yTop - size * 0.8;
    try { page.drawText('\u2713', { x, y, size, font, color: red }); }
    catch (e) { /* font missing glyph: fall back to a small mark */ }
  };

  // 1. text values ---------------------------------------------------------
  for (const [key, [pi, x, y]] of Object.entries(WA_TEXT)) {
    const page = pages[pi];
    if (!page) continue;
    let val = d[key];
    if (val === '' || val == null) continue;
    if (/Date$/.test(key) || key === 'measureDate') val = fmtDots(val);
    drawText(page, val, x, y);
  }
  for (const [key, [pi, x, y]] of Object.entries(WA_EXTRA_TEXT)) {
    const page = pages[pi];
    const val = d[key];
    if (val) drawText(page, val, x, y, 8.5);
  }

  // 2. checkmarks ----------------------------------------------------------
  for (const [key, options] of Object.entries(WA_TICKS)) {
    // Comparison verdicts and the global result are resolved in step 3 (computed
    // category defaults + authoritative technician override), not here.
    if (key.startsWith('cmp') || key === 'globalResult') continue;
    const val = d[key];
    if (val === '' || val == null) continue;
    // A tick option list may itself be an option (recipientCapacity has a catch-all
    // that would always fire) — skip keys handled as text.
    if (WA_EXTRA_TEXT[key]) continue;
    const hit = options.find((o) => matches(val, o));
    if (!hit) continue;
    const page = pages[hit.p[0]];
    if (page) drawTick(page, hit.p[1], hit.p[2]);
  }

  // 3. derived measurement comparison verdicts (authoritative technician value
  //    wins; otherwise the computed category verdict). ----------------------
  const evaluation = evaluateCriteria(d);
  const cmp = [
    ['smoke', 'cmpSmoke'], ['flueTemp', 'cmpFlueTemp'], ['co2', 'cmpCo2'],
    ['o2', 'cmpO2'], ['co', 'cmpCo'], ['efficiency', 'cmpEfficiency'],
  ];
  for (const [key, cmpKey] of cmp) {
    let verdict = d[cmpKey];
    if (verdict !== 'OK' && verdict !== 'non OK') verdict = evaluation.results[key].verdict;
    if (verdict === 'OK' || verdict === 'non OK') {
      d[cmpKey] = verdict; // feed WA_TICKS above via a second tick pass
      const options = WA_TICKS[cmpKey];
      const hit = options.find((o) => matches(verdict, o));
      const page = hit && pages[hit.p[0]];
      if (page) drawTick(page, hit.p[1], hit.p[2]);
    }
  }
  // global result tick
  let g = d.globalResult;
  if (g !== 'OK' && g !== 'non OK') g = evaluation.globalResult;
  if (g === 'OK' || g === 'non OK') {
    const hit = WA_TICKS.globalResult.find((o) => matches(g, o));
    const page = hit && pages[hit.p[0]];
    if (page) drawTick(page, hit.p[1], hit.p[2]);
  }

  if (audit) {
    audit.template = { model: 'wallonia-official', src: 'assets/wa-attestation-blank.pdf' };
    audit.pages = pages.length;
  }
  return doc.save();
}

export function overlayWalloniaText(d) {
  return Object.keys(WA_TEXT).filter((k) => d[k] !== '' && d[k] != null);
}