// pdf-lib is loaded lazily (app.js ensurePdfLibs); resolve it when generating,
// not at import time, otherwise the wizard module fails to start.
// Deliberately exposes only .load — the sole PDFDocument method used below.
// Add other methods here only once they are actually needed lazily.
const PDFDocument={load:(...a)=>window.PDFLib.PDFDocument.load(...a)};
import {flanders as flandersRegion, fmt as fmtDate} from './regions/flanders.js';
import {FL_MAPS, anchorOf, isPaired, explicitBoxes, flTextValue} from './regions/flanders-pdf.js';
import {formatValue, wrapText, fieldWidth, boundsWarnings, emptyAudit, toPdfY} from './regions/pdf-render.js';
import {LEGACY_MAPS} from './regions/legacy-maps.js';
import {binaryIndex} from './regions/checkbox-vocab.js';
import {walloniaComputed} from './regions/wallonia-pdf.js';
import {generateWallonia} from './regions/wa-template.js';
import {nextControlDate} from './regions/brussels.js';
import {scalarText,isValidDate} from './input-validation.js';
import {signatureDataURL,containFit,isPngDataURL} from './signature.js';

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

const ink = () => window.PDFLib.rgb(0.086,0.094,0.114);

// Signature image boxes, PDF points, origin top-left. The image sits above the
// printed line. Marked À VALIDER in docs/field-matrix.md.
const SIGNATURE_BOX={
  'br-solid':{page:0,x:54,y:681,w:180,h:17},
  wallonia:{page:3,x:60,y:258,w:220,h:42},
  'fl-verbranding':{page:0,x:29,y:721,w:180,h:40},
  'fl-keuring':{page:0,x:25,y:705,w:180,h:32},
  'fl-reiniging':{page:0,x:290,y:668,w:180,h:40},
};

// The drawn/typed signature is personal data: never ship it in the JSON that
// the user re-keys into the Bruxelles Environnement encoder.
function withoutSignature(data){
  if(!data||typeof data!=='object'||Array.isArray(data)||!('signature' in data)) return data;
  const copy={...data}; delete copy.signature; return copy;
}

function base64ToBytes(dataUrl){
  const b64=dataUrl.slice(dataUrl.indexOf(',')+1);
  if(typeof atob==='function'){
    const bin=atob(b64), out=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i);
    return out;
  }
  return Uint8Array.from(Buffer.from(b64,'base64'));
}

/**
 * Embeds the drawn signature (transparent PNG) or the typed name (italic) at
 * the model's anchor. `dataUrl` is injectable so Node tests can pass a fixture.
 */
export async function embedSignature(doc,signature,model,audit,dataUrl){
  const box=SIGNATURE_BOX[model];
  if(!box) return false;
  const sig=signature&&typeof signature==='object'&&!Array.isArray(signature)?signature:null;
  if(!sig) return false;
  // Export at the box aspect ratio so containFit does not shrink the ink into a
  // thin sliver (br-solid is ~10:1, the default 3:1 would render ~51 pt wide).
  const exportWidth=600;
  const exportHeight=Math.max(8,Math.round(exportWidth*box.h/box.w));
  const url=dataUrl!==undefined?dataUrl:
    signatureDataURL(sig,{width:exportWidth,height:exportHeight,lineScale:exportWidth/box.w});
  const page=doc.getPages()[box.page];
  if(!page){ if(audit) audit.warnings.push(`signature: page ${box.page} missing from template`); return false; }
  // Both the drawn strokes and the typed name are rasterised (Unicode-safe).
  if(isPngDataURL(url)){
    const image=await doc.embedPng(base64ToBytes(url));
    const fit=containFit(box,image.width,image.height);
    page.drawImage(image,{x:fit.x,y:toPdfY(page.getHeight(),fit.y+fit.height),width:fit.width,height:fit.height});
    if(audit) audit.printed.push('signature');
    return true;
  }
  return false; // empty signature object: nothing to draw, no warning
}

const MAPS=LEGACY_MAPS;

