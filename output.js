const {PDFDocument,rgb}=window.PDFLib;
import {flanders as flandersRegion, fmt as fmtDate} from './regions/flanders.js';
import {FL_MAPS, anchorOf, isPaired, explicitBoxes, flTextValue} from './regions/flanders-pdf.js';
import {formatValue, wrapText, fieldWidth, boundsWarnings, emptyAudit, toPdfY} from './regions/pdf-render.js';
import {LEGACY_MAPS} from './regions/legacy-maps.js';
import {binaryIndex} from './regions/checkbox-vocab.js';
import {WA_MAP, WA_CHECKBOXES, WA_ALIASES, WA_COMPUTED_KEYS, walloniaComputed} from './regions/wallonia-pdf.js';

// Custom Unicode font so FR/NL accents (é/è/à/ï/ç/œ/ĳ) render correctly.
// StandardFonts.Helvetica (WinAnsi) corrupts several of these.
const FONT_URL='vendor/DejaVuSans.ttf';
class PdfStageError extends Error{
  constructor(stage,message){ super(message); this.name='PdfStageError'; this.stage=stage; }
}
let FONT_BYTES=null, HASHES=null;
async function templateHashes(){
  if(!HASHES){
    try{ const r=await fetch('assets/template-hashes.json'); HASHES=r.ok?await r.json():{}; }
    catch(e){ HASHES={}; }
  }
  return HASHES;
}
async function verifyTemplate(name,bytes,audit){
  const expected=(await templateHashes())[name];
  if(!expected||!globalThis.crypto?.subtle) return;
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const actual=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(actual!==expected) audit.warnings.push(`${name}: template hash mismatch — coordinates may be invalid`);
}
async function loadFontBytes(){
  if(!FONT_BYTES){
    let r;
    try{ r=await fetch(FONT_URL); }catch(e){ throw new PdfStageError('font','Font file could not be loaded'); }
    if(!r.ok) throw new PdfStageError('font','Font file could not be loaded');
    FONT_BYTES=new Uint8Array(await r.arrayBuffer());
  }
  return FONT_BYTES;
}

const WAL={background:'assets/wa-attestation-bg.pdf'};
const FLA={background:'assets/fl-model-verbrandingsattest.pdf'};
const BRU={background:'assets/br-solid-fuel-model.pdf'};

const ink = rgb(0.086,0.094,0.114);

const MAPS=LEGACY_MAPS;
MAPS.wallonia=WA_MAP;

// Normalize typographic characters to plain equivalents. The Unicode font can
// render these, but ASCII forms keep the attestation fields clean and portable.
const SUBST = {'\u2019':"'",'\u2018':"'",'\u2013':'-','\u2014':'-','\u00a0':' '};
const EXTRA_LABEL={intervention:'Intervention',building:'Bâtiment',techCategory:'Agrément',
  requester:'Demandeur',fuel:'Combustible',clientCompany:'Entreprise',
  measureDate:'Date mesure',measureTime:'Heure',analyzerMake:'Analyseur',analyzerSerial:'N° série',
  vekaRef:'VEKA-ref',vekaDate:'VEKA-datum',tickets:'Tickets',techCategory:'Agrément',
  commissioningDate:'Mise en service',maintenanceIntervalMonths:'Entretien (mois)'};
function safeText(s){
  return String(s).replace(/[\u2018\u2019\u2013\u2014\u00a0]/g,ch=>SUBST[ch]||'?');
}
// Draw wrapped text at a glyph-top anchor. Returns audit information instead
// of silently truncating or swallowing failures.
function draw(page,key,text,x,yTop,size,font,audit,maxLines){
  const width=fieldWidth(key,page.getWidth(),x);
  const {lines,clipped}=wrapText(safeText(String(text)),s=>font.widthOfTextAtSize(s,size),width,maxLines);
  const lineH=size+3;
  audit.warnings.push(...boundsWarnings(page.getWidth(),page.getHeight(),x,yTop,width,lines.length*lineH)
    .map(w=>`${key}: ${w}`));
  for(let i=0;i<lines.length;i++){
    const opts={x,y:page.getHeight()-(yTop+i*lineH)-size*0.9,size,font,color:ink};
    try{ page.drawText(lines[i],opts); }
    catch(e){
      try{ page.drawText(lines[i].replace(/[^\x20-\x7E]/g,'?'),opts); }
      catch(e2){ audit.omitted.push(key); return; }
    }
  }
  audit.printed.push(key);
  if(clipped) audit.clipped.push(key);
}

