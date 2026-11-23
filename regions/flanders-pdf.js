// Flanders PDF layout — one map per official model.
// Coordinates are PDF points, top-left origin (A4 = 595 x 842), derived from
// assets/fl-model-*.pdf and docs/field-matrix.md.
// A map entry is [pageIndex, x, y]. A paired measurement entry is
// [pageIndex, xProefI, y, xProefII] and is written from {i, f} values.
// An entry may also be a function (data) => [pageIndex, x, y].

const VLA = /vloeibare|TV/i;
const YES = ['ja', 'oui', 'yes', 'ok', 'goed en veilig', 'conforme'];
const NO = ['nee', 'non', 'no', 'niet ok', 'niet goed', 'niet veilig', 'niet conforme'];

// OK / Niet OK (or Ja/Nee) box pair on one printed row.
const pair = (xOk, xNo, y) => ({
  ok: [[xOk, y]], 'niet ok': [[xNo, y]],
  ja: [[xOk, y]], nee: [[xNo, y]],
  oui: [[xOk, y]], non: [[xNo, y]],
  'goed en veilig': [[xOk, y]], 'niet goed': [[xNo, y]], 'niet veilig': [[xNo, y]],
  conforme: [[xOk, y]], 'niet conforme': [[xNo, y]],
});

// Explicit checkbox centres (from assets/checkbox-rects.json). Used where the
// printed options do not reduce to a single OUI/NON pair, or where the generic
// "nearest pair" heuristic would pick the wrong row.
export const BOX_SELECT = {
  'fl-verbranding': {
    intervention: {
      'periodiek onderhoud': [[137.2, 19.2]],
      'keuring eerste ingebruikname': [[208.05, 19.2]],
    },
    central: { ja: [[31.0, 189.5]] },
    type: { b: [[137.2, 189.5]], c: [[278.85, 189.5]] },
    fuel: {
      gasvormig: [[31.0, 199.4]], vloeibaar: [[31.0, 218.9]], vast: [[31.0, 228.65]],
    },
    unitOrPulsed: { unit: [[137.2, 209.1]], 'air pulsed': [[278.85, 209.1]] },
    // Eindbeoordeling: goed | veilig / niet goed | niet veilig
    conformity: {
      'goed en veilig': [[137.45, 687.25], [208.3, 687.25]],
      'niet goed': [[137.45, 696.95]],
      'niet veilig': [[208.3, 696.95]],
    },
  },
  'fl-reiniging': {
    intervention: { 'periodiek onderhoud': [[172.5, 20.3]] },
    techCategory: {
      'erkend technicus gasvormige brandstof (gv)': [[300.55, 56.3]],
      'erkend technicus vloeibare brandstof (tv)': [[300.55, 56.3]],
      'geschoold vakman (vaste brandstof)': [[300.55, 70.45]],
    },
    central: { ja: [[30.85, 225.9]] },
    type: { b: [[137.1, 225.9]], c: [[278.7, 225.9]] },
    fuel: {
      gasvormig: [[30.85, 235.7]], vloeibaar: [[30.85, 255.15]], vast: [[30.85, 265.05]],
    },
    unitOrPulsed: { unit: [[137.1, 245.45]], 'air pulsed': [[278.7, 245.45]] },
  },
  'fl-keuring': {
    central: { ja: [[27.25, 208.85]] },
    type: { b: [[133.5, 208.85]], c: [[310.55, 208.85]] },
    fuel: {
      gasvormig: [[27.25, 218.55]], vloeibaar: [[27.25, 247.85]], vast: [[27.25, 267.45]],
    },
    keuringInstructions: pair(248.5, 298.2, 364.3),
    keuringBurner: pair(241.85, 291.7, 385.9),
    keuringKetel: pair(248.5, 298.2, 425.5),
    keuringVentilation: pair(248.5, 298.2, 474.8),
    keuringHydraulic: pair(248.5, 298.2, 506.6),
    keuringElectrical: pair(497.15, 532.35, 506.6),
    conformStooktoestel: pair(246.05, 294.7, 576.8),
    conformRookgas: pair(246.05, 294.7, 586.65),
    conformStookplaats: pair(246.05, 294.7, 596.4),
    conformVerbranding: pair(246.05, 294.7, 606.1),
  },
};

