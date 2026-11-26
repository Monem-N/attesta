// Data-driven print view for the Flanders attestation (2 A4 pages).
// Token injection + exclusive ticks + category-based verdicts + conditional page 2.
import {flanders} from './regions/flanders.js';
import {categoryFor,computeVerdicts} from './regions/flanders-criteria.js';
import {scalarText} from './input-validation.js';
import {signatureFor,applySignatureToDocument} from './signature.js';
export {categoryFor,computeVerdicts};

const esc = s => scalarText(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => scalarText(s).trim().toLowerCase().replace(/\s+/g, ' ');

export function fmtDots(v) {
  const s = scalarText(v);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s); if (slash) return `${slash[1]}.${slash[2]}.${slash[3]}`;
  return s;
}
const toISO = d => {
  if (!d) return ''; if (typeof d === 'string') return d;
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const pair = (v, n) => (v && typeof v === 'object' && !Array.isArray(v)) ? (n === 1 ? v.i : v.f) : v;

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
    waCategory: () => d.waCategory || '',
    lim_smoke: () => d.lim_smoke || '—', lim_net: () => d.lim_net || '—', lim_co2: () => d.lim_co2 || '—',
    lim_o2: () => d.lim_o2 || '—', lim_co: () => d.lim_co || '—', lim_eff: () => d.lim_eff || '—',
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
  const v = scalarText(value).trim();
  if (/^(OK|Niet OK)$/i.test(v)) return v;
  const rules = RULES[field]; if (!rules) return null;
  const hit = rules.find(([, re]) => re.test(v));
  return hit ? hit[0] : null;
}

export function buildFlandersHtml(state) {
  const data = { ...state.data };
  // Computed dates are recalculated from a valid intervention date. Never keep
  // dates left in a draft when the date is absent or malformed.
  delete data.nextDueDate;
  delete data.nextCleaning;
  if (data.controlDate) {
    try { data.nextDueDate = fmtDots(toISO(flanders.rules.nextDue(data.controlDate, data).date)); } catch (e) {}
    try { data.nextCleaning = fmtDots(toISO(flanders.rules.nextCleaning(data.controlDate, data))); } catch (e) {}
  }
  // Computed verdicts are never persisted authority. Remove stale v_* values
  // before merging a fresh, possibly incomplete result.
  for(const key of Object.keys(data)) if(/^v_/.test(key)) delete data[key];
  Object.assign(data, computeVerdicts(data));
  // category + "Performances minimales" limit strings (official row 10)
  const cat = categoryFor(data.fuel, data.year, data.unitOrPulsed);
  const gasText=scalarText(data.gas);
  const lpg = (data.fuel === 'gasvormig' && gasText && !/aardgas/i.test(gasText)) ? 15 : 0;
  data.waCategory = cat ? cat.code : '';
  data.lim_smoke = cat && cat.smoke != null ? '≤ ' + cat.smoke : '—';
  data.lim_net = cat && cat.netTemp != null ? '≤ ' + cat.netTemp : '—';
  data.lim_co2 = cat && cat.co2 != null ? '≥ ' + cat.co2 : '—';
  data.lim_o2 = cat && cat.o2 != null ? '≤ ' + cat.o2 : '—';
  data.lim_co = cat && cat.co != null ? '≤ ' + (cat.co + lpg) : '—';
  data.lim_eff = cat && cat.efficiency != null ? '≥ ' + cat.efficiency : '—';
  return { data };
}

export function renderFlandersPrintHtml(state, templateHtml, signature) {
  const { data } = buildFlandersHtml(state);
  let html = templateHtml.replace(/\{\{(\w+)\}\}/g, (_, k) => esc(valueFor(data, k)));
  const base = new URL('.', globalThis.location?.href || 'http://localhost/');
  html = html.replace(/(src|href)="(assets\/[^"]+)"/g, (_, a, p) => `${a}="${new URL(p, base).href}"`);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  applySignatureToDocument(doc, signature);
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
  const isKeuring = /Keuringsrapport/i.test(scalarText(data.document));
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
  return renderFlandersPrintHtml(state, await res.text(),
    signatureFor(state.data.signature, { width: 600, height: 100, lineScale: 2.6 }));
}