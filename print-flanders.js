// Data-driven print view for the Flanders attestation (2 A4 pages).
// Token injection + exclusive ticks + category-based verdicts + conditional page 2.
import {flanders} from './regions/flanders.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export function fmtDots(v) {
  const s = String(v ?? '');
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s); if (slash) return `${slash[1]}.${slash[2]}.${slash[3]}`;
  return s;
}
const toISO = d => {
  if (!d) return ''; if (typeof d === 'string') return d;
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const pair = (v, n) => (v && typeof v === 'object') ? ((n === 1 ? v.i : v.f) ?? '') : (v ?? '');
const num = v => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

// ---- Category table (official Flanders: LP/GP/GUP/GUnP A–D) --------------
const CATS = [
  {code:'LP A',fuel:'vloeibaar',burner:'pulsed',from:1998,to:9999,smoke:1,net:null,co2:12,o2:4.4,co:155,eff:90},
  {code:'LP B',fuel:'vloeibaar',burner:'pulsed',from:1988,to:1997,smoke:1,net:null,co2:11,o2:null,co:155,eff:88},
  {code:'LP C',fuel:'vloeibaar',burner:'pulsed',from:0,to:1987,smoke:2,net:null,co2:10,o2:null,co:155,eff:85},
  {code:'GP A',fuel:'gasvormig',burner:'pulsed',from:1998,to:9999,smoke:null,net:200,co2:8.5,o2:null,co:110,eff:90},
  {code:'GP B',fuel:'gasvormig',burner:'pulsed',from:1988,to:1997,smoke:null,net:220,co2:7.5,o2:null,co:150,eff:88},
  {code:'GP C',fuel:'gasvormig',burner:'pulsed',from:0,to:1987,smoke:null,net:250,co2:6.5,o2:null,co:270,eff:85},
  {code:'GUP A',fuel:'gasvormig',burner:'unit-premix',from:2007,to:9999,smoke:null,net:180,co2:null,o2:null,co:110,eff:90},
  {code:'GUP B',fuel:'gasvormig',burner:'unit-premix',from:1998,to:2006,smoke:null,net:180,co2:null,o2:null,co:150,eff:90},
  {code:'GUP C',fuel:'gasvormig',burner:'unit-premix',from:1988,to:1997,smoke:null,net:200,co2:null,o2:null,co:150,eff:88},
  {code:'GUP D',fuel:'gasvormig',burner:'unit-premix',from:0,to:1987,smoke:null,net:250,co2:null,o2:null,co:270,eff:84},
  {code:'GUnP A',fuel:'gasvormig',burner:'unit-nonpremix',from:2007,to:9999,smoke:null,net:200,co2:null,o2:null,co:150,eff:88},
  {code:'GUnP B',fuel:'gasvormig',burner:'unit-nonpremix',from:1998,to:2006,smoke:null,net:200,co2:null,o2:null,co:200,eff:88},
  {code:'GUnP C',fuel:'gasvormig',burner:'unit-nonpremix',from:1988,to:1997,smoke:null,net:250,co2:null,o2:null,co:200,eff:86},
  {code:'GUnP D',fuel:'gasvormig',burner:'unit-nonpremix',from:0,to:1987,smoke:null,net:300,co2:null,o2:null,co:300,eff:82},
];

export function categoryFor(fuel, year, unitOrPulsed) {
  if (fuel === 'vast') return null;
  const y = Number(year) || 0;
  let burner;
  if (fuel === 'vloeibaar') burner = 'pulsed';
  else burner = /air|puls/i.test(unitOrPulsed || '') ? 'pulsed' : 'unit-nonpremix';
  return CATS.find(c => c.fuel === fuel && c.burner === burner && y >= c.from && y <= c.to) || null;
}

export function valueFor(data, key) {
  const d = data;
  const m = /_([12])$/.exec(key);
  if (m) { const base = key.slice(0, -2); return pair(d[base], Number(m[1])); }
  const map = {
    controlDate: () => fmtDots(d.controlDate), attestNumber: () => d.attestNumber || '',
    workDuration: () => d.workDuration || '', company: () => d.company || '', bce: () => d.bce || '',
    techName: () => d.techName || '', techAgrement: () => d.techAgrement || '', techPhone: () => d.techPhone || '',
    clientName: () => d.clientName || '', clientStreet: () => d.clientStreet || '', clientCity: () => d.clientCity || '',
    clientPhone: () => d.clientPhone || '', applianceLocation: () => d.applianceLocation || '',
    powerKw: () => d.powerKw ?? '', year: () => d.year ?? '', make: () => d.make || '', model: () => d.model || '',
    serial: () => d.serial || '', smoke: () => d.smoke ?? '', draft: () => d.draft ?? '',
    nextDueDate: () => fmtDots(d.nextDueDate), nextCleaning: () => fmtDots(d.nextCleaning),
    defects: () => d.defects || '', remarks: () => d.remarks || '', vekaRef: () => d.vekaRef || '',
  };
  return Object.hasOwn(map, key) ? map[key]() : (d[key] ?? '');
}

// Ordered, exclusive option rules (first match wins).
const RULES = {
  techCategory: [['geschoold', /geschoold|vast/i], ['va', /^va\+?$|verwarmingsaannemer/i], ['tv', /^tv|vloeib/i], ['gv', /^gv|gasvorm/i]],
  fuel: [['vast', /^vast/i], ['vloeibaar', /^vloeib/i], ['gasvormig', /^gasvorm/i]],
  central: [['ja', /^ja/i], ['nee', /^nee/i]],
  type: [['b', /^b$/i], ['c', /^c$/i]],
  condensation: [['ja', /^ja/i], ['nee', /^nee/i]],
  unitOrPulsed: [['air pulsed', /air|puls/i], ['unit', /^unit/i]],
  conformity: [['niet veilig', /niet veilig/i], ['niet goed', /niet goed/i], ['veilig', /^veilig/i], ['goed', /^goed/i]],
  conformStooktoestel: [['OK', /^ok/i], ['Niet OK', /niet ok/i]],
  conformRookgas: [['OK', /^ok/i], ['Niet OK', /niet ok/i]],
  conformStookplaats: [['OK', /^ok/i], ['Niet OK', /niet ok/i]],
  conformVerbranding: [['OK', /^ok/i], ['Niet OK', /niet ok/i]],
};

export function selectedOption(field, value) {
  if (value == null || value === '') return null;
  const v = String(value).trim();
  if (/^(OK|Niet OK)$/i.test(v)) return v;
  const rules = RULES[field]; if (!rules) return null;
  const hit = rules.find(([, re]) => re.test(v));
  return hit ? hit[0] : null;
}

export function computeVerdicts(d) {
  const cat = categoryFor(d.fuel, d.year, d.unitOrPulsed);
  const lpg = (/propaan|butaan/i.test(d.gas || '') || (d.fuel === 'gasvormig' && d.gas && !/aardgas/i.test(d.gas))) ? 15 : 0;
  const specs = cat
    ? [['smoke', cat.smoke, 'max'], ['netTemp', cat.net, 'max'], ['co2', cat.co2, 'min'],
       ['o2', cat.o2, 'max'], ['co', cat.co == null ? null : cat.co + lpg, 'max'], ['efficiency', cat.eff, 'min']]
    : [];
  const out = {};
  for (const [k, lim, dir] of specs) {
    if (lim == null) continue;
    for (const n of [1, 2]) {
      const raw = pair(d[k], n); if (raw === '' || raw == null) continue;
      const val = num(raw); if (val === null) continue;
      const ok = dir === 'min' ? val >= lim : val <= lim;
      out[`v_${k}_${n}`] = ok ? 'OK' : 'Niet OK';
    }
  }
  const judged = Object.values(out);
  out.v_overall = judged.length ? (judged.every(v => v === 'OK') ? 'OK' : 'Niet OK') : null;
  if (out.v_overall === null) delete out.v_overall;
  return out;
}

export function buildFlandersHtml(state) {
  const data = { ...state.data };
  if (data.controlDate) {
    try { data.nextDueDate = fmtDots(toISO(flanders.rules.nextDue(data.controlDate, data).date)); } catch (e) {}
    try { data.nextCleaning = fmtDots(toISO(flanders.rules.nextCleaning(data.controlDate, data))); } catch (e) {}
  }
  Object.assign(data, computeVerdicts(data));
  return { data };
}

export function renderFlandersPrintHtml(state, templateHtml) {
  const { data } = buildFlandersHtml(state);
  let html = templateHtml.replace(/\{\{(\w+)\}\}/g, (_, k) => esc(valueFor(data, k)));
  const base = new URL('.', globalThis.location?.href || 'http://localhost/');
  html = html.replace(/(src|href)="(assets\/[^"]+)"/g, (_, a, p) => `${a}="${new URL(p, base).href}"`);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // exclusive ticks (case-insensitive)
  const winners = {};
  doc.querySelectorAll('[data-tick]').forEach(el => {
    const [field, option] = el.dataset.tick.split(':');
    if (!(field in winners)) winners[field] = selectedOption(field, data[field]);
    const checked = winners[field] != null && norm(winners[field]) === norm(option);
    el.classList.toggle('on', checked);
    el.textContent = checked ? '✓' : '';
    el.setAttribute('aria-checked', String(checked));
  });
  // conditional page 2
  const isKeuring = /Keuringsrapport/i.test(data.document || '');
  doc.querySelectorAll('[data-doc]').forEach(el => {
    const show = el.dataset.doc === (isKeuring ? 'keuring' : 'reiniging');
    el.style.display = show ? '' : 'none';
  });
  // dynamic page numbering (visible sheets only)
  const sheets = [...doc.querySelectorAll('.sheet')].filter(s => s.style.display !== 'none');
  sheets.forEach((s, i) => { const el = s.querySelector('[data-page-no]'); if (el) el.textContent = `${i + 1} / ${sheets.length}`; });
  return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
}

export async function openFlandersPrint(state) {
  let res;
  try { res = await fetch(new URL('./flanders.html', import.meta.url), { headers: { Accept: 'text/html' }, cache: 'no-cache' }); }
  catch (e) { throw new Error('print-template-unavailable'); }
  if (!res.ok) throw new Error('print-template-unavailable');
  return renderFlandersPrintHtml(state, await res.text());
}