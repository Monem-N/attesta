import {wallonia,fmt as wFmt} from './regions/wallonia.js';
import {flanders} from './regions/flanders.js';
import {brussels} from './regions/brussels.js';
import {buildAttestation} from './output.js';

const REGIONS = {wallonia,flanders,brussels};
const KEY = 'attesta.draft.v1';
const $ = id => document.getElementById(id);

const T = {
  fr:{back:'Retour',next:'Continuer',download:'Télécharger',downloadPdf:'Télécharger le PDF',
    chooseTitle:'Attesta',chooseHint:'Choisissez la région de cette intervention.',
    chooseHead:'Un assistant. Trois régions.',
    chooseBody:'Attesta remplit le modèle officiel de votre région et télécharge le bon document — ou vous dit exactement quoi faire ensuite.',
    ready:'Prêt à émettre',readyHint:'Vérifiez le résultat pour votre région.',
    readyBody:'Le modèle officiel est rempli avec vos données. Téléchargez, signez et remettez au client.',
    needData:'Aucune donnée. Ouvrez le module et saisissez les mesures.',
    openEncoder:'Ouvrir l’encodeur BE',ack:'Accusé',
    w100:'<strong>Limite 100 kW.</strong> La loi (≤100 kW) donne 3 ans, mais la note du modèle dit 2. Attesta applique 3 ans et affiche cet avertissement.',
    wGate:'<strong>Aucune attestation sans enregistrement.</strong> Saisissez la référence et la date VEKA avant le téléchargement.',
    wBru:'<strong>Pas de PDF ici.</strong> Les attestations gaz/mazout bruxelloises sont générées par Bruxelles Environnement. Attesta prépare les données pour la saisie manuelle.',
    wNon:'<strong>Non conforme.</strong> 5 mois pour remédier ; une exception résidentielle de 3 mois (1 sept.–30 avr.) peut s’appliquer.'},
  nl:{back:'Terug',next:'Verder',download:'Downloaden',downloadPdf:'PDF downloaden',
    chooseTitle:'Attesta',chooseHint:'Kies de regio van deze interventie.',
    chooseHead:'Eén wizard. Drie regio’s.',
    chooseBody:'Attesta vult het officiële model voor uw regio in en downloadt het juiste document — of zegt precies wat u daarna moet doen.',
    ready:'Klaar om uit te geven',readyHint:'Controleer het resultaat voor uw regio.',
    readyBody:'Het officiële model is met uw gegevens gevuld. Download, onderteken en geef aan de klant.',
    needData:'Geen gegevens. Open het rooster en vul de metingen in.',
    openEncoder:'BE-encoder openen',ack:'Bevestigd',
    w100:'<strong>100 kW-grens.</strong> De wet (≤100 kW) geeft 3 jaar, maar voetnoot 14 van het model zegt 2. Attesta gebruikt 3 jaar en toont deze waarschuwing.',
    wGate:'<strong>Geen attest zonder registratie.</strong> Vul de VEKA-referentie en -datum in vóór het downloaden.',
    wBru:'<strong>Geen PDF hier.</strong> Brusselse gas/olie-attesten worden door Bruxelles Environnement gegenereerd. Attesta bereidt de gegevens voor manuelle invoer voor.',
    wNon:'<strong>Niet conform.</strong> 5 maanden om te herstellen ; één uitzondering van 3 maanden (1 sept.–30 apr.) kan gelden.'}
};
function tr(){ return T[cfg()?.lang||'fr']||T.fr; }
const ACK_KEY='attesta.acks.v1';
let acks=loadAcks();
function loadAcks(){ try{return JSON.parse(sessionStorage.getItem(ACK_KEY))||{};}catch(e){return {};} }
function saveAcks(){ sessionStorage.setItem(ACK_KEY,JSON.stringify(acks)); }

let state = load();

function load(){
  let s=null;
  try{ s=JSON.parse(localStorage.getItem(KEY)); }catch(e){}
  if(!s||!REGIONS[s.region]) s={region:null,step:0,data:{},status:'Draft'};
  const q=new URLSearchParams(location.search);
  if(q.get('region')&&REGIONS[q.get('region')]) s.region=q.get('region');
  if(q.get('step')) s.step=Math.max(0,Number(q.get('step'))||0);
  return s;
}
function save(){ localStorage.setItem(KEY,JSON.stringify(state)); }
function cfg(){ return REGIONS[state.region]; }