export const FL_MAPS = {
  'fl-verbranding': {
    intervention: [0, 305, 15], controlDate: [0, 368, 83], attestNumber: [0, 448, 15],
    techCategory: [0, 355, 27], techName: [0, 400, 37],
    techAgrement: d => [0, VLA.test(d.techCategory || '') ? 478 : 380, 59],
    company: [0, 165, 27], bce: [0, 135, 94],
    techPhone: [0, 58, 83], workDuration: [0, 360, 94],
    clientName: [0, 120, 117], clientStreet: [0, 95, 128], clientCity: [0, 123, 140],
    clientPhone: [0, 58, 151], applianceLocation: [0, 300, 125],
    central: [0, 80, 186], type: [0, 300, 186], fuel: [0, 100, 195],
    powerKw: [0, 120, 290], year: [0, 70, 267], make: [0, 55, 245],
    model: [0, 55, 256], serial: [0, 105, 279],
    unitOrPulsed: [0, 300, 205],
    smoke: [0, 385, 454], draft: [0, 290, 625],
    o2: [0, 385, 469, 465], co2: [0, 385, 483, 465], co: [0, 385, 498, 465],
    flueTemp: [0, 385, 513, 465], netTemp: [0, 385, 541, 465],
    efficiency: [0, 385, 556, 465],
    conformity: [0, 135, 687], defects: [0, 30, 722], remarks: [0, 120, 740],
    nextDueDate: [0, 432, 683],
  },
  'fl-reiniging': {
    intervention: [0, 190, 16], controlDate: [0, 360, 95], attestNumber: [0, 390, 16],
    techCategory: [0, 355, 26], techName: [0, 400, 38],
    techAgrement: d => [0, VLA.test(d.techCategory || '') ? 453 : 388, 52],
    company: [0, 165, 26], bce: [0, 112, 110],
    techPhone: [0, 58, 95], workDuration: [0, 360, 110],
    clientName: [0, 120, 138], clientStreet: [0, 95, 152], clientCity: [0, 123, 166],
    clientPhone: [0, 58, 181], applianceLocation: [0, 300, 140],
    central: [0, 80, 222], type: [0, 300, 222], fuel: [0, 100, 232],
    powerKw: [0, 120, 338], year: [0, 70, 309], make: [0, 55, 281],
    model: [0, 55, 295], serial: [0, 105, 324],
    unitOrPulsed: [0, 300, 251],
    conformity: [0, 30, 600], defects: [0, 30, 590], remarks: [0, 120, 660],
    nextDueDate: [0, 350, 687],
  },
  'fl-keuring': {
    controlDate: [0, 352, 98], attestNumber: [0, 404, 14],
    techCategory: [0, 350, 27], techName: [0, 400, 37],
    techAgrement: d => [0, VLA.test(d.techCategory || '') ? 475 : 378, 69],
    company: [0, 162, 27], bce: [0, 108, 108],
    techPhone: [0, 55, 94], workDuration: [0, 360, 113],
    clientName: [0, 117, 138], clientStreet: [0, 92, 149], clientCity: [0, 120, 160],
    clientPhone: [0, 55, 172], applianceLocation: [0, 290, 140],
    central: [0, 80, 205], type: [0, 360, 205], fuel: [0, 100, 215],
    powerKw: [0, 117, 339], year: [0, 70, 316], make: [0, 55, 293],
    model: [0, 55, 305], serial: [0, 105, 327],
    unitOrPulsed: [0, 360, 224],
    keuringInstructions: [0, 248.5, 364.3], keuringBurner: [0, 241.85, 385.9],
    keuringKetel: [0, 248.5, 425.5], keuringVentilation: [0, 248.5, 474.8],
    keuringHydraulic: [0, 248.5, 506.6], keuringElectrical: [0, 497.15, 506.6],
    conformStooktoestel: [0, 246.05, 576.8], conformRookgas: [0, 246.05, 586.65],
    conformStookplaats: [0, 246.05, 596.4], conformVerbranding: [0, 246.05, 606.1],
    defects: [0, 30, 625], remarks: [0, 90, 700],
    nextDueDate: [0, 455, 583],
  },
};

// Long option labels would overflow the narrow printed lines. Flanders writes
// the short recognition code instead of the full select text.
export function flTextValue(key, value){
  if(value==null) return value;
  if(key==='techAgrement') return String(value).replace(/^(GV|TV|VA\+)\s*/i,'');
  if(key!=='techCategory') return value;
  if(/gasvormige/i.test(value)) return 'GV';
  if(/vloeibare/i.test(value)) return 'TV';
  if(/VA\+/i.test(value)) return 'VA+';
  return 'Vakman (vaste brandstof)';
}

export function anchorOf(anchor, data){
  return typeof anchor === 'function' ? anchor(data) : anchor;
}

export function isPaired(anchor, value){
  return Array.isArray(anchor) && anchor.length === 4 && !!value &&
    typeof value === 'object' && !Array.isArray(value);
}

// Return the rectangle(s) that must be ticked for this model/field/value, or
// null when the field has no explicit selection (generic binary fallback).
export function explicitBoxes(model, key, value, rects){
  const table = BOX_SELECT[model]?.[key];
  if(!table || value == null || value === '') return null;
  const centers = table[String(value).toLowerCase().trim()];
  if(!centers) return null;
  const list = rects || [];
  const found = centers.map(([cx, cy]) => list.find(b =>
    Math.hypot((b[0] + b[2]) / 2 - cx, (b[1] + b[3]) / 2 - cy) < 2.5));
  return found.every(Boolean) ? found : null;
}

export {YES, NO};
