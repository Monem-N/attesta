import {wallonia,fmt as wFmt} from './regions/wallonia.js';
import {flanders} from './regions/flanders.js';
import {brussels} from './regions/brussels.js';
import {buildAttestation} from './output.js';
import {openWalloniaPrint} from './print-wallonia.js';
import {openFlandersPrint} from './print-flanders.js';
import {openBrusselsPrint} from './print-brussels.js';
import {saveAttachmentBytes,loadAttachmentBytes,clearAttachmentBytes} from './attachments.js';
import {limitsForField} from './regions/wallonia-criteria.js';
import {diagHelperHTML,wireDiagHelper} from './regions/diag-helper.js';
import {resolved,optionValue,optionLabel,optionValues} from './lang.js';

const REGIONS = {wallonia,flanders,brussels};
const KEY = 'attesta.draft.v1';
const $ = id => document.getElementById(id);

const T = {
  fr:{back:'Retour',next:'Continuer',download:'Télécharger',downloadPdf:'Imprimer / enregistrer en PDF',changeRegion:'Changer de région',progress:'Progression',
    chooseTitle:'Attesta',chooseHint:'Choisissez la région de cette intervention.',
    chooseHead:'Un assistant. Trois régions.',
    chooseBody:'Attesta remplit le modèle officiel de votre région et télécharge le bon document — ou vous dit exactement quoi faire ensuite.',
    ready:'Prêt à émettre',readyHint:'Vérifiez le résultat pour votre région.',
    readyBody:'Le modèle officiel est rempli avec vos données. Téléchargez, signez et remettez au client.',
    needData:'Aucune donnée. Ouvrez le module et saisissez les mesures.',
    openEncoder:'Ouvrir l’encodeur BE',ack:'Accusé',
    nextControl:'PROCHAIN CONTRÔLE',required:'Obligatoire',invalid:'Valeur invalide',
    noThreshold:'Aucun seuil imprimé pour cette catégorie',
    vekaConfirmed:'Enregistrement VEKA confirmé',
    bruDataBody:'Bruxelles génère le PDF officiel. Ouvrez l’encodeur, ressaisissez les données préparées, puis téléchargez votre attestation officielle.',
    docs:{wa:['Attestation de contrôle (modèle AWAC)','Tickets de mesure ajoutés'],
      fl:['Verbrandingsattest','Reinigingsattest','Enregistrement VEKA effectué'],
      brSolid:['Attestation PEB — combustibles solides'],brData:['Paquet de données pour l’encodeur BE','Liste de ressaisie manuelle']},
    annex:'Annexe ≥ 1000 kW incluse',
    w100:'<strong>Limite 100 kW.</strong> La loi (≤100 kW) donne 3 ans, mais la note du modèle dit 2. Attesta applique 3 ans et affiche cet avertissement.',
    wAnchor:'<strong>Échéance provisoire.</strong> Sans date de première mise en service, Attesta calcule depuis la date du contrôle. Ajoutez cette date pour une échéance conforme à l’art. 13 §2.',
    wGate:'<strong>Aucune attestation sans enregistrement.</strong> Saisissez la référence et la date VEKA avant le téléchargement.',
    wBru:'<strong>Pas de PDF ici.</strong> Les attestations gaz/mazout bruxelloises sont générées par Bruxelles Environnement. Attesta prépare les données pour la saisie manuelle.',
    wNon:'<strong>Non conforme.</strong> 5 mois pour remédier ; une exception résidentielle de 3 mois (1 sept.–30 avr.) peut s’appliquer.',
    gen:'Génération…', startAnother:'Nouvelle attestation', statusLabel:'Statut du document',
    statusBody:'Modèle et calques en attente de revue finale des coordonnées et de conformité légale. Vérifiez chaque champ avant un usage professionnel.',
    previewBody:'Attesta crée un aperçu PDF à partir des données saisies. Ses positions de champs et sa conformité légale ne sont pas vérifiées ; comparez-le au modèle officiel en vigueur avant tout usage professionnel.',
    signNote:'Les lignes de signature restent vierges : imprimez l’attestation et faites signer le technicien et le client à la main. Attesta n’appose aucune signature électronique.',
    bruHandoff:'Attesta ne peut pas émettre le PDF officiel Bruxelles gaz/mazout. Utilisez le JSON téléchargé comme aide, ressaisissez les données dans l’encodeur Bruxelles Environnement, puis téléchargez le document officiel.',
    vekaTitle:'Référence VEKA (saisie manuelle)', vekaRecorded:'Référence et date saisis par l’utilisateur — non vérifiés', vekaRequired:'Référence et date à saisir',
    vekaUnverified:'Attesta ne vérifie pas l’enregistrement auprès du VEKA : la registration doit être faite dans l’outil officiel.',
    statusDraft:'Brouillon', statusPrepared:'Données préparées (envoi manuel)', statusIssued:'PDF émis',
    statusRegistered:'Référence VEKA saisie (non vérifiée)', statusSubmitted:'Envoyé (déclaré par l’utilisateur)',
    markSubmitted:'Marquer comme envoyé', submittedAt:'Envoyé le',
    newIn:l=>`Nouvelle attestation — ${l}`, resume:l=>`Reprendre le brouillon ${l}`, record:l=>`Ouvrir l’enregistrement ${l}`,
    confirmReplace:(l,k)=>`Un enregistrement (${k}) pour ${l} existe. Démarrer un nouveau le remplacera. Continuer ?`,
    confirmChangeSaved:'Votre enregistrement complété restera sauvegardé. Changer de région ?',
    confirmChangeDraft:'Votre brouillon sera sauvegardé pour le reprendre plus tard. Changer de région ?',
    confirmNewJob:'Cette attestation non terminée sera sauvegardée pour la reprendre. En démarrer une autre ?',
    vekaDownloadError:'Saisissez une référence et une date VEKA avant de télécharger.',
    vekaChecklist:'Données à déclarer (30 jours)', vekaLink:'Ouvrir Melding Centrale Stooktoestellen',
    vekaDeadline:'Enregistrement VEKA au plus tard', remedyDeadline:'Attestation corrective au plus tard',
    pdfGenError:'La génération du PDF a échoué. Vérifiez la connexion et les fichiers de modèle officiels, puis réessayez.',
    errFont:'La police Unicode n’a pas pu être chargée.', errTemplate:'Le modèle officiel n’a pas pu être chargé.',
    errAnnex:'L’annexe ≥ 1000 kW n’a pas pu être chargée.', errAttachment:'Une pièce jointe n’a pas pu être traitée.',
    attachReloadWarning:'Les fichiers ne sont pas conservés dans un brouillon rechargé. Resélectionnez les tickets avant de télécharger.',
    flDocChoice:'Document à télécharger', flDocBoth:'Les deux documents',
    auditSummary:'Champs écrits', auditWarnings:'Avertissements de mise en page',
    saved:'Brouillon enregistré',
    glossary:[
      ['AWAC','Agence wallonne de l’air et du climat.'],
      ['BCE','Numéro d’entreprise (Banque-Carrefour des Entreprises).'],
      ['Bacharach','Indice de fumée (échelle 0–9).'],
      ['GI / GII','Catégories d’agrément du technicien (gaz / air pulsé).'],
      ['VEKA','Melding obligatoire en Flandre (melding.veka.vlaanderen.be).'],
      ['Art. 13 §2','Base légale wallonne du contrôle.']]},
  nl:{back:'Terug',next:'Verder',download:'Downloaden',downloadPdf:'Afdrukken / opslaan als PDF',changeRegion:'Regio wijzigen',progress:'Voortgang',
    chooseTitle:'Attesta',chooseHint:'Kies de regio van deze interventie.',
    chooseHead:'Eén wizard. Drie regio’s.',
    chooseBody:'Attesta vult het officiële model voor uw regio in en downloadt het juiste document — of zegt precies wat u daarna moet doen.',
    ready:'Klaar om uit te geven',readyHint:'Controleer het resultaat voor uw regio.',
    readyBody:'Het officiële model is met uw gegevens gevuld. Download, onderteken en geef aan de klant.',
    needData:'Geen gegevens. Open het rooster en vul de metingen in.',
    openEncoder:'BE-encoder openen',ack:'Bevestigd',
    nextControl:'VOLGENDE CONTROLE',required:'Verplicht',invalid:'Ongeldige waarde',
    noThreshold:'Geen gedrukte drempel voor deze categorie',
    vekaConfirmed:'VEKA-registratie bevestigd',
    bruDataBody:'Brussel genereert het officiële PDF. Open de encoder, voer de voorbereide gegevens opnieuw in en download uw officiële attest.',
    docs:{wa:['Attestation de contrôle (AWAC-model)','Meetbewijzen toegevoegd'],
      fl:['Verbrandingsattest','Reinigingsattest','VEKA-registratie geregistreerd'],
      brSolid:['Attestation PEB — vaste brandstof'],brData:['Gegevenspakket voor BE-encoder','Lijst voor manuele invoer']},
    annex:'Bijlage ≥ 1000 kW inbegrepen',
    w100:'<strong>100 kW-grens.</strong> De wet (≤100 kW) geeft 3 jaar, maar voetnoot 14 van het model zegt 2. Attesta gebruikt 3 jaar en toont deze waarschuwing.',
    wAnchor:'<strong>Voorlopige vervaldatum.</strong> Zonder datum van eerste ingebruikname berekent Attesta vanaf de controldatum. Voeg die datum toe voor een vervaldatum volgens art. 13 §2.',
    wGate:'<strong>Geen attest zonder registratie.</strong> Vul de VEKA-referentie en -datum in vóór het downloaden.',
    wBru:'<strong>Geen PDF hier.</strong> Brusselse gas/olie-attesten worden door Bruxelles Environnement gegenereerd. Attesta bereidt de gegevens voor manuelle invoer voor.',
    wNon:'<strong>Niet conform.</strong> 5 maanden om te herstellen ; één uitzondering van 3 maanden (1 sept.–30 apr.) kan gelden.',
    gen:'Genereren…', startAnother:'Nieuwe attestatie', statusLabel:'Documentstatus',
    statusBody:'Model en overlays wachten op de finale coördinaat- en wettelijke controle. Controleer elk veld vóór professioneel gebruik.',
    previewBody:'Attesta maakt een PDF-voorbeeld van de ingevoerde gegevens. De veldposities en wettelijke naleving zijn niet geverifieerd; vergelijk dit met het huidige officiële model vóór professioneel gebruik.',
    signNote:'De handtekeninglijnen blijven blanco: print de attestatie en laat de technicus en de klant met de hand tekenen. Attesta plaatst geen elektronische handtekening.',
    bruHandoff:'Attesta kan de officiële Brusselse gas/olie-PDF niet afgeven. Gebruik het gedownloade JSON als hulpmiddel, voer de gegevens opnieuw in in de BE-encoder en download daar het officiële document.',
    vekaTitle:'VEKA-referentie (manueel ingevoerd)', vekaRecorded:'Referentie en datum door de gebruiker ingevoerd — niet geverifieerd', vekaRequired:'Referentie en datum in te voeren',
    vekaUnverified:'Attesta controleert de registratie niet bij VEKA: de melding moet in de officiële tool gebeuren.',
    statusDraft:'Concept', statusPrepared:'Gegevens voorbereid (manuele verzending)', statusIssued:'PDF afgegeven',
    statusRegistered:'VEKA-referentie ingevoerd (niet geverifieerd)', statusSubmitted:'Verzonden (door gebruiker gemeld)',
    markSubmitted:'Markeren als verzonden', submittedAt:'Verzonden op',
    newIn:l=>`Nieuwe attestatie — ${l}`, resume:l=>`Concept hervatten ${l}`, record:l=>`Opgeslagen ${l} openen`,
    confirmReplace:(l,k)=>`Er bestaat een opgeslagen record (${k}) voor ${l}. Een nieuwe starten vervangt het. Doorgaan?`,
    confirmChangeSaved:'Uw voltooide record blijft opgeslagen. Regio wijzigen?',
    confirmChangeDraft:'Uw concept wordt opgeslagen om later verder te gaan. Regio wijzigen?',
    confirmNewJob:'Deze onvoltooide attestatie wordt opgeslagen om later verder te gaan. Een nieuwe starten?',
    vekaDownloadError:'Voer een VEKA-referentie en -datum in vóór het downloaden.',
    vekaChecklist:'Gegevens voor de melding (30 dagen)', vekaLink:'Melding Centrale Stooktoestellen openen',
    vekaDeadline:'VEKA-registratie uiterlijk', remedyDeadline:'Herstelverbrandingsattest uiterlijk',
    pdfGenError:'PDF-generatie mislukt. Controleer de verbinding en de officiële modellen en probeer opnieuw.',
    errFont:'Het Unicode-lettertype kon niet worden geladen.', errTemplate:'Het officiële model kon niet worden geladen.',
    errAnnex:'De bijlage ≥ 1000 kW kon niet worden geladen.', errAttachment:'Een bijlage kon niet worden verwerkt.',
    attachReloadWarning:'Bestanden worden niet bewaard in een herladen concept. Selecteer de meetbewijzen opnieuw vóór het downloaden.',
    flDocChoice:'Te downloaden document', flDocBoth:'Beide documenten',
    auditSummary:'Velden geschreven', auditWarnings:'Layoutwaarschuwingen',
    saved:'Concept opgeslagen',
    glossary:[
      ['AWAC','Waalse agentschap voor lucht en klimaat.'],
      ['BCE','Ondernemingsnummer (Banque-Carrefour des Entreprises).'],
      ['Bacharach','Rookindex (schaal 0–9).'],
      ['GI / GII','Erkenningscategorieën van de technicus (gas / luchtpuls).'],
      ['VEKA','Verplichte melding in Vlaanderen (melding.veka.vlaanderen.be).'],
      ['Art. 13 §2','Wettelijke basis van de Waalse controle.']]}
};
// The wizard UI can be switched per job (Flanders is bilingual). Document
// language is separate: state.lang is never read by the print/PDF path.
function activeLang(){ return state?.lang || cfg()?.lang || 'fr'; }
function tr(){ return T[activeLang()]||T.fr; }

