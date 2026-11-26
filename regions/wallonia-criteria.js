// Wallonia "performances minimales" — transcribed from the OFFICIAL model:
// assets/wa-attestation-bg.pdf, last updated 29/10/2015, page 8 (table at end of document).
//
// The previous single threshold set in wallonia.js / wallonia-pdf.js was LP A only.
// The official table is category-dependent (fuel, burner, premix, year) and several
// columns are blank for a given category. A blank column means NO RULE APPLIES —
// the tool must not render OK for a value it has no criterion for.
//
// This data is pinned to the template revision. Changing it requires a new official
// model and a new WA_TEMPLATE_VERSION.

import {isValidDate,parseNumber,scalarText} from '../input-validation.js';

export const WA_TEMPLATE_VERSION = '2015-10-29';
export const WA_SOURCE = 'assets/wa-attestation-bg.pdf, page 8 (Performances minimales)';

// rule shape: {min} = minimum required, {max} = maximum allowed, {max, lower:true}
// means "lower is better" for the printed verdict wording.
const row = (code, limits, extra = {}) => ({code, limits, premix:null, ...extra});

export const WA_CATEGORIES = [
  // Liquide — brûleur à air pulsé
  row('LP A', {smoke:{max:1,lower:true}, co2:{min:12}, o2:{max:4.4,lower:true}, co:{max:155,lower:true}, efficiency:{min:90}}, {fuel:'liquid', ignition:'pulsed', from:1998}),
  row('LP B', {smoke:{max:1,lower:true}, co2:{min:11}, co:{max:155,lower:true}, efficiency:{min:88}}, {fuel:'liquid', ignition:'pulsed', from:1988, to:1997}),
  row('LP C', {smoke:{max:2,lower:true}, co2:{min:10}, co:{max:155,lower:true}, efficiency:{min:85}}, {fuel:'liquid', ignition:'pulsed', to:1987}),

  // Gazeux — brûleur à air pulsé (séparable)
  row('GP A', {flueTemp:{max:200,lower:true}, co2:{min:8.5}, co:{max:110,lower:true}, efficiency:{min:90}}, {fuel:'gas', ignition:'pulsed', from:1998}),
  row('GP B', {flueTemp:{max:220,lower:true}, co2:{min:7.5}, co:{max:150,lower:true}, efficiency:{min:88}}, {fuel:'gas', ignition:'pulsed', from:1988, to:1997}),
  row('GP C', {flueTemp:{max:250,lower:true}, co2:{min:6.5}, co:{max:270,lower:true}, efficiency:{min:85}}, {fuel:'gas', ignition:'pulsed', to:1987}),

  // Gazeux — unité, brûleur prémix
  row('GUP A', {flueTemp:{max:180,lower:true}, co:{max:110,lower:true}, efficiency:{min:90}}, {fuel:'gas', ignition:'unit', premix:true, from:2007}),
  row('GUP B', {flueTemp:{max:180,lower:true}, co:{max:150,lower:true}, efficiency:{min:90}}, {fuel:'gas', ignition:'unit', premix:true, from:1998, to:2006}),
  row('GUP C', {flueTemp:{max:200,lower:true}, co:{max:150,lower:true}, efficiency:{min:88}}, {fuel:'gas', ignition:'unit', premix:true, from:1988, to:1997}),
  row('GUP D', {flueTemp:{max:250,lower:true}, co:{max:270,lower:true}, efficiency:{min:84}}, {fuel:'gas', ignition:'unit', premix:true, to:1987}),

  // Gazeux — unité, brûleur autre que prémix (non-premix)
  row('GUnP A', {flueTemp:{max:200,lower:true}, co:{max:150,lower:true}, efficiency:{min:88}}, {fuel:'gas', ignition:'unit', premix:false, from:2007}),
  row('GUnP B', {flueTemp:{max:200,lower:true}, co:{max:200,lower:true}, efficiency:{min:88}}, {fuel:'gas', ignition:'unit', premix:false, from:1998, to:2006}),
  row('GUnP C', {flueTemp:{max:250,lower:true}, co:{max:200,lower:true}, efficiency:{min:86}}, {fuel:'gas', ignition:'unit', premix:false, from:1988, to:1997}),
  row('GUnP D', {flueTemp:{max:300,lower:true}, co:{max:300,lower:true}, efficiency:{min:82}}, {fuel:'gas', ignition:'unit', premix:false, to:1987}),
];

