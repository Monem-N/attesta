// Data-driven print view for the Wallonia attestation.
// The HTML/CSS template reproduces the A4 form; this module injects the
// collected data, resolves checkbox marks, and opens the browser print dialog.
import {walloniaComputed} from './regions/wallonia-pdf.js';

const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function valueFor(data,key){
  const d=data;
  switch(key){
    case 'controlDate': return fmtDots(d.controlDate);
    case 'attestNumber': return d.attestNumber||'';
    case 'techName': return d.techName||'';
    case 'techAgrement': return d.techAgrement||'';
    case 'company': return d.company||'';
    case 'techPhone': return d.techPhone||'';
    case 'techEmail': return d.techEmail||'';
    case 'bce': return d.bce||'';
    case 'clientName': return d.clientName||'';
    case 'clientStreet': return d.clientStreetName||d.clientStreet||'';
    case 'clientNumber': return d.clientStreetNumber||'';
    case 'clientCity': return d.clientCity||'';
    case 'burnerModel': return d.model||d.burnerModel||'';
    case 'serial': return d.serial||'';
    case 'powerKw': return d.powerKw||'';
    case 'year': return d.year||'';
    case 'analyzerMake': return d.analyzerMake||'';
    case 'analyzerSerial': return d.analyzerSerial||'';
    case 'flueTemp': return d.flueTemp??'';
    case 'co2': return d.co2??'';
    case 'o2': return d.o2??'';
    case 'co': return d.co??'';
    case 'efficiency': return d.efficiency??'';
    case 'nextFrom': return fmtDots(d.nextFrom);
    case 'nextTo': return fmtDots(d.nextTo);
    case 'maintenanceDate': return fmtDots(d.maintenanceDate);
    case 'recipientCapacity': return d.recipientCapacity||'';
    case 'raccordementDetail': return d.raccordementDetail||d.raccordement||'';
    default: return d[key]??'';
  }
}
function fmtDots(v){
  const s=String(v||'');
  const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if(iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  const slash=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s); if(slash) return `${slash[1]}.${slash[2]}.${slash[3]}`;
  return s;
}
function matches(key,value){
  const [field,option]=key.split(':');
  const v=String(value??'').toLowerCase().trim();
  const o=option.toLowerCase();
  if(o==='agréé') return /agréé|l|gi|gii/i.test(v) && !/solide/i.test(v);
  if(o==='l') return /\bl\b/i.test(v);
  if(o==='gi') return /\bgi\b/i.test(v);
  if(o==='gii') return /\bgii\b/i.test(v);
  if(o==='propri') return /propri/i.test(v);
  if(o==='locataire') return /locat/i.test(v);
  if(o==='autre') return /autre/i.test(v);
  if(o==='gasoil') return /(^| )gasoil$/i.test(v);
  if(o==='g20') return /g20/i.test(v);
  if(o==='g25') return /g25/i.test(v);
  if(o==='1 allure') return /1 allure/i.test(v);
  if(o==='plusieurs') return /plusieurs/i.test(v);
  if(o==='modulant') return /modulant/i.test(v);
  if(o==='unit') return /^unit/i.test(v);
  if(o==='air pulsé') return /air.?puls/i.test(v);
  if(o==='prémix') return /^prémix/i.test(v);
  if(o==='non-premix') return /non.?premix/i.test(v);
  if(o==='absente') return /absente/i.test(v);
  if(o==='présente') return /présente/i.test(v);
  if(o==='eau') return /eau/i.test(v);
  if(o==='vapeur') return /vapeur/i.test(v);
  if(o==='huile') return /huile/i.test(v);
  if(o==='chauffage') return /^chauffage/i.test(v);
  if(o==='ecs') return /^ecs$/i.test(v);
  if(o==='chauffage+ecs') return /chauff.*ecs|ecs.*chauff/i.test(v);
  if(o==='avant') return /avant/i.test(v);
  if(o==='après') return /apr[eè]s/i.test(v);
  if(o==='oui') return /^oui|^conforme/i.test(v);
  if(o==='non') return /^non/i.test(v);
  if(o==='conforme') return /pr[eé]sent et conforme/i.test(v);
  if(o==='non conforme') return /pr[eé]sent et non conforme/i.test(v);
  if(o==='absent') return /absent/i.test(v);
  if(o==='auto') return /auto/i.test(v);
  if(o==='man') return /man/i.test(v);
  if(o==='prochaine inspection') return /prochaine inspection/i.test(v);
  if(o==='mise en conformité') return /mise en conformit/i.test(v);
  if(o==='remise en service') return /remise en service/i.test(v);
  if(o==='entretien') return /entretien/i.test(v);
  if(o==='diagnostic') return /diagnostic/i.test(v);
  return v.includes(o);
}

export function buildWalloniaHtml(state){
  const data=state.region==='wallonia'?walloniaComputed(state.data):state.data;
  return {htmlTemplate:'wallonia.html',data};
}

export async function openWalloniaPrint(state){
  const {data}=buildWalloniaHtml(state);
  let res;
  try{ res=await fetch('wallonia.html'); }
  catch(e){ throw new Error('print-template-unavailable'); }
  if(!res.ok) throw new Error('print-template-unavailable');
  let html=await res.text();

  // replace value tokens
  html=html.replace(/\{\{(\w+)\}\}/g,(_,k)=>escapeHtml(valueFor(data,k)));

  // resolve checkbox marks
  const doc=new DOMParser().parseFromString(html,'text/html');
  doc.querySelectorAll('[data-tick]').forEach(el=>{
    const [field]=el.dataset.tick.split(':');
    const checked=matches(el.dataset.tick,data[field]);
    el.classList.toggle('on',checked);
    el.textContent=checked?'✓':'';
  });
  html='<!DOCTYPE html>'+doc.documentElement.outerHTML;

  const w=window.open('','_blank');
  if(!w) throw new Error('print-popup-blocked');
  w.document.open(); w.document.write(html); w.document.close();
  w.addEventListener('load',()=>{ w.focus(); w.print(); },{once:true});
  return true;
}
