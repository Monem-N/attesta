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
    nextControl:'PROCHAIN CONTRÔLE',required:'Obligatoire',invalid:'Valeur invalide',
    vekaConfirmed:'Enregistrement VEKA confirmé',
    bruDataBody:'Bruxelles génère le PDF officiel. Ouvrez l’encodeur, ressaisissez les données préparées, puis téléchargez votre attestation officielle.',
    docs:{wa:['Attestation de contrôle (modèle AWAC)','Tickets de mesure ajoutés'],
      fl:['Verbrandingsattest','Reinigingsattest','Enregistrement VEKA effectué'],
      brSolid:['Attestation PEB — combustibles solides'],brData:['Paquet de données pour l’encodeur BE','Liste de ressaisie manuelle']},
    annex:'Annexe ≥ 1000 kW incluse',
    w100:'<strong>Limite 100 kW.</strong> La loi (≤100 kW) donne 3 ans, mais la note du modèle dit 2. Attesta applique 3 ans et affiche cet avertissement.',
    wGate:'<strong>Aucune attestation sans enregistrement.</strong> Saisissez la référence et la date VEKA avant le téléchargement.',
    wBru:'<strong>Pas de PDF ici.</strong> Les attestations gaz/mazout bruxelloises sont générées par Bruxelles Environnement. Attesta prépare les données pour la saisie manuelle.',
    wNon:'<strong>Non conforme.</strong> 5 mois pour remédier ; une exception résidentielle de 3 mois (1 sept.–30 avr.) peut s’appliquer.',
    gen:'Génération…', startAnother:'Nouvelle attestation', statusLabel:'Statut du document',
    statusBody:'Modèle et calques en attente de revue finale des coordonnées et de conformité légale. Vérifiez chaque champ avant un usage professionnel.',
    previewBody:'Attesta crée un aperçu PDF à partir des données saisies. Ses positions de champs et sa conformité légale ne sont pas vérifiées ; comparez-le au modèle officiel en vigueur avant tout usage professionnel.',
    bruHandoff:'Attesta ne peut pas émettre le PDF officiel Bruxelles gaz/mazout. Utilisez le JSON téléchargé comme aide, ressaisissez les données dans l’encodeur Bruxelles Environnement, puis téléchargez le document officiel.',
    vekaTitle:'Enregistrement VEKA', vekaRecorded:'Référence et date enregistrées', vekaRequired:'Référence et date requises',
    newIn:l=>`Nouvelle attestation — ${l}`, resume:l=>`Reprendre le brouillon ${l}`, record:l=>`Ouvrir l’enregistrement ${l}`,
    confirmReplace:(l,k)=>`Un enregistrement (${k}) pour ${l} existe. Démarrer un nouveau le remplacera. Continuer ?`,
    confirmChangeSaved:'Votre enregistrement complété restera sauvegardé. Changer de région ?',
    confirmChangeDraft:'Votre brouillon sera sauvegardé pour le reprendre plus tard. Changer de région ?',
    confirmNewJob:'Cette attestation non terminée sera sauvegardée pour la reprendre. En démarrer une autre ?',
    vekaDownloadError:'Saisissez une référence et une date VEKA avant de télécharger.',
    pdfGenError:'La génération du PDF a échoué. Vérifiez la connexion et les fichiers de modèle officiels, puis réessayez.',
    saved:'Brouillon enregistré'},
  nl:{back:'Terug',next:'Verder',download:'Downloaden',downloadPdf:'PDF downloaden',
    chooseTitle:'Attesta',chooseHint:'Kies de regio van deze interventie.',
    chooseHead:'Eén wizard. Drie regio’s.',
    chooseBody:'Attesta vult het officiële model voor uw regio in en downloadt het juiste document — of zegt precies wat u daarna moet doen.',
    ready:'Klaar om uit te geven',readyHint:'Controleer het resultaat voor uw regio.',
    readyBody:'Het officiële model is met uw gegevens gevuld. Download, onderteken en geef aan de klant.',
    needData:'Geen gegevens. Open het rooster en vul de metingen in.',
    openEncoder:'BE-encoder openen',ack:'Bevestigd',
    nextControl:'VOLGENDE CONTROLE',required:'Verplicht',invalid:'Ongeldige waarde',
    vekaConfirmed:'VEKA-registratie bevestigd',
    bruDataBody:'Brussel genereert het officiële PDF. Open de encoder, voer de voorbereide gegevens opnieuw in en download uw officiële attest.',
    docs:{wa:['Attestation de contrôle (AWAC-model)','Meetbewijzen toegevoegd'],
      fl:['Verbrandingsattest','Reinigingsattest','VEKA-registratie geregistreerd'],
      brSolid:['Attestation PEB — vaste brandstof'],brData:['Gegevenspakket voor BE-encoder','Lijst voor manuele invoer']},
    annex:'Bijlage ≥ 1000 kW inbegrepen',
    w100:'<strong>100 kW-grens.</strong> De wet (≤100 kW) geeft 3 jaar, maar voetnoot 14 van het model zegt 2. Attesta gebruikt 3 jaar en toont deze waarschuwing.',
    wGate:'<strong>Geen attest zonder registratie.</strong> Vul de VEKA-referentie en -datum in vóór het downloaden.',
    wBru:'<strong>Geen PDF hier.</strong> Brusselse gas/olie-attesten worden door Bruxelles Environnement gegenereerd. Attesta bereidt de gegevens voor manuelle invoer voor.',
    wNon:'<strong>Niet conform.</strong> 5 maanden om te herstellen ; één uitzondering van 3 maanden (1 sept.–30 apr.) kan gelden.',
    gen:'Genereren…', startAnother:'Nieuwe attestatie', statusLabel:'Documentstatus',
    statusBody:'Model en overlays wachten op de finale coördinaat- en wettelijke controle. Controleer elk veld vóór professioneel gebruik.',
    previewBody:'Attesta maakt een PDF-voorbeeld van de ingevoerde gegevens. De veldposities en wettelijke naleving zijn niet geverifieerd; vergelijk dit met het huidige officiële model vóór professioneel gebruik.',
    bruHandoff:'Attesta kan de officiële Brusselse gas/olie-PDF niet afgeven. Gebruik het gedownloade JSON als hulpmiddel, voer de gegevens opnieuw in in de BE-encoder en download daar het officiële document.',
    vekaTitle:'VEKA-registratie', vekaRecorded:'Referentie en datum geregistreerd', vekaRequired:'Referentie en datum vereist',
    newIn:l=>`Nieuwe attestatie — ${l}`, resume:l=>`Concept hervatten ${l}`, record:l=>`Opgeslagen ${l} openen`,
    confirmReplace:(l,k)=>`Er bestaat een opgeslagen record (${k}) voor ${l}. Een nieuwe starten vervangt het. Doorgaan?`,
    confirmChangeSaved:'Uw voltooide record blijft opgeslagen. Regio wijzigen?',
    confirmChangeDraft:'Uw concept wordt opgeslagen om later verder te gaan. Regio wijzigen?',
    confirmNewJob:'Deze onvoltooide attestatie wordt opgeslagen om later verder te gaan. Een nieuwe starten?',
    vekaDownloadError:'Voer een VEKA-referentie en -datum in vóór het downloaden.',
    pdfGenError:'PDF-generatie mislukt. Controleer de verbinding en de officiële modellen en probeer opnieuw.',
    saved:'Concept opgeslagen'}
};
function tr(){ return T[cfg()?.lang||'fr']||T.fr; }
const ACK_KEY='attesta.acks.v1';
let acks=loadAcks();
function loadAcks(){ try{return JSON.parse(sessionStorage.getItem(ACK_KEY))||{};}catch(e){return {};} }
function saveAcks(){ sessionStorage.setItem(ACK_KEY,JSON.stringify(acks)); }

