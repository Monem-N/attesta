// Data-driven print view for the Flanders attestation (2 A4 pages).
// Mirrors print-wallonia.js: token injection + exclusive ticks + conditional page 2.
import {flanders} from './regions/flanders.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function fmtDots(v) {
  const s = String(v ?? '');
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s); if (slash) return `${slash[1]}.${slash[2]}.${slash[3]}`;
  return s;
}

// pair helper: series 1 = initiële, 2 = eindmeting
const pair = (v, n) => (v && typeof v === 'object') ? (n === 1 ? v.i : v.f) ?? '' : (n === 1 ? v : '');

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
    nextDueDate: () => fmtDots(d.nextDueDate), defects: () => d.defects || '', remarks: () => d.remarks || '',
    vekaRef: () => d.vekaRef || '',
  };
  return map[key] ? map[key]() : d[key] ?? '';
}

// Ordered, exclusive option rules (first match wins).
const RULES = {
  techCategory: [['geschoold', /geschoold|vast/i], ['va', /va\+|verwarmingsaannemer/i], ['tv', /tv|vloeib/i], ['gv', /gv|gasvorm/i]],
  fuel: [['vast', /vast/i], ['vloeibaar', /vloeib/i], ['gasvormig', /gasvorm/i]],
  central: [['ja', /^ja/i], ['nee', /^nee/i]],
  type: [['b', /^b$/i], ['c', /^c$/i]],
  condensation: [['ja', /^ja/i], ['nee', /^nee/i]],
  unitOrPulsed: [['air pulsed', /air|puls/i], ['unit', /^unit/i]],
  conformity: [['niet veilig', /niet veilig/i], ['niet goed', /niet goed/i], ['veilig', /veilig/i], ['goed', /goed/i]],
  conformStooktoestel: [['OK', /^ok/i], ['Niet OK', /niet ok/i]],
  conformRookgas: [['OK', /^ok/i], ['Niet OK', /niet ok/i]],
  conformStookplaats: [['OK', /^ok/i], ['Niet OK', /niet ok/i]],
  conformVerbranding: [['OK', /^ok/i], ['Niet OK', /niet ok/i]],
};

export function selectedOption(field, value) {
  if (value == null || value === '') return null;
  const v = String(value).trim();
  // Computed verdict fields (v_*) and OK/Niet OK values are direct.
  if (/^(OK|Niet OK)$/i.test(v)) return v;
  const rules = RULES[field]; if (!rules) return null;
  const hit = rules.find(([, re]) => re.test(v));
  return hit ? hit[0] : null;
}

function computeVerdicts(d) {
  // Flanders criteria: o2 ≤ 4.4, co2 ≥ 12, co ≤ 150, flueTemp ≤ 200, efficiency ≥ 90.
  const lim = { o2: { max: 4.4 }, co2: { min: 12 }, co: { max: 150 }, flueTemp: { max: 200 }, efficiency: { min: 90 } };
  const out = {};
  for (const k of Object.keys(lim)) {
    for (const n of [1, 2]) {
      const raw = pair(d[k], n);
      if (raw === '' || raw == null) continue;
      const val = Number(String(raw).replace(',', '.'));
      if (!Number.isFinite(val)) continue;
      const l = lim[k];
      const ok = (l.min == null || val >= l.min) && (l.max == null || val <= l.max);
      out[`v_${k}_${n}`] = ok ? 'OK' : 'Niet OK';
    }
  }
  return out;
}

export function buildFlandersHtml(state) {
  const data = state.region === 'flanders' ? { ...state.data } : state.data;
  // computed next control date
  if (data.controlDate) { try { data.nextDueDate = fmtDots(flanders.rules.nextDue(data.controlDate, data).date); } catch (e) {} }
  Object.assign(data, computeVerdicts(data));
  return { data };
}

export function renderFlandersPrintHtml(state, templateHtml) {
  const { data } = buildFlandersHtml(state);
  let html = templateHtml.replace(/\{\{(\w+)\}\}/g, (_, k) => esc(valueFor(data, k)));
  const base = new URL('.', globalThis.location?.href || 'http://localhost/');
  html = html.replace(/(src|href)="(assets\/[^"]+)"/g, (_, a, p) => `${a}="${new URL(p, base).href}"`);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // exclusive ticks
  const winners = {};
  doc.querySelectorAll('[data-tick]').forEach(el => {
    const [field, option] = el.dataset.tick.split(':');
    if (!(field in winners)) winners[field] = selectedOption(field, data[field]);
    const checked = winners[field] === option;
    el.classList.toggle('on', checked);
    el.textContent = checked ? '✓' : '';
  });
  // conditional page 2
  const isKeuring = /Keuringsrapport/i.test(data.document || '');
  doc.querySelectorAll('[data-doc]').forEach(el => {
    const show = el.dataset.doc === (isKeuring ? 'keuring' : 'reiniging');
    el.style.display = show ? '' : 'none';
  });
  return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
}

export async function openFlandersPrint(state) {
  let res;
  try { res = await fetch('flanders.html'); } catch (e) { throw new Error('print-template-unavailable'); }
  if (!res.ok) throw new Error('print-template-unavailable');
  return renderFlandersPrintHtml(state, await res.text());
}