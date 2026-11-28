import {wallonia,fmt as wFmt} from './regions/wallonia.js';
import {flanders} from './regions/flanders.js';
import {brussels} from './regions/brussels.js';
import {buildAttestation} from './output.js';
import {openWalloniaPrint} from './print-wallonia.js';
import {openFlandersPrint} from './print-flanders.js';
import {openBrusselsPrint} from './print-brussels.js';
import {saveAttachmentBytes,loadAttachmentBytes,clearAttachmentBytes} from './attachments.js';
import {limitsForField} from './regions/wallonia-criteria.js';
import {limitsForField as flandersLimits} from './regions/flanders-criteria.js';
import {diagHelperHTML,wireDiagHelper} from './regions/diag-helper.js';
import {resolved,optionValue,optionLabel} from './lang.js';
import {validateWorkflow,validateEnteredFields,normalizeStep,hasOwn,parseNumber,isValidDate,attachmentsForFields,hasMissingAttachments,fieldInputType,measurementVerdict,errorAriaAttributes,scalarText,recognitionRequired} from './input-validation.js';
import {createSignaturePad} from './signature.js';
import {loadProfile,saveProfile,clearProfile,applyProfileToData,captureProfileFromData,profileFieldError,migrateProfile,normalizeProfile,emptyProfile,IDENTITY_KEYS,PROFILE_REGIONS} from './profile.js';
import {T} from './i18n.js';

const REGIONS = {wallonia,flanders,brussels};
const KEY = 'attesta.draft.v1';
const UI_KEY = 'attesta.uiLang';
const $ = id => document.getElementById(id);

function readUiLang(){ try{ const l=localStorage.getItem(UI_KEY); return l==='nl'||l==='fr'?l:null; }catch(e){ return null; } }
// The wizard UI can be switched per job (Flanders is bilingual). Document
// language is separate: state.lang is never read by the print/PDF path.
function activeLang(){ return state?.lang || cfg()?.lang || readUiLang() || 'fr'; }
function tr(){ return T[activeLang()]||T.fr; }

const ACK_KEY='attesta.acks.v1';
let acks=loadAcks();
function loadAcks(){ try{return JSON.parse(sessionStorage.getItem(ACK_KEY))||{};}catch(e){return {};} }
function saveAcks(){ sessionStorage.setItem(ACK_KEY,JSON.stringify(acks)); }

import {isComplete,statusText,statusOnIssue,statusOnHandoff} from './status.js';

// True only when the current job's data was just pre-filled from the profile
// (set at the three prefill sites, cleared on resume / region-null). Drives the
// "profile applied" chip so resumed jobs never falsely claim prefill.
let profileApplied = false;
let state = load();
let validationErrors = {};
if(state.status==='Done') state.status='Issued';
let generating = false;
let editingProfile = false;
let profileDraft = emptyProfile();
const attachmentFiles = new Map();
let attachmentLoadVersion=0;
function resetAttachmentFiles(){
  attachmentLoadVersion++;
  attachmentFiles.clear();
}
function restoreAttachmentBytes(region){
  const version=++attachmentLoadVersion;
  loadAttachmentBytes(region).then(map=>{
    if(version!==attachmentLoadVersion || state.region!==region) return;
    attachmentFiles.clear();
    for(const [key,files] of map){
      if(files&&files.length) attachmentFiles.set(key,files.map(f=>f.blob||f));
    }
    render();
  }).catch(e=>{ console.warn('Could not restore attachment bytes',e); });
}

function load(){
  let s=null;
  try{ s=migrateDraft(JSON.parse(localStorage.getItem(KEY))); }catch(e){ console.warn('Could not restore draft',e); }
  if(!s) s={region:null,step:0,data:{},status:'Draft'};
  const q=new URLSearchParams(location.search);
  const requested=q.get('region');
  if(requested&&hasOwn(REGIONS,requested) && s.region!==requested){
    const existing=readRegionDraft(requested);
    if(existing){ s=existing; }
    else{ const {data,applied}=prefillFor(requested); s={region:requested,step:0,data,status:'Draft',profileApplied:applied}; }
  }
  // Derive the chip flag from the FINAL draft (deep-link may have swapped it).
  profileApplied=s.profileApplied===true;
  if(s.region) s.step=normalizeStep(s.step,REGIONS[s.region].steps.length);
  if(q.get('step')){
    const region=REGIONS[s.region];
    s.step=normalizeStep(q.get('step'),region?.steps.length||0);
  }
  const lang=q.get('lang');
  if(s.region==='flanders' && (lang==='fr'||lang==='nl')) s.lang=lang;
  return s;
}
function isDraft(value,region){
  return !!value && typeof value==='object' && !Array.isArray(value) &&
    typeof value.data==='object' && value.data!==null && !Array.isArray(value.data) &&
    Object.hasOwn(REGIONS,value.region) && (!region||value.region===region);
}
// Single entry point for reading a stored draft. Centralizes version handling so
// future field changes migrate here (drafts are versioned by the KEY name).
function migrateDraft(raw){
  if(!isDraft(raw)) return null;
  return raw;
}
function readRegionDraft(region){
  try{
    const saved=migrateDraft(JSON.parse(localStorage.getItem(`${KEY}.${region}`)));
    if(saved){
      saved.step=normalizeStep(saved.step,REGIONS[region].steps.length);
      return saved;
    }
  }catch(e){ console.warn(`Could not restore ${region} draft`,e); }
  return null;
}
function save(){
  try{
    localStorage.setItem(KEY,JSON.stringify(state));
    if(state.region) localStorage.setItem(`${KEY}.${state.region}`,JSON.stringify(state));
  }
  catch(e){ console.warn('Could not save draft',e); }
  flashSaveStatus(tr().saved);
}
function flashSaveStatus(message){
  const el=$('saveStatus');
  if(el){ el.textContent=message; el.classList.add('show'); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),1600); }
}
function cfg(){ return REGIONS[state.region]; }
// pdf-lib + fontkit are heavy (~1.3 MB); load them only when a PDF is generated.
let pdfLibsPromise=null;
function ensurePdfLibs(){
  if(window.PDFLib && window.fontkit) return Promise.resolve();
  if(pdfLibsPromise) return pdfLibsPromise;
  const load=src=>new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>rej(new Error('lib-load-failed')); document.head.appendChild(s); });
  pdfLibsPromise=Promise.all([load('vendor/pdf-lib.min.js'),load('vendor/fontkit.umd.min.js')]).catch(e=>{ pdfLibsPromise=null; throw e; });
  return pdfLibsPromise;
}
// A field can be shown only for a given document choice (e.g. keuring checks).
const fieldVisible = f => {
  if(typeof f.when!=='function') return true;
  try{ return f.when(state.data); }catch(e){ return false; }
};
function selectedAttachments(){
  const c=cfg(); if(!c) return new Map();
  return attachmentsForFields(c.steps.flatMap(step=>step.fields),state.data,attachmentFiles);
}