let state = load();
let generating = false;
const attachmentFiles = new Map();

function load(){
  let s=null;
  try{ s=JSON.parse(localStorage.getItem(KEY)); }catch(e){ console.warn('Could not restore draft',e); }
  if(!isDraft(s)) s={region:null,step:0,data:{},status:'Draft'};
  const q=new URLSearchParams(location.search);
  if(q.get('region')&&REGIONS[q.get('region')] && s.region!==q.get('region')){
    s=readRegionDraft(q.get('region'))||{region:q.get('region'),step:0,data:{},status:'Draft'};
  }
  if(s.region) s.step=Math.max(0,Math.min(Number.isInteger(s.step)?s.step:0,REGIONS[s.region].steps.length));
  if(q.get('step')){
    const region=REGIONS[s.region];
    s.step=Math.max(0,Math.min(Number(q.get('step'))||0,region?.steps.length||0));
  }
  return s;
}
function isDraft(value,region){
  return !!value && typeof value==='object' && !Array.isArray(value) &&
    typeof value.data==='object' && value.data!==null && !Array.isArray(value.data) &&
    Object.hasOwn(REGIONS,value.region) && (!region||value.region===region);
}
function readRegionDraft(region){
  try{
    const saved=JSON.parse(localStorage.getItem(`${KEY}.${region}`));
    if(isDraft(saved,region)){
      saved.step=Math.max(0,Math.min(Number.isInteger(saved.step)?saved.step:0,REGIONS[region].steps.length));
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
}
function cfg(){ return REGIONS[state.region]; }

/* ---------- header + footer ---------- */
function renderChrome(){
  const c=cfg();
  $('rule').style.background = c?c.rule:'#b23a2b';
  $('regionLabel').textContent = c?c.label:'—';
  const n=c?c.steps.length:0;
  $('progress').innerHTML = c ? Array.from({length:n},(_,i)=>
    `<i class="${i<state.step?'done':i===state.step?'on':''}"></i>`).join('') : '';
  $('stepCount').textContent = c ? `${Math.min(state.step+1,n)} / ${n}` : '';
  document.documentElement.lang = c?c.lang:'fr';
  const t=tr();
  $('changeRegion').hidden=!c;
  $('back').hidden=!c||state.step===0;
  $('back').disabled = !c||state.step===0;
  $('next').hidden=!c||state.step>=c.steps.length;
  $('next').textContent = t.next;

  const due = computeDue();
  $('due').hidden = !due;
  document.querySelector('.foot').classList.toggle('tall',!!due);
  if(due){ $('dueDate').textContent = wFmt(due.date); $('dueLabel').textContent = t.nextControl; }
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
  const id=`field-${f.key}`;
  const name=` name="${f.key}"`;
  let input='';
  if(f.type==='select'){
    input=`<select id="${id}"${name} data-k="${f.key}" ${f.required?'required':''}><option value=""></option>${f.options.map(o=>
      `<option ${v===o?'selected':''}>${o}</option>`).join('')}</select>`;
  } else if(f.type==='textarea'){
    input=`<textarea id="${id}"${name} data-k="${f.key}" rows="2" ${f.required?'required':''}>${esc(v)}</textarea>`;
  } else if(f.type==='file'){
    input=`<input id="${id}"${name} type="file" data-k="${f.key}" accept="image/*,application/pdf" multiple>`;
  } else if(f.type==='checkbox'){
    input=`<input id="${id}"${name} type="checkbox" data-k="${f.key}" ${v?'checked':''}>`;
  } else {
    const isCode=f.key==='techAgrement'||f.key==='bce';
    input=`<input id="${id}"${name} type="${f.type==='number'?'number':f.type==='date'?'date':'text'}" data-k="${f.key}" value="${esc(v)}" ${f.required?'required':''} spellcheck="false" autocomplete="off">`;
  }
  return `<div class="f ${bad} ${f.required?'req':''}"><label for="${id}">${f.label}</label>${input}<div class="err" id="${id}-error">${f._err||''}</div></div>`;
}
function measureHTML(f){
  const v=state.data[f.key];
  const id=`field-${f.key}`;
  let verdict='idle', text='—';
  if(v!==''&&v!=null){
    const n=Number(v);
    const ok = (f.max!=null && f.lower ? n<=f.max : true) && (f.min!=null ? n>=f.min : true);
    verdict=ok?'ok':'bad'; text=ok?'OK':'NON OK';
  }
  const lim = f.max!=null?`≤ ${f.max}`:(f.min!=null?`≥ ${f.min}`:'');
  return `<div class="mrow ${v===''||v==null?'pending':''} ${verdict==='bad'?'warn':''}">
    <label class="ml" for="${id}">${f.label}<span class="thresh">${lim} ${f.unit||''}</span></label>
    <input id="${id}" name="${f.key}" data-k="${f.key}" value="${esc(v??'')}" inputmode="decimal" ${f.required?'required':''}>
    <span class="verdict ${verdict}">${text}</span></div>`;
}
function esc(s){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function wireAcks(){
  $('warning').querySelectorAll('[data-ack]').forEach(b=>b.onclick=()=>{
    acks[b.dataset.ack]=true; saveAcks(); render();
  });
}

/* ---------- render ---------- */
let lastFocusKey=null;
function render(){
  renderChrome();
  const c=cfg();
  if(!c){ lastFocusKey=null; renderRegionChoice(); return; }
  const isFinal=state.step>=c.steps.length;
  const focusKey=`${state.region}:${state.step}`;
  if(isFinal){ renderFinal(); maybeFocusHeading(focusKey); return; }
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
    const ev=el.type==='file'||el.type==='checkbox'||el.tagName==='SELECT'?'change':'input';
    el.addEventListener(ev,()=>{
      if(el.type==='file'){
        attachmentFiles.set(k,[...el.files]);
        state.data[k]=[...el.files].map(f=>f.name);
      }else if(el.type==='checkbox'){
        state.data[k]=el.checked;
      }else{
        state.data[k]=el.value;
      }
      save();
      if(k==='controlDate'||k==='powerKw'||k==='conformity'||k==='building'||k==='fuel'){
        renderChrome();
      }
      if(el.classList.contains('ml')||el.closest('.mrow')) updateMeasure(el);
    });
  });
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
    <p>${t.chooseHint}</p>
    <div class="choices">${Object.values(REGIONS).map(r=>{
      const saved=readRegionDraft(r.id);
      const savedLabel=saved?.status==='Done'?t.record(r.label):t.resume(r.label);
      return `<button type="button" class="choice red" data-region="${r.id}">${t.newIn(r.label)}</button>
        ${saved?`<button type="button" class="choice" data-resume="${r.id}">${savedLabel}</button>`:''}`;
    }).join('')}</div></div>`;
  $('form').querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>{
      const saved=readRegionDraft(b.dataset.region);
      if(saved){
        const label=REGIONS[b.dataset.region].label;
        const kind=saved.status==='Done'?'record':'draft';
        if(!window.confirm(tr().confirmReplace(label,kind))) return;
      }
    state={region:b.dataset.region,step:0,data:{},status:'Draft'};
    lastFocusKey=null; save(); syncURL(); render();
  });
  $('form').querySelectorAll('[data-resume]').forEach(b=>b.onclick=()=>{
    state=readRegionDraft(b.dataset.resume)||{region:b.dataset.resume,step:0,data:{},status:'Draft'};
    lastFocusKey=null; save(); syncURL(); render();
  });
}
function renderFinal(){
  const c=cfg(), d=state.data, t=tr();
  $('stepTitle').textContent=t.ready;
  $('stepHint').textContent=t.readyHint;
  $('warning').innerHTML=warningFor(); $('warning').hidden=!$('warning').innerHTML;
  wireAcks();
  const isBruData = c.id==='brussels' && !/solide/i.test(d.fuel||'');
  const docs = c.id==='wallonia' ? t.docs.wa
    : c.id==='flanders' ? t.docs.fl
    : /solide/i.test(d.fuel||'') ? [...t.docs.brSolid, ...(d.annex1mw?[t.annex]:[])]
    : t.docs.brData;
  const flDocs = c.id==='flanders' && d.document?.includes('Keuringsrapport')
    ? [d.document, ...t.docs.fl.slice(1)] : docs;
  const gate = c.id==='flanders'
    ? `<div class="gate"><strong>${t.vekaTitle} :</strong> ${d.vekaRef&&d.vekaDate?t.vekaRecorded:t.vekaRequired}</div>`
    : '';
  const manualHandoff=isBruData;
  const body = manualHandoff?t.bruHandoff:t.previewBody;
  const goLabel = manualHandoff?t.openEncoder:t.downloadPdf;
  $('form').innerHTML=`<div class="final"><h2>${esc(flDocs[0])}</h2>
    <p>${esc(body)}</p>
    <div class="doclist">${flDocs.map(x=>`<div>${esc(x)}</div>`).join('')}</div>
    ${gate}<p class="output-warning"><strong>${t.statusLabel} :</strong> ${t.statusBody}</p>
    <button type="button" class="btn next" id="go" style="margin-top:16px;width:100%">${goLabel}</button>
    <button type="button" class="btn back" id="newJob" style="margin-top:10px;width:100%">${t.startAnother}</button></div>`;
  $('newJob').onclick=()=>{
    if(state.status!=='Done'&&!window.confirm(t.confirmNewJob)) return;
    state={region:null,step:0,data:{},status:'Draft'};
    attachmentFiles.clear();
    save();
    render();
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
      if(c.id==='brussels' && !/solide/i.test(d.fuel||'')){
        const blob=await buildAttestation(state,attachmentFiles);
        download(blob,'attesta-brussels-data.json');
        window.open(c.encoder,'_blank','noopener');
        state.status='Done'; save();
        return;
      }
      if(c.id==='flanders'){
        const documents=d.document?.includes('Keuringsrapport')
          ? ['Keuringsrapport','Verbrandingsattest']
          : ['Verbrandingsattest','Reinigingsattest'];
        for(const document of documents){
          const documentState={...state,data:{...d,document}};
          const blob=await buildAttestation(documentState,attachmentFiles);
          download(blob,`attesta-flanders-${document.toLowerCase().replaceAll(/[^a-z0-9]+/gi,'-')}.pdf`);
        }
      }else{
        const blob=await buildAttestation(state,attachmentFiles);
        download(blob,`attesta-${c.id}.pdf`);
      }
      state.status='Done'; save();
    }catch(e){
      console.error('Could not generate attestation',e);
      showOutputError(t.pdfGenError);
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
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

/* ---------- navigation ---------- */
function validate(){
  const c=cfg(), step=c.steps[state.step]; let ok=true;
  step.fields.forEach(f=>{
    f._err='';
    const t=tr();
    if(f.required && (state.data[f.key]===''||state.data[f.key]==null)) { f._err=t.required; ok=false; }
    if(f.type==='checkbox' && f.required && state.data[f.key]!==true){ f._err=t.required; ok=false; }
    if(f.type==='select' && state.data[f.key] && f.options && !f.options.includes(state.data[f.key])) { f._err=t.invalid; ok=false; }
  });
  if(step.fields.some(f=>f.key==='techAgrement')){
    const pattern=recognitionPattern();
    const field=step.fields.find(f=>f.key==='techAgrement');
    if(pattern&&state.data.techAgrement&&!pattern.test(state.data.techAgrement)){
      field._err=tr().invalid;
    }
  }
  if(step.fields.find(f=>f.key==='techAgrement')?._err) ok=false;
  if(!ok){
    render();
    requestAnimationFrame(()=>document.querySelector('.f.bad [data-k], .mrow.bad [data-k]')?.focus());
  }
  return ok;
}
function recognitionPattern(){
  const c=cfg();
  if(c.id==='flanders'){
    if(state.data.techCategory?.includes('gasvormige')) return /^GV\d{5}$/i;
    if(state.data.techCategory?.includes('vloeibare')) return /^TV\d{5}$/i;
  }
  if(c.id==='brussels'){
    if(state.data.techCategory?.includes('GI')) return /^(GI|GII)$/i;
    if(state.data.techCategory?.includes('L')) return /^L$/i;
    if(state.data.techCategory?.includes('RESCERT')) return /^RESCERT$/i;
  }
  if(c.id==='wallonia'){
    if(state.data.techCategory?.includes('L')) return /^L\d*$/i;
    if(state.data.techCategory?.includes('GII')) return /^GII\d*$/i;
    if(state.data.techCategory?.includes('GI')) return /^GI\d*$/i;
    if(state.data.techCategory?.includes('solides')) return /^.+$/;
  }
  return null;
}
function validateDraft(){
  const c=cfg();
  if(!c) return false;
  const t=tr();
  for(let index=0;index<c.steps.length;index++){
    const step=c.steps[index];
    for(const f of step.fields){
      f._err='';
      if(f.required && (state.data[f.key]===''||state.data[f.key]==null)){ f._err=t.required; }
      if(f.type==='checkbox' && f.required && state.data[f.key]!==true){ f._err=t.required; }
      if(f.type==='select' && state.data[f.key] && f.options&&!f.options.includes(state.data[f.key])){ f._err=t.invalid; }
    }
  }
  const pattern=recognitionPattern();
  const field=cfg()?.steps.flatMap(step=>step.fields).find(f=>f.key==='techAgrement');
  if(pattern&&state.data.techAgrement&&!pattern.test(state.data.techAgrement)){
    if(field) field._err=t.invalid;
  }
  const invalid=cfg().steps.flatMap(step=>step.fields).some(f=>f._err);
  if(invalid){
    const firstIndex=cfg().steps.findIndex(step=>step.fields.some(f=>f._err));
    state.step=firstIndex>=0?firstIndex:0;
  }
  return !invalid;
}
$('back').onclick=()=>{ if(state.step>0){state.step--;save();syncURL();render();} };
$('changeRegion').onclick=()=>{
  const t=tr();
  const prompt=state.status==='Done'?t.confirmChangeSaved:t.confirmChangeDraft;
  if(!window.confirm(prompt)) return;
  save();
  state={region:null,step:0,data:{},status:'Draft'};
  save();
  syncURL();
  render();
};
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
    }else{
      url.searchParams.delete('region');
      url.searchParams.delete('step');
    }
    history.replaceState(null,'',url);
  }catch(e){ /* non-fatal: URL sync is a convenience */ }
}
window.addEventListener('popstate',()=>{
  const q=new URLSearchParams(location.search);
  const region=q.get('region');
  if(region&&REGIONS[region]){
    const step=Math.max(0,Math.min(Number(q.get('step'))||0,REGIONS[region].steps.length));
    state={region,step,data:state.region===region?state.data:{},status:state.region===region?state.status:'Draft'};
    lastFocusKey=null;
    save(); render();
  }else if(!region && state.region){
    save();
    state={region:null,step:0,data:{},status:'Draft'};
    lastFocusKey=null;
    render();
  }
});
window.addEventListener('keydown',e=>{
  if(e.key==='Enter' && e.target.matches('input:not([type="checkbox"]), select') && !e.target.closest('.final')){
    e.preventDefault();
    $('next').click();
  }
});
if('serviceWorker' in navigator && location.protocol!=='file:'){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>{
    console.warn('Offline support could not be enabled',e);
  }));
}
render();
