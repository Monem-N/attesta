// Data-driven print view for the Wallonia attestation.
// Fetches the A4 HTML template, injects collected data, resolves exactly one
// printed option per field (exclusive), and opens the browser print dialog.
import {walloniaComputed} from './regions/wallonia-pdf.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function fmtDots(v){
  const s=String(v??'');
  const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if(iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  const slash=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s); if(slash) return `${slash[1]}.${slash[2]}.${slash[3]}`;
  return s;
}

export function valueFor(data,key){
  const d=data;
  const map={
    controlDate:()=>fmtDots(d.controlDate), attestNumber:()=>d.attestNumber||'',
    techName:()=>d.techName||'', techAgrement:()=>d.techAgrement||'',
    company:()=>d.company||'', techPhone:()=>d.techPhone||'', techEmail:()=>d.techEmail||'',
    bce:()=>d.bce||'', clientName:()=>d.clientName||'',
    clientStreet:()=>d.clientStreetName||d.clientStreet||'', clientNumber:()=>d.clientStreetNumber||'',
    clientCity:()=>d.clientCity||'', burnerModel:()=>d.model||d.burnerModel||'',
    serial:()=>d.serial||'', powerKw:()=>d.powerKw||'', year:()=>d.year||'',
    analyzerMake:()=>d.analyzerMake||'', analyzerSerial:()=>d.analyzerSerial||'',
    flueTemp:()=>d.flueTemp??'', co2:()=>d.co2??'', o2:()=>d.o2??'',
    co:()=>d.co??'', efficiency:()=>d.efficiency??'',
    nextFrom:()=>fmtDots(d.nextFrom), nextTo:()=>fmtDots(d.nextTo),
    maintenanceDate:()=>fmtDots(d.maintenanceDate),
    recipientCapacity:()=>d.recipientCapacity||'',
    raccordementDetail:()=>d.raccordementDetail||d.raccordement||'',
  };
  return map[key]?map[key]():d[key]??'';
}

// Ordered, specific rules. The FIRST matching option for a field wins, so
// "GII" cannot also tick GI, and "présent et non conforme" cannot tick "conforme".
const RULES={
  techCategory:[['solide',/solide/i],['gii',/\bgii\b/i],['gi',/\bgi\b/i],['l',/\bl\b/i],['agréé',/agréé/i]],
  requester:[['propriétaire',/propri/i],['locataire',/locat/i],['autre',/autre/i]],
  fuelDetail:[['g20',/g20/i],['g25',/g25/i],['propane',/propane/i],['butane',/butane/i],['biogaz',/biogaz/i],
    ['gasoil extra',/gasoil extra/i],['fuel lourd',/fuel lourd/i],['gasoil',/(^| )gasoil$/i],
    ['pellets',/pellets/i],['bûches',/b[uû]ches/i],['plaquettes',/plaquettes/i],['céréales',/c[eé]r[eé]ales/i],['charbon',/charbon/i]],
  burnerType:[['plusieurs allures',/plusieurs/i],['modulant',/modulant/i],['1 allure',/1 allure/i]],
  unitOrPulsed:[['air pulsé',/air.?puls/i],['unit',/^unit/i]],
  premix:[['non-premix',/non.?premix/i],['prémix',/^prémix/i]],
  plaque:[['absente',/absente/i],['présente',/présente/i]],
  fluid:[['vapeur',/vapeur/i],['huile',/huile/i],['eau',/eau/i]],
  production:[['chauffage+ecs',/chauff.*ecs|ecs.*chauff/i],['ecs',/^ecs|^eau chaude/i],['chauffage',/^chauffage/i]],
  raccordement:[['b',/^b$/i],['c',/^c$/i]],
  condensation:[['oui',/^oui/i],['non',/^non/i]],
  permisDate:[['avant',/avant/i],['après',/apr[eè]s/i]],
  ventLocal:[['oui',/^oui/i]], airSupply:[['oui',/^oui/i]], flue:[['oui',/^oui/i]],
  orifices:[['non conforme',/non conforme/i],['conforme',/conforme/i],['absent',/absent/i],['dispensé',/dispens/i]],
  conformity:[['non',/^non/i],['oui',/^oui|^conforme/i]],
  regulationMode:[['auto',/auto/i],['man',/man/i]],
  followUp:[['non conformité',/mise en conformit/i],['remise en service',/remise en service/i],
    ['diagnostic',/diagnostic/i],['entretien',/entretien/i],['conformité',/prochaine inspection|conformit/i]],
};

// Which single option key is selected for a field value.
export function selectedOption(field,value){
  const rules=RULES[field]; if(!rules||value==null||value==='') return null;
  const v=String(value).toLowerCase().trim();
  const hit=rules.find(([,re])=>re.test(v));
  return hit?hit[0]:null;
}

export function buildWalloniaHtml(state){
  const data=state.region==='wallonia'?walloniaComputed(state.data):state.data;
  return {htmlTemplate:'wallonia.html',data};
}

export function renderWalloniaPrintHtml(state,templateHtml){
  const {data}=buildWalloniaHtml(state);
  let html=templateHtml.replace(/\{\{(\w+)\}\}/g,(_,k)=>esc(valueFor(data,k)));
  // The print view opens in a blank window, so relative asset URLs would
  // resolve against about:blank and break. Make them absolute to this app.
  const base=new URL('.',globalThis.location?.href||'http://localhost/');
  html=html.replace(/(src|href)="(assets\/[^"]+)"/g,(_,attr,p)=>
    `${attr}="${new URL(p,base).href}"`);
  const doc=new DOMParser().parseFromString(html,'text/html');
  const winners={};
  doc.querySelectorAll('[data-tick]').forEach(el=>{
    const [field,option]=el.dataset.tick.split(':');
    if(!(field in winners)) winners[field]=selectedOption(field,data[field]);
    const checked=winners[field]===option;
    el.classList.toggle('on',checked);
    el.textContent=checked?'✓':'';
  });
  return '<!DOCTYPE html>'+doc.documentElement.outerHTML;
}

export async function openWalloniaPrint(state){
  let res;
  try{ res=await fetch('wallonia.html'); }
  catch(e){ throw new Error('print-template-unavailable'); }
  if(!res.ok) throw new Error('print-template-unavailable');
  return renderWalloniaPrintHtml(state,await res.text());
}