/* ---------- header + footer ---------- */
function renderGlossary(){
  const entries=tr().glossary||[];
  $('glossarySummary').textContent=activeLang()==='nl'?'Woordenlijst':'Glossaire';
  $('glossaryList').innerHTML=entries.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
}
function renderChrome(){
  renderGlossary();
  const c=cfg();
  $('rule').style.background = c?c.rule:'#b23a2b';
  $('regionLabel').textContent = c?resolved(c.label,activeLang()):'—';
  const n=c?c.steps.length:0;
  $('progress').innerHTML = c ? Array.from({length:n},(_,i)=>
    `<i class="${i<state.step?'done':i===state.step?'on':''}"></i>`).join('') : '';
  $('stepCount').textContent = c ? `${Math.min(state.step+1,n)} / ${n}` : '';
  document.documentElement.lang = activeLang();
  const t=tr();
  const bilingual = !!c && c.id==='flanders';
  $('langSwitch').hidden=!bilingual;
  $('langFr').setAttribute('aria-pressed',String(activeLang()==='fr'));
  $('langNl').setAttribute('aria-pressed',String(activeLang()==='nl'));
  $('changeRegion').hidden=!c;
  $('changeRegion').textContent = t.changeRegion;
  $('progress').setAttribute('aria-label', t.progress);
  $('back').hidden=!c||state.step===0;
  $('back').disabled = !c||state.step===0;
  $('back').textContent = t.back;
  $('next').hidden=!c||state.step>=c.steps.length;
  $('next').textContent = t.next;

  const due = computeDue();
  $('due').hidden = !due;
  document.querySelector('.foot').classList.toggle('tall',!!due);
  if(due){
    $('dueDate').textContent = wFmt(due.date);
    $('dueLabel').textContent = c?.id==='brussels'&&state.data.conformity==='NON CONFORME'?t.remedyDeadline:t.nextControl;
  }
}

/* ---------- rules ---------- */
function computeDue(){
  const c=cfg(); if(!c||!isValidDate(state.data.controlDate)) return null;
  try{
    if(c.id==='brussels' && state.data.conformity==='NON CONFORME')
      return {date:c.rules.nonConformity(state.data.controlDate),note:activeLang()==='nl'?'5 maanden':'5 mois'};
    return c.rules.nextDue(state.data.controlDate,state.data);
  }catch(e){ return null; }
}
function warningFor(){
  const d=state.data, c=cfg(), t=tr(); if(!c) return '';
  const fuel=scalarText(d.fuel), intervention=scalarText(d.intervention);
  const out=[];
  if(c.id==='wallonia' && fuel && /gaz/i.test(fuel) && parseNumber(d.powerKw)===100)
    out.push(['kw100',t.w100]);
  if(c.id==='wallonia' && d.controlDate && !d.commissioningDate &&
     !/première mise en service/i.test(intervention))
    out.push(['anchor',t.wAnchor]);
  if(c.id==='flanders' && state.step===c.steps.length)
    out.push(['gate',t.wGate]);
  if(c.id==='brussels' && fuel && !/solide/i.test(fuel))
    out.push(['bru',t.wBru]);
  if(c.id==='wallonia' && d.conformity==='NON CONFORME')
    out.push(['nonconf',t.wNon]);
  return out.filter(([id])=>!acks[id]).map(([id,x],i)=>
    `<div class="warning ${i===0?'doubled':''}">${x}<button type="button" class="ack" data-ack="${id}">${t.ack}</button></div>`).join('');
}