/* ---------- header + footer ---------- */
function renderChrome(){
  const c=cfg();
  $('rule').style.background = c?c.rule:'#b23a2b';
  $('regionLabel').textContent = c?c.label:'—';
  const n=7;
  $('progress').innerHTML = Array.from({length:n},(_,i)=>
    `<i class="${i<state.step?'done':i===state.step?'on':''}"></i>`).join('');
  $('stepCount').textContent = `STEP ${c?Math.min(state.step+1,n):1} / ${n}`;
  document.documentElement.lang = c?c.lang:'fr';
  const t=tr();
  $('back').disabled = state.step===0;
  $('next').textContent = c && state.step>=c.steps.length ? t.download : t.next;

  const due = computeDue();
  $('due').hidden = !due;
  document.querySelector('.foot').classList.toggle('tall',!!due);
  if(due) $('dueDate').textContent = wFmt(due.date);
}

/* ---------- rules ---------- */
function computeDue(){
  const c=cfg(); if(!c||!state.data.controlDate) return null;
  try{ return c.rules.nextDue(state.data.controlDate,state.data); }catch(e){ return null; }
}
function warningFor(){
  const d=state.data, c=cfg(), t=tr(); if(!c) return '';
  const out=[];
  if(c.id==='wallonia' && d.fuel && /gaz/i.test(d.fuel) && Number(d.powerKw)===100)
    out.push(['kw100',t.w100]);
  if(c.id==='flanders' && state.step===c.steps.length)
    out.push(['gate',t.wGate]);
  if(c.id==='brussels' && d.fuel && !/solide/i.test(d.fuel))
    out.push(['bru',t.wBru]);
  if(c.id==='wallonia' && d.conformity==='NON CONFORME')
    out.push(['nonconf',t.wNon]);
  return out.filter(([id])=>!acks[id]).map(([id,x],i)=>
    `<div class="warning ${i===0?'doubled':''}">${x}<button type="button" class="ack" data-ack="${id}">${t.ack}</button></div>`).join('');
}