const ACK_KEY='attesta.acks.v1';
let acks=loadAcks();
function loadAcks(){ try{return JSON.parse(sessionStorage.getItem(ACK_KEY))||{};}catch(e){return {};} }
function saveAcks(){ sessionStorage.setItem(ACK_KEY,JSON.stringify(acks)); }

import {isComplete,statusText,statusOnIssue,statusOnHandoff} from './status.js';

let state = load();
if(state.status==='Done') state.status='Issued';
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
  const lang=q.get('lang');
  if(s.region==='flanders' && (lang==='fr'||lang==='nl')) s.lang=lang;
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
  const el=$('saveStatus');
  if(el){ el.textContent=tr().saved; el.classList.add('show'); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),1600); }
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
const fieldVisible = f => typeof f.when!=='function' || f.when(state.data);

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
  if(c.id==='wallonia' && d.controlDate && !d.commissioningDate &&
     !/première mise en service/i.test(d.intervention||''))
    out.push(['anchor',t.wAnchor]);
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
    input=`<select id="${id}"${name} data-k="${f.key}" ${f.required?'required':''}><option value=""></option>${f.options.map(o=>{
      const ov=optionValue(o);
      return `<option value="${esc(ov)}" ${v===ov?'selected':''}>${esc(optionLabel(o,activeLang()))}</option>`;
    }).join('')}</select>`;
  } else if(f.type==='textarea'){
    input=`<textarea id="${id}"${name} data-k="${f.key}" rows="2" ${f.required?'required':''}>${esc(v)}</textarea>`;
  } else if(f.type==='file'){
    input=`<input id="${id}"${name} type="file" data-k="${f.key}" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" multiple>`;
  } else if(f.type==='checkbox'){
    input=`<input id="${id}"${name} type="checkbox" data-k="${f.key}" ${v?'checked':''}>`;
  } else {
    const isCode=f.key==='techAgrement'||f.key==='bce';
    input=`<input id="${id}"${name} type="${f.type==='number'?'number':f.type==='date'?'date':'text'}" data-k="${f.key}" value="${esc(v)}" ${f.required?'required':''} spellcheck="false" autocomplete="off">`;
  }
  if(bad) input=input.replace(/^<(\w+)/,`<$1 aria-invalid="true" aria-describedby="${id}-error"`);
  return `<div class="f ${bad} ${f.required?'req':''}"><label for="${id}">${esc(resolved(f.label,activeLang()))}</label>${input}${f.hint?`<div class="fhint">${esc(resolved(f.hint,activeLang()))}</div>`:''}<div class="err" id="${id}-error" role="alert">${f._err||''}</div></div>`;
}
// Wallonia thresholds come from the official category table, not from hard-coded
// min/max on the field definition. No resolved category means no rule and no OK.
function ruleFor(f){
  if(state.region==='wallonia') return limitsForField(state.data)[f.key] ?? null;
  if(f.max!=null && f.lower) return {max:f.max,lower:true};
  if(f.min!=null) return {min:f.min};
  return null;
}
function measureHTML(f){
  const v=state.data[f.key];
  const id=`field-${f.key}`;
  const rule=ruleFor(f);
  const lim = rule
    ? (rule.max!=null?`≤ ${rule.max}`:(rule.min!=null?`≥ ${rule.min}`:''))
    : (tr().noThreshold||'—');
  if(f.pair){
    const obj=(v&&typeof v==='object')?v:{i:'',f:''};
    return `<div class="mrow paired pending">
      <label class="ml" for="${id}-i">${esc(resolved(f.label,activeLang()))}<span class="thresh">${lim} ${f.unit||''}</span></label>
      <div class="pair-inputs">
        <label class="sub">I <input id="${id}-i" name="${f.key}.i" data-k="${f.key}" data-sub="i" value="${esc(obj.i??'')}" inputmode="decimal"></label>
        <label class="sub">II <input id="${id}-f" name="${f.key}.f" data-k="${f.key}" data-sub="f" value="${esc(obj.f??'')}" inputmode="decimal"></label>
        <span class="verdict idle" data-verdict="i">—</span>
        <span class="verdict idle" data-verdict="f">—</span>
      </div></div>`;
  }
  let verdict='idle', text='—';
  if(v!==''&&v!=null && rule){
    const n=Number(v);
    if(Number.isFinite(n)){
      const ok = (rule.max!=null ? n<=rule.max : true) && (rule.min!=null ? n>=rule.min : true);
      verdict=ok?'ok':'bad'; text=ok?'OK':'NON OK';
    }
  }
  return `<div class="mrow ${v===''||v==null?'pending':''} ${verdict==='bad'?'warn':''}">
    <label class="ml" for="${id}">${esc(resolved(f.label,activeLang()))}<span class="thresh">${lim} ${f.unit||''}</span></label>
    <input id="${id}" name="${f.key}" data-k="${f.key}" value="${esc(v??'')}" inputmode="decimal" ${f.required?'required':''}>
    <span class="verdict ${verdict}">${text}</span></div>`;
}
function measureVerdict(f,value){
  if(value===''||value==null) return 'idle';
  const rule=ruleFor(f);
  if(!rule) return 'idle';
  const n=Number(value);
  if(!Number.isFinite(n)) return 'idle';
  const ok=(rule.max!=null?n<=rule.max:true)&&(rule.min!=null?n>=rule.min:true);
  return ok?'ok':'bad';
}
function esc(s){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function wireAcks(){
  $('warning').querySelectorAll('[data-ack]').forEach(b=>{
    b.setAttribute('aria-pressed','true');
    b.onclick=()=>{ acks[b.dataset.ack]=true; saveAcks(); render(); };
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
        attachmentFiles.set(k,[...el.files]);
        state.data[k]=[...el.files].map(f=>f.name);
        saveAttachmentBytes(attachmentFiles).catch(e=>console.warn('Could not persist attachment bytes',e));
      }else if(el.type==='checkbox'){
        state.data[k]=el.checked;
      }else if(el.dataset.sub){
        const current=state.data[k];
        const obj=(current&&typeof current==='object')?current:{i:'',f:''};
        obj[el.dataset.sub]=el.value;
        state.data[k]=obj;
      }else{
        state.data[k]=el.value;
      }
      // Any edit invalidates a previously "Done" status.
      if(isComplete(state.status)){ state.status='Draft'; delete state.data.submittedAt; }
      save();
      if(k==='controlDate'||k==='powerKw'||k==='conformity'||k==='building'||k==='fuel'){
        renderChrome();
      }
      if(el.classList.contains('ml')||el.closest('.mrow')) updateMeasure(el);
    });
  });
  $('form').querySelectorAll('.mrow input').forEach(updateMeasure);
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
  if(!f) return;
  if(input.dataset.sub){
    const verdict=measureVerdict(f,input.value);
    const vd=row.querySelector(`[data-verdict="${input.dataset.sub}"]`);
    if(vd){ vd.className='verdict '+verdict; vd.textContent=verdict==='idle'?'—':verdict==='ok'?'OK':'NON OK'; }
    const filled=[...row.querySelectorAll('input')].some(i=>i.value!=='');
    row.classList.toggle('pending',!filled);
    row.classList.toggle('warn',[...row.querySelectorAll('input')].some(i=>measureVerdict(f,i.value)==='bad'));
    return;
  }
  const verdict=measureVerdict(f,input.value);
  const vd=row.querySelector('.verdict');
  if(!vd) return;
  vd.className='verdict '+verdict; vd.textContent=verdict==='idle'?'—':verdict==='ok'?'OK':'NON OK';
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
    }).join('')}</div></div>`;
  $('form').querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>{
      const saved=readRegionDraft(b.dataset.region);
      if(saved){
        const label=resolved(REGIONS[b.dataset.region].label,activeLang());
        const kind=isComplete(saved.status)?'record':'draft';
        if(!window.confirm(tr().confirmReplace(label,kind))) return;
      }
    state={region:b.dataset.region,step:0,data:{},status:'Draft',lang:REGIONS[b.dataset.region].lang};
    lastFocusKey=null; save(); syncURL(); render();
  });
  $('form').querySelectorAll('[data-resume]').forEach(b=>b.onclick=()=>{
    state=readRegionDraft(b.dataset.resume)||{region:b.dataset.resume,step:0,data:{},status:'Draft'};
    lastFocusKey=null; save(); syncURL(); render();
  });
}
const VEKA_ITEMS=['Toesteltype','Locatie','Nominaal vermogen (kW)','Brandstof',
  'Brandertechniek','Bouwjaar','Type interventie','Datum uitvoering','Eindbeoordeling'];
const flDocuments=d=>d.document?.includes('Keuringsrapport')
  ? ['Keuringsrapport','Verbrandingsattest']
  : ['Verbrandingsattest','Reinigingsattest'];
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
  const flDocs = c.id==='flanders' ? flDocuments(d) : docs;
  const due=computeDue();
  const regDeadline=c.id==='flanders'&&d.controlDate
    ? wFmt(flanders.rules.registrationDeadline(d.controlDate)):null;
  const hasDefect=/niet/i.test(d.conformity||'') ||
    ['conformStooktoestel','conformRookgas','conformStookplaats','conformVerbranding']
      .some(k=>/niet/i.test(d[k]||''));
  const remedyDeadline=c.id==='flanders'&&d.controlDate&&hasDefect
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
  const fileKeys=c.steps.flatMap(s=>s.fields).filter(f=>f.type==='file').map(f=>f.key);
  const missingFiles=fileKeys.some(k=>Array.isArray(d[k])&&d[k].length&&!(attachmentFiles.get(k)||[]).length);
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
    <p class="output-warning"><strong>${t.statusLabel} :</strong> ${esc(statusText(state.status,t))}${d.submittedAt?` · ${t.submittedAt} ${esc(d.submittedAt.slice(0,10))}`:''}<br>${t.statusBody}</p>
    ${['Prepared','Issued','Registered'].includes(state.status)?'<button type="button" class="btn back" id="markSubmitted" style="margin-top:10px;width:100%">'+esc(t.markSubmitted)+'</button>':''}
    <p id="auditLine" class="audit-line" role="status"></p>
    <button type="button" class="btn next" id="go" style="margin-top:16px;width:100%" ${gateLocked?`disabled title="${esc(t.vekaDownloadError)}"`:''}>${goLabel}</button>
    ${c.id==='brussels'?`<button type="button" class="btn back" id="goPrint" style="margin-top:10px;width:100%">${c.lang==='nl'?'Print / PDF (attestatie)':'Imprimer / PDF (attestatie)'}</button>`:''}
    <button type="button" class="btn back" id="newJob" style="margin-top:10px;width:100%">${t.startAnother}</button></div>`;
  $('newJob').onclick=()=>{
    if(!isComplete(state.status)&&!window.confirm(t.confirmNewJob)) return;
    state={region:null,step:0,data:{},status:'Draft'};
    attachmentFiles.clear();
    clearAttachmentBytes().catch(e=>console.warn('Could not clear attachment bytes',e));
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
      if(c.id==='brussels' && !/solide/i.test(d.fuel||'')){
        const blob=await buildAttestation(state,attachmentFiles);
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
        const blob=await buildAttestation(state,attachmentFiles);
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
  const c=cfg(), step=c.steps[state.step], t=tr(); let ok=true;
  const visible=step.fields.filter(fieldVisible);
  visible.forEach(f=>{
    f._err='';
    if(f.required && (state.data[f.key]===''||state.data[f.key]==null)) { f._err=t.required; ok=false; }
    if(f.type==='checkbox' && f.required && state.data[f.key]!==true){ f._err=t.required; ok=false; }
    if(f.type==='select' && state.data[f.key] && f.options && !optionValues(f).includes(state.data[f.key])) { f._err=t.invalid; ok=false; }
  });
  const agrem=visible.find(f=>f.key==='techAgrement');
  if(agrem){
    const pattern=recognitionPattern();
    if(pattern){
      if(!state.data.techAgrement && agrementRequired()) agrem._err=t.required;
      else if(state.data.techAgrement && !pattern.test(state.data.techAgrement)) agrem._err=t.invalid;
    }
  }
  if(visible.find(f=>f.key==='techAgrement')?._err) ok=false;
  const streetField=visible.find(f=>f.key==='clientStreetName');
  if(streetField && !addressOk(state.data,c)){ streetField._err=t.required; ok=false; }
  if(!ok){
    render();
    requestAnimationFrame(()=>document.querySelector('.f.bad [data-k], .mrow.bad [data-k]')?.focus());
  }
  return ok;
}
function addressOk(d,c){
  if(c.id!=='wallonia') return true;
  return !!(d.clientStreetName&&d.clientStreetNumber) || !!d.clientStreet;
}
// On the AWAC model the agrément is a numeric registration number (e.g. 05431),
// required for the L/GI/GII categories and not applicable to solid-fuel specialists.
function agrementRequired(){
  const c=cfg();
  if(c?.id==='flanders') return true;
  if(c?.id==='wallonia') return /agréé\s+(?:L|GI|GII)\b/i.test(state.data.techCategory||'');
  return false;
}
function recognitionPattern(){
  const c=cfg();
  if(c.id==='flanders'){
    if(state.data.techCategory?.includes('gasvormige')) return /^GV\d{5}$/i;
    if(state.data.techCategory?.includes('vloeibare')) return /^TV\d{5}$/i;
    if(state.data.techCategory?.includes('VA+')) return /^VA\+\d{5}$/i;
  }
  if(c.id==='brussels'){
    if(state.data.techCategory?.includes('GI')) return /^(GI|GII)$/i;
    if(state.data.techCategory?.includes('L')) return /^L$/i;
    if(state.data.techCategory?.includes('RESCERT')) return /^RESCERT$/i;
  }
  if(c.id==='wallonia'){
    // AWAC prints a numeric registration number. Accept it bare (05431) or
    // with an optional L/GI/GII prefix separated by a space or hyphen.
    if(agrementRequired()) return /^(?:(?:GII|GI|L)[\s-]?)?\d{1,7}$/i;
  }
  return null;
}
function validateDraft(){
  const c=cfg();
  if(!c) return false;
  const t=tr();
  for(let index=0;index<c.steps.length;index++){
    const step=c.steps[index];
    for(const f of step.fields.filter(fieldVisible)){
      f._err='';
      if(f.required && (state.data[f.key]===''||state.data[f.key]==null)){ f._err=t.required; }
      if(f.type==='checkbox' && f.required && state.data[f.key]!==true){ f._err=t.required; }
      if(f.type==='select' && state.data[f.key] && f.options&&!optionValues(f).includes(state.data[f.key])){ f._err=t.invalid; }
    }
  }
  const pattern=recognitionPattern();
  const field=c.steps.flatMap(step=>step.fields).find(f=>f.key==='techAgrement'&&fieldVisible(f));
  if(pattern&&field){
    if(!state.data.techAgrement && agrementRequired()) field._err=t.required;
    else if(state.data.techAgrement && !pattern.test(state.data.techAgrement)) field._err=t.invalid;
  }
  if(!addressOk(state.data,c)){
    const f=c.steps.flatMap(step=>step.fields).find(x=>x.key==='clientStreetName');
    if(f) f._err=t.required;
  }
  const invalid=c.steps.flatMap(step=>step.fields).some(f=>f._err);
  if(invalid){
    const firstIndex=c.steps.findIndex(step=>step.fields.some(f=>f._err));
    state.step=firstIndex>=0?firstIndex:0;
  }
  return !invalid;
}
$('back').onclick=()=>{ if(state.step>0){state.step--;save();syncURL();render();} };
$('changeRegion').onclick=()=>{
  const t=tr();
  const prompt=isComplete(state.status)?t.confirmChangeSaved:t.confirmChangeDraft;
  if(!window.confirm(prompt)) return;
  save();
  state={region:null,step:0,data:{},status:'Draft'};
  save();
  syncURL();
  render();
};
function setLang(lang,button){
  if(!state.region || (lang!=='fr' && lang!=='nl')) return;
  state.lang=lang;
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
  if(region&&REGIONS[region]){
    const step=Math.max(0,Math.min(Number(q.get('step'))||0,REGIONS[region].steps.length));
    state={region,step,data:state.region===region?state.data:{},status:state.region===region?state.status:'Draft',
      lang:state.region===region?state.lang:REGIONS[region].lang};
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
// Render immediately; then restore ticket bytes and re-render if they arrive,
// so a slow or unavailable IndexedDB can never leave the wizard blank.
render();
loadAttachmentBytes().then(map=>{
  for(const [key,files] of map){
    if(files&&files.length) attachmentFiles.set(key,files.map(f=>f.blob||f));
  }
  render();
}).catch(e=>{ console.warn('Could not restore attachment bytes',e); });