/* ---------- field rendering ---------- */
function fieldHTML(f){
  const v=state.data[f.key]??'';
  const error=validationErrors[f.key];
  const bad=error?' bad':'';
  const id=`field-${f.key}`;
  const name=` name="${f.key}"`;
  const invalid=errorAriaAttributes(id,error);
  let input='';
  if(f.type==='select'){
    const options=f.options.map(o=>{
      const ov=optionValue(o);
      return `<option value="${esc(ov)}" ${v===ov?'selected':''}>${esc(optionLabel(o,activeLang()))}</option>`;
    }).join('');
    const blank=!f.options?.length || optionValue(f.options[0])!=='';
    input=`<select id="${id}"${name} data-k="${f.key}" ${f.required?'required':''}${invalid}>${blank?'<option value=""></option>':''}${options}</select>`;
  } else if(f.type==='textarea'){
    input=`<textarea id="${id}"${name} data-k="${f.key}" rows="2" ${f.required?'required':''}${invalid}>${esc(v)}</textarea>`;
  } else if(f.type==='file'){
    input=`<input id="${id}"${name} type="file" data-k="${f.key}" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" multiple ${f.required?'required':''}${invalid}>`;
  } else if(f.type==='checkbox'){
    input=`<input id="${id}"${name} type="checkbox" data-k="${f.key}" ${v===true?'checked':''} ${f.required?'required':''}${invalid}>`;
  } else if(f.type==='signature'){
    const t=tr();
    const stored=(v&&typeof v==='object'&&!Array.isArray(v))?v:null;
    const typed=stored&&typeof stored.typed==='string'?stored.typed:'';
    input=`<div class="sig">
      <canvas class="sig-canvas" id="${id}" role="img" aria-label="${esc(t.sigAria)}" aria-describedby="${id}-hint"></canvas>
      <div class="sig-hint" id="${id}-hint">${esc(t.sigHint)}</div>
      <div class="sig-actions">
        <button type="button" class="btn back sig-btn" data-act="clear">${esc(t.sigClear)}</button>
        <button type="button" class="btn back sig-btn" data-act="undo">${esc(t.sigUndo)}</button>
        <button type="button" class="btn back sig-btn" data-act="typed" data-sig="${f.key}" aria-expanded="false" aria-controls="${id}-typed">${esc(t.sigTypedToggle)}</button>
      </div>
      <div class="sig-typed" id="${id}-typed" hidden>
        <label class="sig-typed-label" for="${id}-typed-input">${esc(t.sigTypedLabel)}</label>
        <input id="${id}-typed-input" type="text" data-sig="${f.key}" data-sig-input value="${esc(typed)}" spellcheck="false" autocomplete="off"${invalid}>
      </div>
    </div>`;
  } else {
    const type=fieldInputType(f);
    input=`<input id="${id}"${name} type="${type}" data-k="${f.key}" value="${esc(v)}" ${f.required?'required':''}${invalid} spellcheck="false" autocomplete="off">`;
  }
  return `<div class="f ${bad} ${f.required?'req':''}"><label for="${id}">${esc(resolved(f.label,activeLang()))}</label>${input}${f.hint?`<div class="fhint">${esc(resolved(f.hint,activeLang()))}</div>`:''}<div class="err" id="${id}-error" ${error?'role="alert"':''}>${error?errorText(error):''}</div></div>`;
}
function errorText(code){
  if(code==='required') return tr().required;
  if(code==='missing') return tr().missing;
  return tr().invalid;
}
// Wallonia and Flanders use their official category tables. Compliance limits
// classify a reading; only physical bounds can make the input itself invalid.
function ruleFor(f){
  if(state.region==='wallonia') return limitsForField(state.data)[f.key] ?? null;
  if(state.region==='flanders') return flandersLimits(state.data)[f.key] ?? null;
  if(f.max!=null && f.lower) return {max:f.max,lower:true};
  if(f.min!=null) return {min:f.min};
  return null;
}
function measureHTML(f){
  const v=state.data[f.key];
  const id=`field-${f.key}`;
  const error=validationErrors[f.key];
  const rule=ruleFor(f);
  const lim = rule
    ? (rule.max!=null?`≤ ${rule.max}`:(rule.min!=null?`≥ ${rule.min}`:''))
    : (tr().noThreshold||'—');
  const invalid=errorAriaAttributes(id,error);
  if(f.pair){
    const obj=(v&&typeof v==='object'&&!Array.isArray(v))?v:{i:'',f:''};
    const initial=typeof obj.i==='string'||typeof obj.i==='number'?obj.i:'';
    const final=typeof obj.f==='string'||typeof obj.f==='number'?obj.f:'';
    return `<div class="mrow paired ${error?'bad':''}" id="row-${f.key}">
      <label class="ml" for="${id}-i">${esc(resolved(f.label,activeLang()))}${f.required?' *':''}<span class="thresh">${lim} ${f.unit||''}</span></label>
      <div class="pair-inputs">
        <label class="sub">I <input id="${id}-i" name="${f.key}.i" data-k="${f.key}" data-sub="i" value="${esc(initial)}" inputmode="decimal"${invalid}></label>
        <label class="sub">II <input id="${id}-f" name="${f.key}.f" data-k="${f.key}" data-sub="f" value="${esc(final)}" inputmode="decimal"${invalid}></label>
        <span class="verdict idle" data-verdict="i">—</span>
        <span class="verdict idle" data-verdict="f">—</span>
      </div><div class="err" id="${id}-error" ${error?'role="alert"':''}>${error?errorText(error):''}</div></div>`;
  }
  const verdict=measureVerdict(f,v);
  const text=verdict==='idle'?'—':verdict==='ok'?'OK':verdict==='invalid'?tr().invalid:'NON OK';
  return `<div class="mrow ${verdict==='idle'?'pending':''} ${verdict==='bad'?'warn':''} ${error?'bad':''}" id="row-${f.key}">
    <label class="ml" for="${id}">${esc(resolved(f.label,activeLang()))}${f.required?' *':''}<span class="thresh">${lim} ${f.unit||''}</span></label>
    <input id="${id}" name="${f.key}" data-k="${f.key}" value="${esc(v??'')}" inputmode="decimal" ${f.required?'required':''}${invalid}>
    <span class="verdict ${verdict}">${text}</span><div class="err" id="${id}-error" ${error?'role="alert"':''}>${error?errorText(error):''}</div></div>`;
}
function measureVerdict(f,value){
  return measurementVerdict(f,value,ruleFor(f),!!validationErrors[f.key]&&!f.pair);
}
function esc(s){ return scalarText(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function wireAcks(){
  $('warning').querySelectorAll('[data-ack]').forEach(b=>{
    b.setAttribute('aria-pressed','true');
    b.onclick=()=>{ acks[b.dataset.ack]=true; saveAcks(); render(); };
  });
}

/* ---------- render ---------- */
let lastFocusKey=null;
// Signature pads are DOM instances: destroy them before every re-render, or the
// ResizeObserver keeps a reference to a detached canvas.
const sigPads=[];
function destroySigPads(){ for(const p of sigPads) p.destroy(); sigPads.length=0; }
const onSigResize=()=>{ for(const p of sigPads) p.resize(); };
window.addEventListener('resize',onSigResize);
window.addEventListener('orientationchange',onSigResize);
function wireSignatures(){
  const c=cfg(); if(!c||state.step>=c.steps.length) return;
  const step=c.steps[state.step];
  for(const f of step.fields.filter(fieldVisible)){
    if(f.type!=='signature') continue;
    const root=$(`field-${f.key}`)?.closest('.f');
    const canvas=root?.querySelector('canvas');
    if(!canvas) continue;
    const hint=root.querySelector('.sig-hint');
    const typedWrap=root.querySelector('.sig-typed');
    const typedInput=root.querySelector('[data-sig-input]');
    const toggle=root.querySelector('[data-act="typed"]');
    let timer=null;
    const pad=createSignaturePad(canvas,{
      onChange(){
        const hasInk=!pad.isEmpty();
        const typedNow=typedInput?typedInput.value.trim():'';
        if(hasInk){
          if(typedInput) typedInput.value='';   // one representation at a time
          state.data[f.key]=pad.toData();
        }else if(typedNow!==''){
          state.data[f.key]={v:1,typed:typedInput.value};
        }else{
          delete state.data[f.key];
        }
        if(hint) hint.hidden=!hasInk&&typedNow==='';
        if(isComplete(state.status)){ state.status='Draft'; delete state.data.submittedAt; }
        clearTimeout(timer);
        timer=setTimeout(()=>{ save(); refreshFieldErrors(); },150);
      },
    });
    sigPads.push(pad);
    const stored=state.data[f.key];
    if(stored&&typeof stored==='object'&&!Array.isArray(stored)) pad.fromData(stored);
    const typed=stored&&typeof stored.typed==='string'?stored.typed:'';
    if(hint) hint.hidden=!pad.isEmpty()||typed.trim()!=='';
    root.querySelector('[data-act="clear"]').onclick=()=>{ if(typedInput) typedInput.value=''; pad.clear(); if(hint) hint.hidden=false; };
    root.querySelector('[data-act="undo"]').onclick=()=>{ pad.undo(); };
    if(toggle&&typedWrap){
      toggle.onclick=()=>{
        const open=toggle.getAttribute('aria-expanded')==='true';
        toggle.setAttribute('aria-expanded',String(!open));
        typedWrap.hidden=open;
        if(!open) typedInput?.focus();
      };
      if(typed.trim()!==''){ toggle.setAttribute('aria-expanded','true'); typedWrap.hidden=false; }
    }
    if(typedInput){
      typedInput.addEventListener('input',()=>{
        const text=typedInput.value;
        if(text.trim()!==''){
          if(!pad.isEmpty()) pad.clear(); // drawn and typed modes never coexist
          state.data[f.key]={v:1,typed:text};
        }
        else if(pad.isEmpty()) delete state.data[f.key];
        else state.data[f.key]=pad.toData();
        if(isComplete(state.status)){ state.status='Draft'; delete state.data.submittedAt; }
        if(hint) hint.hidden=text.trim()!==''||!pad.isEmpty();
        clearTimeout(timer);
        timer=setTimeout(()=>{ save(); refreshFieldErrors(); },150);
      });
    }
  }
}
function render(){
  destroySigPads();
  renderChrome();
  if(editingProfile){ lastFocusKey=null; renderProfileEditor(); return; }
  const c=cfg();
  if(!c){ lastFocusKey=null; renderRegionChoice(); return; }
  const isFinal=state.step>=c.steps.length;
  const focusKey=`${state.region}:${state.step}`;
  if(isFinal){ renderFinal(); maybeFocusHeading(focusKey); return; }
  const step=c.steps[state.step];
  if(!Object.keys(validationErrors).length)
    validationErrors=validateEnteredFields({...c,steps:[step]},state.data);
  $('stepTitle').textContent=resolved(step.title,activeLang());
  $('stepHint').textContent=resolved(step.hint,activeLang());
  $('warning').innerHTML=warningFor();
  $('warning').hidden=!$('warning').innerHTML;
  wireAcks();

  const visibleFields=step.fields.filter(fieldVisible);
  const measures=visibleFields.filter(f=>f.type==='measure');
  const normal=visibleFields.filter(f=>f.type!=='measure');
  let html = measures.length
    ? `<div class="measure">${measures.map(measureHTML).join('')}</div>`+normal.map(fieldHTML).join('')
    : normal.map(fieldHTML).join('');
  $('form').innerHTML=html;

  // Interactive diagnostic logigramme helper (feeds the diag* fields).
  if(step.helper==='diagnostic'){
    const h=document.createElement('div');
    h.innerHTML=diagHelperHTML(state.data);
    $('form').prepend(h);
    wireDiagHelper(h,(k,v)=>{
      state.data[k]=v;
      if(isComplete(state.status)){ state.status='Draft'; delete state.data.submittedAt; }
      save(); render();
    });
  }

  $('form').querySelectorAll('[data-k]').forEach(el=>{
    const k=el.dataset.k;
    const ev=el.type==='file'||el.type==='checkbox'||el.tagName==='SELECT'?'change':'input';
    el.addEventListener(ev,()=>{
      if(el.type==='file'){
        attachmentLoadVersion++;
        attachmentFiles.set(k,[...el.files]);
        state.data[k]=[...el.files].map(f=>f.name);
        saveAttachmentBytes(selectedAttachments(),state.region).catch(e=>console.warn('Could not persist attachment bytes',e));
      }else if(el.type==='checkbox'){
        state.data[k]=el.checked;
      }else if(el.dataset.sub){
        const current=state.data[k];
        const obj=(current&&typeof current==='object'&&!Array.isArray(current))?{...current}:{i:'',f:''};
        obj[el.dataset.sub]=el.value;
        state.data[k]=obj;
      }else{
        state.data[k]=el.value;
      }
      // Any edit invalidates a previously "Done" status.
      if(isComplete(state.status)){ state.status='Draft'; delete state.data.submittedAt; }
      save();
      refreshFieldErrors();
      if(k==='controlDate'||k==='powerKw'||k==='conformity'||k==='building'||k==='fuel'||k==='year'||k==='unitOrPulsed'){
        renderChrome();
      }
      if(el.closest('.mrow')) updateMeasure(el);
    });
  });
  $('form').querySelectorAll('.mrow input').forEach(updateMeasure);
  wireProfileSave();
  wireSignatures();
  maybeFocusHeading(focusKey);
}
// Move focus to the step heading only when the step/region changes — not on
// in-place re-renders (warning ack, measure recalc) which would steal focus.
function maybeFocusHeading(key){
  if(key===lastFocusKey) return;
  lastFocusKey=key;
  requestAnimationFrame(()=>{
    const heading=$('stepTitle');
    if(!heading) return;
    heading.setAttribute('tabindex','-1');
    heading.focus({preventScroll:true});
  });
}
function refreshFieldErrors(){
  const c=cfg(); if(!c||state.step>=c.steps.length) return;
  const step=c.steps[state.step];
  validationErrors=validateWorkflow({...c,steps:[step]},state.data,attachmentFiles);
  for(const field of step.fields.filter(fieldVisible)){
    const error=validationErrors[field.key];
    const root=$(`row-${field.key}`)||$(`field-${field.key}`)?.closest('.f');
    if(!root) continue;
    root.classList.toggle('bad',!!error);
    root.querySelectorAll('[data-k], [data-sig]').forEach(input=>{
      if(error){ input.setAttribute('aria-invalid','true'); input.setAttribute('aria-describedby',`field-${field.key}-error`); }
      else{ input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); }
    });
    const message=$(`field-${field.key}-error`);
    if(message){
      message.textContent=error?errorText(error):'';
      if(error) message.setAttribute('role','alert'); else message.removeAttribute('role');
    }
  }
}
function updateMeasure(input){
  const row=input.closest('.mrow'); if(!row) return;
  const k=input.dataset.k, f=cfg().steps[state.step].fields.find(x=>x.key===k);
  if(!f) return;
  if(input.dataset.sub){
    const verdict=measureVerdict(f,input.value);
    const vd=row.querySelector(`[data-verdict="${input.dataset.sub}"]`);
    if(vd){ vd.className='verdict '+verdict; vd.textContent=verdict==='idle'?'—':verdict==='ok'?'OK':verdict==='invalid'?tr().invalid:'NON OK'; }
    const filled=[...row.querySelectorAll('input')].some(i=>i.value!=='');
    row.classList.toggle('pending',!filled);
    row.classList.toggle('warn',[...row.querySelectorAll('input')].some(i=>measureVerdict(f,i.value)==='bad'));
    return;
  }
  const verdict=measureVerdict(f,input.value);
  const vd=row.querySelector('.verdict');
  if(!vd) return;
  vd.className='verdict '+verdict; vd.textContent=verdict==='idle'?'—':verdict==='ok'?'OK':verdict==='invalid'?tr().invalid:'NON OK';
  row.classList.toggle('pending',verdict==='idle');
  row.classList.toggle('warn',verdict==='bad');
}
function renderRegionChoice(){
  const t=tr();
  $('stepTitle').textContent=t.chooseTitle;
  $('stepHint').textContent=t.chooseHint;
  $('warning').hidden=true;
  $('form').innerHTML=`<div class="final"><h2>${t.chooseHead}</h2>
    <p>${t.chooseHint}</p>
    <div class="choices">${Object.values(REGIONS).map(r=>{
      const saved=readRegionDraft(r.id);
      const regionLabel=resolved(r.label,activeLang());
      const savedLabel=isComplete(saved?.status)?t.record(regionLabel):t.resume(regionLabel);
      return `<button type="button" class="choice red" data-region="${r.id}">${t.newIn(regionLabel)}</button>
        ${saved?`<button type="button" class="choice" data-resume="${r.id}">${savedLabel}</button>`:''}`;
    }).join('')}</div>
    <button type="button" class="btn back profile-open" id="openProfile">${esc(t.openProfile)}</button></div>`;
  const openBtn=$('openProfile');
  if(openBtn) openBtn.onclick=()=>{ profileDraft=sanitizeProfileCategories(loadProfile()); editingProfile=true; render(); };
  $('form').querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>{
      const saved=readRegionDraft(b.dataset.region);
      if(saved){
        const label=resolved(REGIONS[b.dataset.region].label,activeLang());
        const kind=isComplete(saved.status)?'record':'draft';
        if(!window.confirm(tr().confirmReplace(label,kind))) return;
      }
    const {data,applied}=prefillFor(b.dataset.region);
    state={region:b.dataset.region,step:0,data,status:'Draft',lang:REGIONS[b.dataset.region].lang,profileApplied:applied};
    profileApplied=applied;
    validationErrors={}; resetAttachmentFiles();
    lastFocusKey=null; save(); syncURL(); render();
  });
  $('form').querySelectorAll('[data-resume]').forEach(b=>b.onclick=()=>{
    state=readRegionDraft(b.dataset.resume)||{region:b.dataset.resume,step:0,data:{},status:'Draft'};
    profileApplied=state.profileApplied===true;
    validationErrors={}; resetAttachmentFiles(); restoreAttachmentBytes(state.region);
    lastFocusKey=null; save(); syncURL(); render();
  });
}
// First field definition with this key across a region's steps (label/options).
function regionField(region,key){
  const c=REGIONS[region];
  return c?c.steps.flatMap(s=>s.fields).find(f=>f.key===key)||null:null;
}
// Build the prefill data for a fresh job in `region` and whether it is non-empty.
// Single source of truth for the three prefill sites (load deep-link, new
// attestation, popstate region change) so the shape and "applied" rule can't drift.
function prefillFor(region){
  const data=applyProfileToData(sanitizeProfileCategories(loadProfile()),region);
  return {data, applied:Object.keys(data).length>0};
}
// Region-aware cleanup: drop a stored techCategory that is no longer a valid
// option for its region (shape-only normalizeProfile keeps stale strings). Pure
// and non-destructive — returns a new profile; callers persist only on Save.
function sanitizeProfileCategories(profile){
  const p=profile&&typeof profile==='object'?profile:emptyProfile();
  const recognition={};
  for(const region of PROFILE_REGIONS){
    const bucket=p.recognition?.[region];
    if(!bucket) continue;
    const copy={...bucket};
    const field=regionField(region,'techCategory');
    const values=(field?.options||[]).map(optionValue);
    if(copy.techCategory && values.length && !values.includes(copy.techCategory)) delete copy.techCategory;
    if(Object.keys(copy).length) recognition[region]=copy;
  }
  return {...p,recognition};
}
function profileInputHTML(key,scope,region){
  const field=regionField(scope==='identity'?'wallonia':region,key)||{label:key};
  const label=resolved(field.label,activeLang());
  const value=(scope==='identity'?profileDraft.identity[key]:profileDraft.recognition[region]?.[key])??'';
  const id=`pk-${scope}-${region||'all'}-${key}`;
  const regionAttr=region?` data-pk-region="${region}"`:'';
  const error=profileFieldError(profileDraft,scope,region,key,value);
  const invalid=error?` aria-invalid="true" aria-describedby="${id}-error"`:'';
  return `<div class="f ${error?'bad':''}"><label for="${id}">${esc(label)}</label>
    <input id="${id}" type="text" data-pk="${key}" data-pk-scope="${scope}"${regionAttr} value="${esc(value)}" spellcheck="false" autocomplete="off"${invalid}>
    <div class="err" id="${id}-error" ${error?'role="alert"':''}>${error?errorText(error):''}</div></div>`;
}
function profileCategoryHTML(region){
  const field=regionField(region,'techCategory');
  const options=field?.options||[];
  const label=resolved(field?.label||'techCategory',activeLang());
  const current=profileDraft.recognition[region]?.techCategory??'';
  const id=`pk-recognition-${region}-techCategory`;
  const opts=options.map(o=>{
    const ov=optionValue(o);
    return `<option value="${esc(ov)}" ${current===ov?'selected':''}>${esc(optionLabel(o,activeLang()))}</option>`;
  }).join('');
  const blank=!options.length||optionValue(options[0])!=='';
  return `<div class="f"><label for="${id}">${esc(label)}</label>
    <select id="${id}" data-pk="techCategory" data-pk-scope="recognition" data-pk-region="${region}">${blank?'<option value=""></option>':''}${opts}</select></div>`;
}
function renderProfileEditor(){
  const t=tr();
  $('stepTitle').textContent=t.profileTitle;
  $('stepHint').textContent=t.profileHint;
  $('warning').hidden=true;
  const identity=IDENTITY_KEYS.map(k=>profileInputHTML(k,'identity',null)).join('');
  const recognition=PROFILE_REGIONS.map(region=>{
    const label=resolved(REGIONS[region].label,activeLang());
    const bucket=profileDraft.recognition[region]||{};
    // Agrement is only expected where the region requires recognition for the
    // chosen category (e.g. solid-fuel categories in Flanders/Wallonia don't).
    const needAgrement=recognitionRequired(region,{techCategory:bucket.techCategory});
    const incomplete=!bucket.techCategory||(needAgrement&&!bucket.techAgrement);
    const badge=incomplete?` <span class="profile-badge">${esc(t.profileIncomplete)}</span>`:'';
    return `<div class="profile-block${incomplete?' incomplete':''}"><h3>${esc(label)}${badge}</h3>${profileCategoryHTML(region)}${profileInputHTML('techAgrement','recognition',region)}</div>`;
  }).join('');
  $('form').innerHTML=`<div class="profile-editor">
    <div class="profile-block"><h3>${esc(t.profileIdentity)}</h3>${identity}</div>
    ${recognition}
    <div class="profile-actions">
      <button type="button" class="btn next" id="profileSave">${esc(t.saveProfile)}</button>
      <button type="button" class="btn back" id="profileExport">${esc(t.exportProfile)}</button>
      <button type="button" class="btn back" id="profileImport">${esc(t.importProfile)}</button>
      <input type="file" id="profileImportFile" accept="application/json,.json" hidden>
      <button type="button" class="btn back" id="profileClear">${esc(t.clearProfile)}</button>
      <button type="button" class="btn back" id="profilePurge">${esc(t.purgeAll)}</button>
      <button type="button" class="btn back" id="profileBack">${esc(t.profileBack)}</button>
    </div></div>`;
  $('form').querySelectorAll('[data-pk]').forEach(el=>{
    const ev=el.tagName==='SELECT'?'change':'input';
    el.addEventListener(ev,()=>{
      const scope=el.dataset.pkScope, key=el.dataset.pk, region=el.dataset.pkRegion||null;
      if(scope==='identity') profileDraft.identity[key]=el.value;
      else{ if(!profileDraft.recognition[region]) profileDraft.recognition[region]={}; profileDraft.recognition[region][key]=el.value; }
      if(el.tagName!=='SELECT') refreshProfileFieldError(el);
      // Changing a region's category re-validates its recognition number.
      if(scope==='recognition' && key==='techCategory' && region){
        const agr=$(`pk-recognition-${region}-techAgrement`);
        if(agr) refreshProfileFieldError(agr);
      }
    });
  });
  $('profileSave').onclick=()=>{ saveProfile({...profileDraft,updatedAt:new Date().toISOString()}); editingProfile=false; flashSaveStatus(tr().profileSaved); render(); };
  $('profileExport').onclick=()=>{
    const data=normalizeProfile(profileDraft);
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    download(blob,'attesta-profile.json');
  };
  $('profileImport').onclick=()=>$('profileImportFile').click();
  $('profileImportFile').onchange=async()=>{
    const input=$('profileImportFile');
    const file=input?.files[0];
    if(!file) return;
    input.value=''; // reset before render() replaces the editor DOM
    try{
      const parsed=JSON.parse(await file.text());
      if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)) throw new Error('shape');
      profileDraft=sanitizeProfileCategories(migrateProfile(parsed));
      render();
      flashSaveStatus(tr().importOk);
    }catch(e){ flashSaveStatus(tr().importInvalid); }
  };
  $('profileClear').onclick=()=>{ if(!window.confirm(tr().confirmClearProfile)) return; clearProfile(); profileDraft=emptyProfile(); editingProfile=false; flashSaveStatus(tr().profileCleared); render(); };
  $('profilePurge').onclick=async()=>{
    if(!window.confirm(tr().confirmPurge)) return;
    try{ await clearAttachmentBytes(null); }catch(e){ console.warn('Could not clear attachment bytes',e); }
    clearProfile();
    try{ localStorage.removeItem(KEY); for(const r of PROFILE_REGIONS) localStorage.removeItem(`${KEY}.${r}`); }catch(e){ console.warn('Could not clear drafts',e); }
    acks={}; saveAcks();
    state={region:null,step:0,data:{},status:'Draft'};
    profileApplied=false;
    validationErrors={}; resetAttachmentFiles(); editingProfile=false; profileDraft=emptyProfile();
    lastFocusKey=null;
    flashSaveStatus(tr().profileCleared);
    syncURL();
    render();
  };
  $('profileBack').onclick=()=>{ editingProfile=false; render(); };
}
function refreshProfileFieldError(el){
  const scope=el.dataset.pkScope, key=el.dataset.pk, region=el.dataset.pkRegion||null;
  const error=profileFieldError(profileDraft,scope,region,key,el.value);
  const root=el.closest('.f');
  if(root) root.classList.toggle('bad',!!error);
  if(error){ el.setAttribute('aria-invalid','true'); el.setAttribute('aria-describedby',`${el.id}-error`); }
  else{ el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); }
  const msg=root?.querySelector('.err');
  if(msg){
    msg.textContent=error?errorText(error):'';
    if(error) msg.setAttribute('role','alert'); else msg.removeAttribute('role');
  }
}
function wireProfileSave(){
  const c=cfg();
  if(!c||state.step>=c.steps.length) return;
  const step=c.steps[state.step];
  if(!step.fields.some(f=>f.key==='techName')) return;
  const t=tr();
  if(profileApplied){
    const prof=loadProfile();
    let date='';
    if(prof.updatedAt){ const d=new Date(prof.updatedAt); if(!Number.isNaN(d.getTime())) date=` (${t.updatedOn} ${wFmt(d)})`; }
    $('form').insertAdjacentHTML('afterbegin',`<p class="profile-chip">${esc(t.profileApplied)}${esc(date)}</p>`);
  }
  const btn=document.createElement('button');
  btn.type='button'; btn.className='btn back profile-save'; btn.id='saveProfileBtn';
  btn.textContent=t.saveProfile;
  btn.onclick=()=>{
    const captured=captureProfileFromData(state.data,state.region,loadProfile());
    captured.updatedAt=new Date().toISOString();
    saveProfile(captured); flashSaveStatus(t.profileSaved);
  };
  $('form').appendChild(btn);
}
const VEKA_ITEMS=['Toesteltype','Locatie','Nominaal vermogen (kW)','Brandstof',
  'Brandertechniek','Bouwjaar','Type interventie','Datum uitvoering','Eindbeoordeling'];