let BOXES=null;
async function checkboxMap(model){
  if(!BOXES){
    try{ const r=await fetch('assets/checkbox-rects.json'); BOXES=r.ok?await r.json():{}; }
    catch(e){ BOXES={}; }
  }
  return BOXES[model]||{};
}
let BR_OPTIONS=null;
async function brOptionMap(){
  if(!BR_OPTIONS){
    try{ const r=await fetch('assets/br-option-marks.json'); BR_OPTIONS=r.ok?await r.json():{}; }
    catch(e){ BR_OPTIONS={}; }
  }
  return BR_OPTIONS;
}
const RED=rgb(0.698,0.227,0.169);
// A solid mark strictly inside the printed box. Checkmark strokes used to
// overrun small glyph boxes and cross neighbouring labels, so the mark is a
// clipped, inset fill instead. Word-style options get a short underline.
function tick(page,box){
  const [x0,y0,x1,y1]=box, type=box[4];
  const pageH=page.getHeight(); // real page geometry (portrait or landscape annex)
  if(type==='word'){
    page.drawRectangle({x:x0,y:toPdfY(pageH,y1)-1.5,width:Math.max(4,x1-x0),height:2,color:RED});
    return;
  }
  const inset=Math.min(1.2,Math.max(0.4,(x1-x0)*0.15));
  const w=Math.max(1,(x1-x0)-2*inset);
  const h=Math.max(1,(y1-y0)-2*inset);
  page.drawRectangle({x:x0+inset,y:toPdfY(pageH,y1)+inset,width:w,height:h,color:RED});
}
// Tick printed boxes. Explicit per-model selections (Flanders 3/4-way fields)
// take precedence; otherwise find the nearest same-row OUI/NON pair.
async function markBoxes(doc,map,data,model){
  const boxes=await checkboxMap(model); const pages=doc.getPages();
  const ticked=new Set();
  const explicitFor=(key,value,list)=>{
    const extra=model==='wallonia'?WA_CHECKBOXES[key]:null;
    if(extra){
      const v=String(value).toLowerCase().trim();
      const centers=extra[v];
      if(!centers) return null;
      const found=centers.map(([cx,cy])=>list.find(b=>
        Math.hypot((b[0]+b[2])/2-cx,(b[1]+b[3])/2-cy)<3));
      return found.every(Boolean)?found:null;
    }
    return explicitBoxes(model,key,value,list);
  };
  for(const [key,anchor] of Object.entries(map)){
    const value=data[key];
    if(value===''||value==null||value===false) continue;
    const [pi,x,y]=anchorOf(anchor,data); const list=boxes[String(pi)]||[];
    const explicit=explicitFor(key,value,list);
    if(explicit){
      if(pages[pi]) explicit.forEach(b=>tick(pages[pi],b));
      ticked.add(key); continue;
    }
    // Every Flanders checkbox we fill has an explicit selection above. Without
    // one, the nearest-pair heuristic can tick an unrelated printed box, so
    // leave the value to be written as text instead.
    if(model.startsWith('fl-')) continue;
    const idx=binaryIndex(value); if(idx===null) continue;
    // Prefer a same-row pair; fall back to two nearest boxes.
    const groups=[];
    for(const b of list){
      const cy=(b[1]+b[3])/2;
      let g=groups.find(g=>Math.abs(g.cy-cy)<4);
      if(!g){ g={cy,boxes:[]}; groups.push(g); }
      g.boxes.push(b);
    }
    const rows=groups.filter(g=>g.boxes.length>=2)
      .sort((a,b)=>Math.abs(a.cy-y)-Math.abs(b.cy-y));
    let pair=null, horizontal=true;
    if(rows.length){
      pair=rows[0].boxes.slice().sort((a,b)=>a[0]-b[0]);
      if(Math.abs(((pair[0][0]+pair[0][2])/2)-x)>46) pair=null;
    }
    if(!pair){
      pair=list.map(b=>({b,d:Math.hypot(((b[0]+b[2])/2)-x,((b[1]+b[3])/2)-y)}))
        .filter(o=>o.d<46).sort((a,b)=>a.d-b.d).slice(0,2).map(o=>o.b);
      horizontal=false;
    }
    if(!pair||pair.length<2) continue;
    pair.sort((a,b)=>horizontal?a[0]-b[0]:a[1]-b[1]);
    if(pages[pi]){ tick(pages[pi],pair[idx]); ticked.add(key); }
  }
  return ticked;
}
async function overlay(bytes, map, data, model, audit){
  let doc;
  try{ doc=await PDFDocument.load(bytes); }
  catch(e){ throw new PdfStageError('template','Official model PDF could not be read'); }
  // Register fontkit (UMD global) and embed the Unicode TTF with subsetting.
  if(!doc['__fk'] && (typeof window!=='undefined') && window.fontkit){
    doc.registerFontkit(window.fontkit);
  }
  const fontBytes=await loadFontBytes();
  const font=await doc.embedFont(fontBytes,{subset:true});
  const pages=doc.getPages();
  const ticked=await markBoxes(doc,map,data,model);
  // Brussels enums have no drawn boxes; mark the selected printed word instead.
  if(model==='br-solid'){
    const opts=await brOptionMap();
    for(const [key,value] of Object.entries(data)){
      const box=opts[key]?.[String(value)];
      if(!box||!pages[Number(box[0])]) continue;
      tick(pages[Number(box[0])],box.slice(1));
      ticked.add(key);
    }
  }
  if(model==='wallonia'){
    // Some wizard enums are printed as option boxes rather than text.
    for(const [field,boxKey] of Object.entries(WA_ALIASES)){
      if(data[field]!=null && ticked.has(boxKey)) ticked.add(field);
    }
  }
  audit.ticked.push(...ticked);
  const isFl=model.startsWith('fl-');
  const region=isFl?'flanders':model==='br-solid'?'brussels':'wallonia';
  for(const [key,anchor] of Object.entries(map)){
    const v=data[key];
    if(v===''||v==null||v===false){ audit.omitted.push(key); continue; }
    const resolved=anchorOf(anchor,data); const pi=resolved[0];
    const page=pages[pi];
    if(!page){ audit.warnings.push(`${key}: page ${pi} missing from template`); audit.omitted.push(key); continue; }
    if(isPaired(anchor,v)){
      if(v.i!==''&&v.i!=null) draw(page,`${key}.I`,v.i,resolved[1],resolved[2],9,font,audit,1);
      if(v.f!==''&&v.f!=null) draw(page,`${key}.II`,v.f,resolved[3],resolved[2],9,font,audit,1);
      continue;
    }
    if(ticked.has(key)) continue;
    const [,x,y]=resolved;
    let value=isFl?flTextValue(key,formatValue(v,region)):formatValue(v,region);
    const text=!isFl&&EXTRA_LABEL[key]?`${EXTRA_LABEL[key]} : ${value}`:value;
    draw(page,key,text,x,y,9,font,audit,/^(defects|remarks|causes|recommendations)/i.test(key)?4:3);
  }
  return doc.save();
}