// Template note: "A partir du 30 mai 2017, reclassement en ... A" for the B rows.
const RECLASSIFY_FROM = new Date('2017-05-30T00:00:00Z');
const MEASURE_KEYS = ['smoke','flueTemp','co2','o2','co','efficiency'];

function fuelFamily(data){
  const text = `${scalarText(data.fuel)} ${scalarText(data.fuelDetail)}`;
  if(/liquide|mazout|gasoil|fuel lourd/i.test(text)) return 'liquid';
  if(/gaz|gazeux|propane|butane|biogaz/i.test(text)) return 'gas';
  return null; // solid fuel has no combustion-value table in this model
}

function burner(data){
  const type = scalarText(data.unitOrPulsed).trim();
  if(/^unit$/i.test(type)) return 'unit';
  if(/air.?puls/i.test(type)) return 'pulsed';
  return null;
}

/**
 * Resolve the printed category code and its limits from wizard data.
 * Returns null when a deciding field is missing — no category means no verdict.
 */
export function categoryFor(data){
  const family = fuelFamily(data);
  const ignition = family === 'gas' ? burner(data) : (family === 'liquid' ? 'pulsed' : null);
  if(!family || !ignition) return null;

  const year = parseNumber(data.year);
  if(year===null || !Number.isInteger(year) || year < 1900 || year > new Date().getFullYear()+1) return null;

  let premix = null;
  if(ignition === 'unit'){
    const value = scalarText(data.premix).trim();
    if(/^pr[eé]mix$/i.test(value)) premix = true;
    else if(/^non[- ]premix$/i.test(value)) premix = false;
    else return null;
  }

  const found = WA_CATEGORIES.find(c =>
    c.fuel===family && c.ignition===ignition &&
    (c.premix===null || c.premix===premix) &&
    (c.from==null || year>=c.from) && (c.to==null || year<=c.to));
  if(!found) return null;

  let code = found.code;
  const control = isValidDate(data.controlDate) ? new Date(data.controlDate) : null;
  if(control && !Number.isNaN(control.getTime()) && control>=RECLASSIFY_FROM && / B$/.test(code)){
    code = `${code.slice(0,-1)}A`;
  }

  const limits = {...found.limits};
  const detail=scalarText(data.fuelDetail);
  const bottle = /propane/i.test(detail) ? 'P'
    : /butane/i.test(detail) ? 'B' : '';
  if(bottle && limits.co) limits.co = {...limits.co, max:limits.co.max+15};

  return {
    code: bottle ? `${code} ${bottle}` : code,
    template: WA_TEMPLATE_VERSION,
    source: WA_SOURCE,
    limits,
  };
}

/** Rules keyed by measurement field. Missing keys have no printed criterion. */
export function limitsForField(data){
  const category = categoryFor(data);
  return category ? category.limits : {};
}

function verdictOf(value, rule){
  if(value==='' || value==null || !rule) return null;
  const n = parseNumber(value);
  if(n===null) return null;
  const ok = (rule.max!=null ? n<=rule.max : true) && (rule.min!=null ? n>=rule.min : true);
  return ok ? 'OK' : 'non OK';
}

/**
 * Per-measurement verdicts. A value with no rule for the resolved category gets
 * verdict:null (never OK) and an explicit `noRule` flag for the UI and audit.
 */
export function evaluateCriteria(data){
  const category = categoryFor(data);
  const results = {};
  for(const key of MEASURE_KEYS){
    const value = data[key];
    const rule = category?.limits[key] ?? null;
    results[key] = {
      value: value==='' ? null : (value ?? null),
      rule: rule ?? null,
      noRule: !rule && value!=='' && value!=null,
      verdict: verdictOf(value, rule),
    };
  }
  const verdicts = Object.values(results).map(r=>r.verdict).filter(Boolean);
  const applicable = Object.values(results).filter(r=>r.rule);
  const complete = applicable.length > 0 && applicable.every(r=>r.verdict != null);
  const globalResult = verdicts.includes('non OK') ? 'non OK'
    : complete ? 'OK' : null;
  return {category, results, globalResult};
}