const flDocuments=d=>typeof d.document==='string'&&d.document.includes('Keuringsrapport')
  ? ['Keuringsrapport','Verbrandingsattest']
  : ['Verbrandingsattest','Reinigingsattest'];
function renderFinal(){
  const c=cfg(), d=state.data, t=tr();
  const fuel=scalarText(d.fuel), solidBru=c.id==='brussels'&&/solide/i.test(fuel);
  $('stepTitle').textContent=t.ready;
  $('stepHint').textContent=t.readyHint;
  $('warning').innerHTML=warningFor(); $('warning').hidden=!$('warning').innerHTML;
  wireAcks();
  const isBruData = c.id==='brussels' && !solidBru;
  const docs = c.id==='wallonia' ? t.docs.wa
    : c.id==='flanders' ? t.docs.fl
    : solidBru ? [...t.docs.brSolid, ...(d.annex1mw?[t.annex]:[])]
    : t.docs.brData;
  const flDocs = c.id==='flanders' ? flDocuments(d) : docs;
  const due=computeDue();
  const regDeadline=c.id==='flanders'&&isValidDate(d.controlDate)
    ? wFmt(flanders.rules.registrationDeadline(d.controlDate)):null;
  const hasDefect=c.id==='flanders'&&flanders.steps.flatMap(step=>step.fields)
    .filter(fieldVisible).some(field=>/niet/i.test(scalarText(state.data[field.key])));
  const remedyDeadline=c.id==='flanders'&&isValidDate(d.controlDate)&&hasDefect
    ? wFmt(flanders.rules.remedy(d.controlDate)):null;
  const gate = c.id==='flanders'
    ? `<div class="gate">
        <div><strong>${t.vekaTitle} :</strong> ${d.vekaRef&&d.vekaDate?t.vekaRecorded:t.vekaRequired}</div>
        <div class="gate-sub">${t.vekaUnverified}</div>
        ${regDeadline?`<div class="gate-line">${t.vekaDeadline} : <b>${regDeadline}</b></div>`:''}
        ${remedyDeadline?`<div class="gate-line">${t.remedyDeadline} : <b>${remedyDeadline}</b></div>`:''}
        ${due?`<div class="gate-line">${t.nextControl} : <b>${wFmt(due.date)}</b> · ${esc(due.note||'')}</div>`:''}
        <div class="gate-sub">${t.vekaChecklist}</div>
        <ul class="veka-list">${VEKA_ITEMS.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
        <a class="veka-link" href="https://melding.veka.vlaanderen.be" target="_blank" rel="noopener">${esc(t.vekaLink)}</a>
      </div>`
    : '';
  const manualHandoff=isBruData;
  const body = manualHandoff?t.bruHandoff:t.previewBody;
  const goLabel = manualHandoff?t.openEncoder:t.downloadPdf;
  const gateLocked=c.id==='flanders'&&!(d.vekaRef&&d.vekaDate);
  const fileFields=c.steps.flatMap(s=>s.fields).filter(f=>f.type==='file');
  const missingFiles=hasMissingAttachments(fileFields,d,attachmentFiles);
  const docChoice=c.id==='flanders'&&flDocs.length>1
    ? `<div class="f"><label for="flDoc">${t.flDocChoice}</label><select id="flDoc">
        <option value="both">${t.flDocBoth}</option>
        ${flDocs.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}
      </select></div>` : '';
  $('form').innerHTML=`<div class="final"><h2>${esc(flDocs[0])}</h2>
    <p>${esc(body)}</p>
    <div class="doclist">${flDocs.map(x=>`<div>${esc(x)}</div>`).join('')}</div>
    ${missingFiles?`<p class="output-error">${esc(t.attachReloadWarning)}</p>`:''}
    ${docChoice}${gate}${manualHandoff?'':`<p class="sign-note">${esc(t.signNote)}</p>`}
    <p class="output-warning"><strong>${t.statusLabel} :</strong> ${esc(statusText(state.status,t))}${typeof d.submittedAt==='string'?` · ${t.submittedAt} ${esc(d.submittedAt.slice(0,10))}`:''}<br>${t.statusBody}</p>
    ${['Prepared','Issued','Registered'].includes(state.status)?'<button type="button" class="btn back" id="markSubmitted" style="margin-top:10px;width:100%">'+esc(t.markSubmitted)+'</button>':''}
    <p id="auditLine" class="audit-line" role="status"></p>
    <button type="button" class="btn next" id="go" style="margin-top:16px;width:100%" ${gateLocked?`disabled title="${esc(t.vekaDownloadError)}"`:''}>${goLabel}</button>
    ${solidBru?`<button type="button" class="btn back" id="goPrint" style="margin-top:10px;width:100%">${c.lang==='nl'?'Print / PDF (attestatie)':'Imprimer / PDF (attestatie)'}</button>`:''}
    <button type="button" class="btn back" id="newJob" style="margin-top:10px;width:100%">${t.startAnother}</button></div>`;
  $('newJob').onclick=()=>{
    if(!isComplete(state.status)&&!window.confirm(t.confirmNewJob)) return;
    const previousRegion=state.region;
    state={region:null,step:0,data:{},status:'Draft'};
    profileApplied=false;
    validationErrors={};
    resetAttachmentFiles();
    clearAttachmentBytes(previousRegion).catch(e=>console.warn('Could not clear attachment bytes',e));
    save();
    render();
  };
  if($('markSubmitted')) $('markSubmitted').onclick=()=>{
    state.status='Submitted';
    state.data.submittedAt=new Date().toISOString();
    save(); render();
  };
  if($('goPrint')) $('goPrint').onclick=async()=>{
    if(generating) return;
    generating=true; const b=$('goPrint'); b.disabled=true;
    try{
      if(!validateDraft()){ render(); return; }
      const printHtml=await openBrusselsPrint(state);
      const w=window.open('','_blank');
      if(!w) throw new Error('print popup blocked');
      w.document.open(); w.document.write(printHtml); w.document.close();
      w.addEventListener('load',()=>{ w.focus(); w.print(); },{once:true});
    }catch(e){ showOutputError(e.message||'print-failed'); }
    finally{ generating=false; if($('goPrint')){ $('goPrint').disabled=false; } }
  };
  $('go').onclick=async()=>{
    if(generating) return;
    generating=true;
    const button=$('go');
    button.disabled=true;
    button.textContent=t.gen;
    try{
      if(!validateDraft()){ render(); return; }
      if(c.id==='flanders' && (!d.vekaRef||!d.vekaDate)){
        showOutputError(t.vekaDownloadError);
        return;
      }
      if(c.id==='brussels' && !/solide/i.test(fuel)){
        const blob=await buildAttestation(state,selectedAttachments());
        download(blob,'attesta-brussels-data.json');
        window.open(c.encoder,'_blank','noopener');
        state.status=statusOnHandoff(c.id); save();
        return;
      }
      const audits=[];
      if(c.id==='flanders'||c.id==='wallonia'){
        // Data-driven HTML/CSS print view: real A4 layout, tables and checkboxes.
        // The browser print dialog saves the PDF.
        const printHtml=c.id==='flanders'?await openFlandersPrint(state):await openWalloniaPrint(state);
        const w=window.open('','_blank');
        if(!w) throw new Error('print popup blocked');
        w.document.open(); w.document.write(printHtml); w.document.close();
        w.addEventListener('load',()=>{ w.focus(); w.print(); },{once:true});
      }else{
        await ensurePdfLibs();
        const blob=await buildAttestation(state,selectedAttachments());
        if(blob.audit) audits.push(blob.audit);
        download(blob,`attesta-${c.id}.pdf`);
      }
      if(audits.length&&$('auditLine')){
        const printed=audits.reduce((n,a)=>n+a.printed.length,0);
        const warnings=audits.reduce((n,a)=>n+a.warnings.length,0);
        $('auditLine').textContent=`${t.auditSummary}: ${printed} · ${t.auditWarnings}: ${warnings}`;
      }
      state.status=statusOnIssue(c.id); save();
    }catch(e){
      console.error('Could not generate attestation',e);
      const stageMessages={font:t.errFont,template:t.errTemplate,annex:t.errAnnex,attachment:t.errAttachment};
      showOutputError(stageMessages[e.stage]||t.pdfGenError);
    }finally{
      generating=false;
      button.disabled=false;
      button.textContent=goLabel;
    }
  };
}
function showOutputError(message){
  let error=$('outputError');
  if(!error){
    error=document.createElement('p');
    error.id='outputError';
    error.className='output-error';
    error.setAttribute('role','alert');
    $('go').before(error);
  }
  error.textContent=message;
}
function download(blob,name){
  if(!window.URL||typeof URL.createObjectURL!=='function') throw new Error('download-unsupported');
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
  // Keep the URL alive long enough for slow browsers and download managers.
  setTimeout(()=>URL.revokeObjectURL(a.href),60000);
}