async function appendFiles(doc, attachments, audit, pageSize){
  const appended=[], skipped=[];
  // Explicit geometry from the main document, so a landscape annex or a
  // 9-page model never imposes its first/last page size on ticket images.
  const geometry=pageSize||(()=>{ const p=doc.getPages()[0]; return p&&{w:p.getWidth(),h:p.getHeight()}; })()
    ||{w:595.32,h:841.92};
  for(const [key,files] of attachments?.entries?.()||[]){
    if(!files) continue;
    for(const file of files){
      const name=file.name||'attachment';
      const isPdf=/\.pdf$/i.test(name)||file.type==='application/pdf';
      const isImage=/\.(png|jpe?g)$/i.test(name)||['image/png','image/jpeg','image/jpg'].includes(file.type);
      if(!isPdf&&!isImage){ skipped.push({field:key,name,reason:'unsupported type'}); continue; }
      try{
        const bytes=await file.arrayBuffer();
        if(isPdf){
          const attached=await PDFDocument.load(bytes);
          const pages=await doc.copyPages(attached,attached.getPageIndices());
          pages.forEach(page=>doc.addPage(page));
          appended.push({field:key,name,pages:pages.length,
            geometry:pages.map(p=>`${Math.round(p.getWidth())}x${Math.round(p.getHeight())}`)});
        }else{
          const image=/\.png$/i.test(name)||file.type==='image/png'
            ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
          const {w,h}=geometry;
          const page=doc.addPage([w,h]);
          const scale=Math.min((w-60)/image.width,(h-102)/image.height);
          page.drawImage(image,{x:30,y:51,width:image.width*scale,height:image.height*scale});
          appended.push({field:key,name,pages:1,geometry:[`${Math.round(w)}x${Math.round(h)}`]});
        }
      }catch(e){ skipped.push({field:key,name,reason:'unreadable or encrypted file'}); }
    }
  }
  if(audit){
    audit.attachments={appended,skipped};
    audit.warnings.push(...skipped.map(x=>`attachment ${x.name}: ${x.reason}`));
  }
  return doc;
}

