// Data-driven HTML print view for the Brussels PEB attestation (4 A4 pages).
// Added alongside the JSON/web-encoder path (does not replace it).
import {nextControlDate} from './regions/brussels.js';
import {scalarText} from './input-validation.js';
import {signatureFor,applySignatureToDocument} from './signature.js';

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

export function valueFor(data, key) {
  const d = data;
  const map = {
    controlDate: () => fmtDots(d.controlDate), attestNumber: () => d.attestNumber || '',
    nextDueDate: () => fmtDots(d.nextDueDate),
    applianceLocation: () => d.applianceLocation || '', clientCity: () => d.clientCity || '',
    floor: () => d.floor || '', pebUnitRef: () => d.pebUnitRef || '', buildingName: () => d.buildingName || '',
    clientName: () => d.clientName || '', clientStreet: () => d.clientStreet || '',
    contactName: () => d.contactName || '', contactPhone: () => d.contactPhone || '',
    coAmbient: () => d.coAmbient ?? '', company: () => d.company || '', bce: () => d.bce || '',
    techCategory: () => d.techCategory || '', techName: () => d.techName || '', techAgrement: () => d.techAgrement || '',
    techPhone: () => d.techPhone || '', boilerCount: () => d.boilerCount ?? '', powerKw: () => d.powerKw ?? '',
    make: () => d.make || '', model: () => d.model || '', serial: () => d.serial || '', year: () => d.year ?? '',
    connection: () => d.connection || '', usage: () => d.usage || '', en437: () => d.en437 || '',
    gasConversion: () => d.gasConversion || '', fuel: () => d.fuel || '',
    remarks: () => d.remarks || '', defects: () => d.defects || '',
    annex1mw: () => d.annex1mw ? 'OUI' : 'NON', logbook: () => d.logbook ? 'OUI' : 'NON',
    flueTemp: () => d.flueTemp ?? '', o2: () => d.o2 ?? '', co2: () => d.co2 ?? '', co: () => d.co ?? '',
    draught: () => d.draught ?? '', draughtPa: () => d.draughtPa ?? '',
    annualConsumption: () => d.annualConsumption ?? '', operatingHours: () => d.operatingHours ?? '',
  };
  return Object.hasOwn(map, key) ? map[key]() : (d[key] ?? '');
}

const RULES = {
  motif: [['conformite', /conformit/i], ['combustion', /combustion/i], ['delai', /délai|delai/i], ['autre', /autre/i], ['placement', /placement/i]],
  ownerType: [['copropriete', /copropri/i], ['entreprise', /entreprise/i], ['particulier', /particulier/i]],
  conformity: [['non conforme', /non.?conforme/i], ['conforme', /conforme/i]],
  stopProtocol: [['oui', /^oui/i], ['non', /^non/i]],
  safety: [['oui', /^oui/i], ['non', /^non/i]],
  flueState: [['oui', /^oui/i], ['non', /^non/i]],
  orifices: [['oui', /^oui/i], ['non', /^non/i]],
  ventilation: [['oui', /^oui/i], ['non', /^non/i]],
  draught: [['oui', /^oui/i], ['non', /^non/i]],
  emissions: [['oui', /^oui/i], ['non', /^non/i]],
  collectiveFlue: [['oui', /^oui/i], ['non', /^non/i]],
  techCategory: [['rescert', /rescert/i], ['gii', /\bgii\b/i], ['gi', /\bgi\b/i], ['l', /\bl\b/i]],
  systemType: [['type2', /type 2|type2/i], ['type1', /type 1|type1/i]],
  collective: [['collectif', /collectif/i], ['individuel', /individuel/i]],
  fuel: [['gazeux', /gazeux/i], ['liquide', /liquide|mazout/i], ['solid', /solid/i]],
  condensation: [['pas', /pas\s+à\s+condensation/i], ['cond', /^à\s+condensation|^cond/i]],
};

export function selectedOption(field, value) {
  if (value == null || value === '') return null;
  const v = scalarText(value).trim();
  if (/^(oui|non|conforme|non conforme)$/i.test(v)) return v.toLowerCase();
  const rules = RULES[field]; if (!rules) return null;
  const hit = rules.find(([, re]) => re.test(v));
  return hit ? hit[0] : null;
}

export function buildBrusselsHtml(state) {
  const data = { ...state.data };
  const deadline=nextControlDate(data);
  if(deadline) data.nextDueDate=fmtDots(toISO(deadline));
  else delete data.nextDueDate;
  return { data };
}

export function renderBrusselsPrintHtml(state, templateHtml, signature) {
  const { data } = buildBrusselsHtml(state);
  let html = templateHtml.replace(/\{\{(\w+)\}\}/g, (_, k) => esc(valueFor(data, k)));
  const base = new URL('.', globalThis.location?.href || 'http://localhost/');
  html = html.replace(/(src|href)="(assets\/[^"]+)"/g, (_, a, p) => `${a}="${new URL(p, base).href}"`);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  applySignatureToDocument(doc, signature);
  const winners = {};
  doc.querySelectorAll('[data-tick]').forEach(el => {
    const [field, option] = el.dataset.tick.split(':');
    if (!(field in winners)) winners[field] = selectedOption(field, data[field]);
    const checked = winners[field] != null && norm(winners[field]) === norm(option);
    el.classList.toggle('on', checked);
    el.textContent = checked ? '✓' : '';
    el.setAttribute('aria-checked', String(checked));
  });
  return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
}

export async function openBrusselsPrint(state) {
  let res;
  try { res = await fetch(new URL('./brussels.html', import.meta.url), { headers: { Accept: 'text/html' }, cache: 'no-cache' }); }
  catch (e) { throw new Error('print-template-unavailable'); }
  if (!res.ok) throw new Error('print-template-unavailable');
  return renderBrusselsPrintHtml(state, await res.text(),
    signatureFor(state.data.signature, { width: 600, height: 100, lineScale: 2.6 }));
}