/* ---------- navigation ---------- */
function validate(){
  const c=cfg(), step=c.steps[state.step];
  if(!c||!step) return false;
  validationErrors=validateWorkflow({...c,steps:[step]},state.data,attachmentFiles);
  const ok=!Object.keys(validationErrors).length;
  if(!ok){
    render();
    requestAnimationFrame(()=>document.querySelector('.f.bad [data-k], .mrow.bad [data-k], .f.bad [data-sig]')?.focus());
  }
  return ok;
}
function validateDraft(){
  const c=cfg();
  if(!c) return false;
  validationErrors=validateWorkflow(c,state.data,attachmentFiles);
  const invalid=Object.keys(validationErrors).length>0;
  if(invalid){
    const firstIndex=c.steps.findIndex(step=>step.fields.some(field=>fieldVisible(field)&&validationErrors[field.key]));
    state.step=firstIndex>=0?firstIndex:0;
    render();
    requestAnimationFrame(()=>document.querySelector('.f.bad [data-k], .mrow.bad [data-k], .f.bad [data-sig]')?.focus());
  }
  return !invalid;
}
$('back').onclick=()=>{ if(state.step>0){state.step--;validationErrors={};save();syncURL();render();} };
$('changeRegion').onclick=()=>{
  const t=tr();
  const prompt=isComplete(state.status)?t.confirmChangeSaved:t.confirmChangeDraft;
  if(!window.confirm(prompt)) return;
  save();
  state={region:null,step:0,data:{},status:'Draft'};
  profileApplied=false;
  validationErrors={};
  resetAttachmentFiles();
  save();
  syncURL();
  render();
};
function setLang(lang,button){
  if(!state.region || (lang!=='fr' && lang!=='nl')) return;
  state.lang=lang;
  // Persist the explicit choice here only — not in generic save(), which would
  // clobber it with a region's default lang on every Wallonia/Brussels job.
  try{ localStorage.setItem(UI_KEY,lang); }catch(e){ /* non-fatal */ }
  // Keep the toggle focused: the header buttons are not re-rendered, so the
  // step heading must not steal focus on a language-only change.
  save(); syncURL(); render();
  button?.focus();
}
$('langFr').onclick=e=>setLang('fr',e.currentTarget);
$('langNl').onclick=e=>setLang('nl',e.currentTarget);