export async function buildAttestation(state,attachments){
  const c=state.region==='wallonia'?WAL:state.region==='flanders'?FLA:BRU;
  const d=state.data;
  const audit=emptyAudit();

  if(state.region==='brussels' && !/solide/i.test(d.fuel||'')){
    const attachmentList=[];
    for(const [key,files] of attachments?.entries?.()||[]){
      for(const file of files){
        attachmentList.push({field:key,name:file.name,type:file.type||'application/octet-stream',size:file.size});
      }
    }
    const payload={ product:'Attesta', region:'brussels', mode:'manual-rekey',
      schemaVersion:1, template:'brussels-data-prep-v1',
      encoder:'https://peb-epb.brussels/att-frontoffice/pwa/index.html',
      generatedAt:new Date().toISOString(), data:d,
      attachments:attachmentList, attachmentStatus:'metadata-only',
      checklist:[
        'Open the BE encoder and create a new attestation',
        'Re-key the professional, owner and PEB-unit data',
        'Enter motif, system type and appliance data',
        'Enter the 8 bon fonctionnement requirements',
        'Upload the initial and final measurement tickets',
        'Send to Bruxelles Environnement and download the official PDF'
      ]};
    return new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  }

  let src=c.background, model=state.region, map=MAPS[state.region];
  if(state.region==='flanders'){
    if(d.document?.includes('Keuringsrapport')){ src='assets/fl-model-keuringsrapport.pdf'; model='fl-keuring'; }
    else if(d.document?.includes('reinigingsattest')||d.document?.includes('Reinigingsattest')){ src='assets/fl-model-reinigingsattest.pdf'; model='fl-reiniging'; }
    else model='fl-verbranding';
    map=FL_MAPS[model];
  }
  if(state.region==='brussels') model='br-solid';

  let res;
  try{ res=await fetch(src); }catch(e){ throw new PdfStageError('template','Official model could not be fetched'); }
  if(!res.ok) throw new PdfStageError('template','Official model could not be fetched');
  const bytes=await res.arrayBuffer();
  audit.template={model,src};
  await verifyTemplate(src.replace('assets/',''),bytes,audit);

  let data=d;
  if(state.region==='wallonia') data=walloniaComputed(d);
  if(state.region==='flanders' && d.controlDate){
    try{
      const due=flandersRegion.rules.nextDue(d.controlDate,d);
      data={...d,nextDueDate:fmtDate(due.date)};
    }catch(e){ /* leave the printed line blank on invalid input */ }
  }
  let out=await overlay(bytes,map,data,model,audit);
  let doc=await PDFDocument.load(out);

  // The official solid-fuel model already contains the combustion annex as
  // page 4 (landscape). Appending the standalone br-1mw-annex.pdf duplicated
  // it; the measurement values are written into the existing page instead.
  const primary=doc.getPages()[0];
  doc=await appendFiles(doc,attachments,audit,primary&&{w:primary.getWidth(),h:primary.getHeight()});

  doc.setTitle(`Attesta — ${model}`);
  doc.setSubject('Attestation prepared with Attesta — verify against the official model before use');
  doc.setKeywords([`attesta-template:${model}`,`attesta-audit:${audit.printed.length}/${Object.keys(map).length}`]);
  doc.setCreationDate(new Date());
  out=await doc.save();
  const blob=new Blob([out],{type:'application/pdf'});
  blob.audit=audit;
  return blob;
}