// Normalize typographic characters to plain equivalents. The Unicode font can
// render these, but ASCII forms keep the attestation fields clean and portable.
const SUBST = {'\u2019':"'",'\u2018':"'",'\u2013':'-','\u2014':'-','\u00a0':' '};
const EXTRA_LABEL={intervention:'Intervention',building:'Bâtiment',techCategory:'Agrément',
  requester:'Demandeur',fuel:'Combustible',clientCompany:'Entreprise',
  measureDate:'Date mesure',measureTime:'Heure',analyzerMake:'Analyseur',analyzerSerial:'N° série',
  vekaRef:'VEKA-ref',vekaDate:'VEKA-datum',tickets:'Tickets',techCategory:'Agrément',
  commissioningDate:'Mise en service',maintenanceIntervalMonths:'Entretien (mois)',
  techEmail:'Courriel technicien',clientEmail:'Courriel client'};
function safeText(s){
  return scalarText(s).replace(/[\u2018\u2019\u2013\u2014\u00a0]/g,ch=>SUBST[ch]||'?');
}
// Draw wrapped text at a glyph-top anchor. Returns audit information instead
// of silently truncating or swallowing failures.
function draw(page,key,text,x,yTop,size,font,audit,maxLines,widths={},styles={}){
  const style=styles[key]||{};
  size=style.size||size;
  maxLines=style.maxLines||maxLines;
  const width=fieldWidth(key,page.getWidth(),x,widths);
  const {lines,clipped}=wrapText(safeText(text),s=>font.widthOfTextAtSize(s,size),width,maxLines);
  const lineH=size+3;
  audit.warnings.push(...boundsWarnings(page.getWidth(),page.getHeight(),x,yTop,width,lines.length*lineH)
    .map(w=>`${key}: ${w}`));
  for(let i=0;i<lines.length;i++){
    const opts={x,y:page.getHeight()-(yTop+i*lineH)-size*0.9,size,font,color:ink()};
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
const RED=() => window.PDFLib.rgb(0.698,0.227,0.169);
// A solid mark strictly inside the printed box. Checkmark strokes used to
// overrun small glyph boxes and cross neighbouring labels, so the mark is a
// clipped, inset fill instead. Word-style options get a short underline.
function tick(page,box){
  const [x0,y0,x1,y1]=box, type=box[4];
  const pageH=page.getHeight(); // real page geometry (portrait or landscape annex)
  if(type==='word'){
    page.drawRectangle({x:x0,y:toPdfY(pageH,y1)-1.5,width:Math.max(4,x1-x0),height:2,color:RED()});
    return;
  }
  const inset=Math.min(1.2,Math.max(0.4,(x1-x0)*0.15));
  const w=Math.max(1,(x1-x0)-2*inset);
  const h=Math.max(1,(y1-y0)-2*inset);
  page.drawRectangle({x:x0+inset,y:toPdfY(pageH,y1)+inset,width:w,height:h,color:RED()});
}
// Tick printed boxes. Explicit per-model selections (Flanders 3/4-way fields)
// take precedence; otherwise find the nearest same-row OUI/NON pair.
async function markBoxes(doc,map,data,model){
  const boxes=await checkboxMap(model); const pages=doc.getPages();
  const ticked=new Set();
  const explicitFor=(key,value,list)=>{
    // Wallonia's explicit box centres are stored with the layout (WA_CHECKBOXES),
    // not in BOX_SELECT — restore them now that the official template is used.
    if(model==='wallonia'){
      const extra=WA_CHECKBOXES[key];
      if(extra){
        const v=scalarText(value).toLowerCase().trim();
        const centres=extra[v];
        if(!centres) return null;
        const found=centres.map(([cx,cy])=>list.find(b=>
          Math.hypot((b[0]+b[2])/2-cx,(b[1]+b[3])/2-cy)<4));
        return found.every(Boolean)?found:null;
      }
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
      const box=opts[key]?.[scalarText(value)];
      if(!box||!pages[Number(box[0])]) continue;
      tick(pages[Number(box[0])],box.slice(1));
      ticked.add(key);
    }
  }
  audit.ticked.push(...ticked);
  const isFl=model.startsWith('fl-');
  const region=isFl?'flanders':model==='br-solid'?'brussels':'wallonia';
  const widths={}, styles={};
  for(const [key,anchor] of Object.entries(map)){
    if(key==='signature') continue; // drawn/typed separately (embedSignature)
    const v=data[key];
    if(v===''||v==null||v===false){ audit.omitted.push(key); continue; }
    const resolved=anchorOf(anchor,data); const pi=resolved[0];
    const page=pages[pi];
    if(!page){ audit.warnings.push(`${key}: page ${pi} missing from template`); audit.omitted.push(key); continue; }
    if(isPaired(anchor,v)){
      if(v.i!==''&&v.i!=null) draw(page,`${key}.I`,v.i,resolved[1],resolved[2],9,font,audit,1,widths);
      if(v.f!==''&&v.f!=null) draw(page,`${key}.II`,v.f,resolved[3],resolved[2],9,font,audit,1,widths);
      continue;
    }
    if(ticked.has(key)) continue;
    const [,x,y]=resolved;
    let value=isFl?flTextValue(key,formatValue(v,region)):formatValue(v,region);
    const text=!isFl&&EXTRA_LABEL[key]?`${EXTRA_LABEL[key]} : ${value}`:value;
    draw(page,key,text,x,y,9,font,audit,/^(defects|remarks|causes|recommendations)/i.test(key)?4:3,widths,styles);
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

  if(state.region==='brussels' && !/solide/i.test(scalarText(d.fuel))){
    const attachmentList=[];
    for(const [key,files] of attachments?.entries?.()||[]){
      for(const file of files){
        attachmentList.push({field:key,name:file.name,type:file.type||'application/octet-stream',size:file.size});
      }
    }
    const payload={ product:'Attesta', region:'brussels', mode:'manual-rekey',
      schemaVersion:1, template:'brussels-data-prep-v1',
      encoder:'https://peb-epb.brussels/att-frontoffice/pwa/index.html',
      generatedAt:new Date().toISOString(), data:withoutSignature(d),
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
    const document=scalarText(d.document);
    if(document.includes('Keuringsrapport')){ src='assets/fl-model-keuringsrapport.pdf'; model='fl-keuring'; }
    else if(/reinigingsattest/i.test(document)){ src='assets/fl-model-reinigingsattest.pdf'; model='fl-reiniging'; }
    else model='fl-verbranding';
    map=FL_MAPS[model];
  }
  if(state.region==='brussels') model='br-solid';

  let data=d;
  if(state.region==='wallonia') data=walloniaComputed(d);
  if(state.region==='flanders'){
    data={...d}; delete data.nextDueDate;
    if(isValidDate(d.controlDate)){
      try{
        const due=flandersRegion.rules.nextDue(d.controlDate,d);
        data.nextDueDate=fmtDate(due.date);
      }catch(e){ /* leave the printed line blank on invalid input */ }
    }
  }
  if(state.region==='brussels'){
    data={...d};
    const deadline=nextControlDate(d);
    if(deadline) data.nextDueDate=fmtDate(deadline);
    else delete data.nextDueDate;
  }

  let out, doc;
  if(state.region==='wallonia'){
    // Generate the full A4 Wallonia attestation from the declarative template:
    // real logo images, checkbox grid, tables and every section — no overlay.
    const logoBytes=[];
    for(const name of ['wallonie.jpg','dgo4.png','air-climat.jpg']){
      try{
        const r=await fetch(`assets/logos/${name}`);
        if(r.ok) logoBytes.push({name,bytes:new Uint8Array(await r.arrayBuffer())});
      }catch(e){ /* logo optional */ }
    }
    out=await generateWallonia(data,await loadFontBytes(),logoBytes,audit);
    doc=await PDFDocument.load(out);
  }else{
    let res;
    try{ res=await fetch(src); }catch(e){ throw new PdfStageError('template','Official model could not be fetched'); }
    if(!res.ok) throw new PdfStageError('template','Official model could not be fetched');
    const bytes=await res.arrayBuffer();
    audit.template={model,src};
    await verifyTemplate(src.replace('assets/',''),bytes,audit);
    out=await overlay(bytes,map,data,model,audit);
    doc=await PDFDocument.load(out);
  }

  // The official solid-fuel model already contains the combustion annex as
  // page 4 (landscape). Appending the standalone br-1mw-annex.pdf duplicated
  // it; the measurement values are written into the existing page instead.
  await embedSignature(doc,d.signature,model,audit);
  const primary=doc.getPages()[0];
  doc=await appendFiles(doc,attachments,audit,primary&&{w:primary.getWidth(),h:primary.getHeight()});

  doc.setTitle(`Attesta — ${model}`);
  doc.setSubject('Attestation prepared with Attesta — verify against the official model before use');
  doc.setKeywords([`attesta-template:${model}`,`attesta-audit:${audit.printed.length}`]);
  doc.setCreationDate(new Date());
  out=await doc.save();
  const blob=new Blob([out],{type:'application/pdf'});
  blob.audit=audit;
  return blob;
}