$('next').onclick=()=>{
  const c=cfg(); if(!c) return;
  if(state.step>=c.steps.length) return;
  if(!validate()) return;
  state.step++; save(); syncURL(); render();
};
// Keep the URL query params in sync with the active region/step so the wizard
// is deep-linkable and the browser Back button moves between steps.
function syncURL(){
  try{
    const url=new URL(location.href);
    if(state.region){
      url.searchParams.set('region',state.region);
      url.searchParams.set('step',String(state.step));
      if(state.lang && state.lang!==REGIONS[state.region].lang) url.searchParams.set('lang',state.lang);
      else url.searchParams.delete('lang');
    }else{
      url.searchParams.delete('region');
      url.searchParams.delete('step');
      url.searchParams.delete('lang');
    }
    history.replaceState(null,'',url);
  }catch(e){ /* non-fatal: URL sync is a convenience */ }
}
window.addEventListener('popstate',()=>{
  const q=new URLSearchParams(location.search);
  const region=q.get('region');
  if(region&&hasOwn(REGIONS,region)){
    const step=normalizeStep(q.get('step'),REGIONS[region].steps.length);
    const changingRegion=state.region!==region;
    const prefill=changingRegion?prefillFor(region):null;
    state={region,step,data:prefill?prefill.data:state.data,status:changingRegion?'Draft':state.status,
      lang:changingRegion?REGIONS[region].lang:state.lang,
      profileApplied:changingRegion?prefill.applied:(state.profileApplied===true)};
    profileApplied=state.profileApplied;
    validationErrors={};
    if(changingRegion) resetAttachmentFiles();
    lastFocusKey=null;
    save(); render();
  }else if(!region && state.region){
    save();
    state={region:null,step:0,data:{},status:'Draft'};
    profileApplied=false;
    validationErrors={};
    resetAttachmentFiles();
    lastFocusKey=null;
    render();
  }
});
window.addEventListener('keydown',e=>{
  if(e.key==='Enter' && editingProfile && e.target.matches('input, select')){
    e.preventDefault(); $('profileSave')?.click(); return;
  }
  if(e.key==='Enter' && e.target.matches('input:not([type="checkbox"]), select') && !e.target.closest('.final')){
    e.preventDefault();
    $('next').click();
  }
});
if('serviceWorker' in navigator && location.protocol!=='file:'){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').then(reg=>{
    const ask=()=>showUpdatePrompt(reg);
    if(reg.waiting) ask();
    reg.addEventListener('updatefound',()=>{
      const worker=reg.installing;
      if(!worker) return;
      worker.addEventListener('statechange',()=>{
        if(worker.state==='installed' && navigator.serviceWorker.controller) ask();
      });
    });
  }).catch(e=>{
    console.warn('Offline support could not be enabled',e);
  }));
}
// A waiting worker means a new version is installed but not yet active (install
// no longer calls skipWaiting, to avoid reloading mid-job). Offer the reload.
function showUpdatePrompt(reg){
  if($('updateBar')) return;
  const bar=document.createElement('div');
  bar.id='updateBar'; bar.className='update-bar';
  bar.innerHTML=`<span>${esc(tr().updateAvailable)}</span><button type="button" class="btn back" id="updateLater">${esc(tr().later)}</button><button type="button" class="btn next" id="updateReload">${esc(tr().reload)}</button>`;
  // In-flow in the header: a fixed bottom bar covered the Back/Next footer.
  document.querySelector('.head').appendChild(bar);
  $('updateLater').onclick=()=>bar.remove();
  $('updateReload').onclick=()=>{
    // Only this tab should reload when the worker activates; registering the
    // listener earlier would let another tab's update reload this job mid-way.
    navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});
    const worker=reg.waiting;
    if(worker) worker.postMessage({type:'SKIP_WAITING'});
    else location.reload();
  };
}
// Render immediately; then restore this draft's ticket bytes and re-render if
// they arrive, so a slow or unavailable IndexedDB can never leave the wizard blank.
render();
restoreAttachmentBytes(state.region);