/* ---------- field rendering ---------- */
function fieldHTML(f){
  const v=state.data[f.key]??''; const bad=f._err?' bad':'';
  let input='';
  if(f.type==='select'){
    input=`<select data-k="${f.key}"><option value=""></option>${f.options.map(o=>
      `<option ${v===o?'selected':''}>${o}</option>`).join('')}</select>`;
  } else if(f.type==='textarea'){
    input=`<textarea data-k="${f.key}" rows="2">${esc(v)}</textarea>`;
  } else if(f.type==='file'){
    input=`<input type="file" data-k="${f.key}" accept="image/*,application/pdf" multiple>`;
  } else {
    input=`<input type="${f.type==='number'?'number':f.type==='date'?'date':'text'}" data-k="${f.key}" value="${esc(v)}">`;
  }
  return `<div class="f ${bad} ${f.required?'req':''}"><label>${f.label}</label>${input}<div class="err">${f._err||''}</div></div>`;
}
function measureHTML(f){
  const v=state.data[f.key];
  let verdict='idle', text='—';
  if(v!==''&&v!=null){
    const n=Number(v);
    const ok = (f.max!=null && f.lower ? n<=f.max : true) && (f.min!=null ? n>=f.min : true);
    verdict=ok?'ok':'bad'; text=ok?'OK':'NON OK';
  }
  const lim = f.max!=null?`≤ ${f.max}`:(f.min!=null?`≥ ${f.min}`:'');
  return `<div class="mrow ${v===''||v==null?'pending':''} ${verdict==='bad'?'warn':''}">
    <span class="ml">${f.label}<span class="thresh">${lim} ${f.unit||''}</span></span>
    <input data-k="${f.key}" value="${esc(v??'')}" inputmode="decimal">
    <span class="verdict ${verdict}">${text}</span></div>`;
}
function esc(s){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function wireAcks(){
  $('warning').querySelectorAll('[data-ack]').forEach(b=>b.onclick=()=>{
    acks[b.dataset.ack]=true; saveAcks(); render();
  });
}

/* ---------- render ---------- */
function render(){
  renderChrome();
  const c=cfg();
  if(!c){ renderRegionChoice(); return; }
  const isFinal=state.step>=c.steps.length;
  if(isFinal){ renderFinal(); return; }
  const step=c.steps[state.step];
  $('stepTitle').textContent=step.title;
  $('stepHint').textContent=step.hint;
  $('warning').innerHTML=warningFor();
  $('warning').hidden=!$('warning').innerHTML;
  wireAcks();

  const measures=step.fields.filter(f=>f.type==='measure');
  const normal=step.fields.filter(f=>f.type!=='measure');
  let html = measures.length
    ? `<div class="measure">${measures.map(measureHTML).join('')}</div>`+normal.map(fieldHTML).join('')
    : normal.map(fieldHTML).join('');
  $('form').innerHTML=html;

  $('form').querySelectorAll('[data-k]').forEach(el=>{
    const k=el.dataset.k;
    const ev=el.type==='file'?'change':(el.tagName==='SELECT'?'change':'input');
    el.addEventListener(ev,()=>{
      state.data[k]= el.type==='file' ? [...el.files].map(f=>f.name) : el.value;
      save();
      if(['powerKw','fuel','controlDate','conformity','building'].includes(k)){
        if(el.tagName==='SELECT' || k!=='fuel'){ render(); }
      }
      if(el.classList.contains('ml')||el.closest('.mrow')) updateMeasure(el);
    });
  });
}
function updateMeasure(input){
  const row=input.closest('.mrow'); if(!row) return;
  const k=input.dataset.k, f=cfg().steps[state.step].fields.find(x=>x.key===k);
  const v=input.value; const vd=row.querySelector('.verdict');
  if(v===''){ vd.className='verdict idle'; vd.textContent='—'; row.classList.add('pending'); return; }
  const n=Number(v);
  const ok=(f.max!=null&&f.lower?n<=f.max:true)&&(f.min!=null?n>=f.min:true);
  vd.className='verdict '+(ok?'ok':'bad'); vd.textContent=ok?'OK':'NON OK';
  row.classList.toggle('pending',false);
  row.classList.toggle('warn',!ok);
}
function renderRegionChoice(){
  const t=tr();
  $('stepTitle').textContent=t.chooseTitle;
  $('stepHint').textContent=t.chooseHint;
  $('warning').hidden=true;
  $('form').innerHTML=`<div class="final"><h2>${t.chooseHead}</h2>
    <div class="choices">${Object.values(REGIONS).map(r=>
      `<button type="button" class="choice red" data-region="${r.id}"><span>${r.label}</span><span class="pick">→</span></button>`).join('')}</div></div>`;
  $('form').querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>{
    state.region=b.dataset.region; state.step=0; save(); render();
  });
}
async function issue(){
  const c=cfg(), d=state.data;
  if(c.id==='flanders' && !d.vekaRef){ render(); return; }
  const blob=await buildAttestation(state);
  if(c.id==='brussels' && !/solide/i.test(d.fuel||'')){
    download(blob,'attesta-brussels-data.json');
    window.open(c.encoder,'_blank','noopener');
  } else {
    download(blob,`attesta-${c.id}.pdf`);
  }
  state.status='Done'; save();
}
function renderFinal(){
  const c=cfg(), d=state.data, t=tr();
  $('stepTitle').textContent=t.ready;
  $('stepHint').textContent=t.readyHint;
  $('warning').innerHTML=warningFor(); $('warning').hidden=!$('warning').innerHTML;
  wireAcks();
  const docs = c.id==='wallonia' ? ['Attestation de contrôle (AWAC model)','Analyzer tickets appended']
    : c.id==='flanders' ? ['Verbrandingsattest','Reinigingsattest','VEKA registration recorded']
    : /solide/i.test(d.fuel||'') ? ['Attestation PEB — combustibles solides', d.annex1mw?'Annexe ≥ 1000 kW included':''].filter(Boolean)
    : ['Data package for Bruxelles Environnement encoder','Manual re-key checklist'];
  const isBruData = c.id==='brussels' && !/solide/i.test(d.fuel||'');
  const gate = c.id==='flanders' ? `<div class="gate"><input id="vekaCheck" type="checkbox" ${d.vekaRef?'checked':''}><label for="vekaCheck">VEKA registration confirmed</label></div>` : '';
  $('form').innerHTML=`<div class="final"><h2>${docs[0]}</h2>
    <p>${isBruData?'Brussels generates the official PDF. Open the encoder, re-key the prepared data, then download your official attestation.':t.readyBody}</p>
    <div class="doclist">${docs.map(x=>`<div>${esc(x)}</div>`).join('')}</div>
    ${gate}<button type="button" class="btn next" id="go" style="margin-top:16px;width:100%">${isBruData?t.openEncoder:t.downloadPdf}</button></div>`;
  $('go').onclick=issue;
}
function download(blob,name){
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

/* ---------- navigation ---------- */
function validate(){
  const c=cfg(), step=c.steps[state.step]; let ok=true;
  step.fields.forEach(f=>{
    f._err='';
    if(f.required && (state.data[f.key]===''||state.data[f.key]==null)) { f._err='Required'; ok=false; }
    if(f.type==='select' && state.data[f.key] && f.options && !f.options.includes(state.data[f.key])) { f._err='Invalid'; ok=false; }
  });
  if(!ok) render();
  return ok;
}
$('back').onclick=()=>{ if(state.step>0){state.step--;save();render();} };
$('next').onclick=()=>{
  const c=cfg(); if(!c) return;
  if(state.step>=c.steps.length){ issue(); return; }
  if(!validate()) return;
  state.step++; save(); render();
};
window.addEventListener('keydown',e=>{
  if(e.key==='Enter' && e.target.tagName!=='TEXTAREA'){ e.preventDefault(); $('next').click(); }
});
if('serviceWorker' in navigator && location.protocol!=='file:'){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
render();
