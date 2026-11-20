const {PDFDocument,StandardFonts,rgb}=window.PDFLib;

const WAL={background:'assets/wa-attestation-bg.pdf'};
const FLA={background:'assets/fl-model-verbrandingsattest.pdf'};
const BRU={background:'assets/br-solid-fuel-model.pdf'};

const H = 842; // A4 height in points
const ink = rgb(0.086,0.094,0.114);

// field key -> [pageIndex, x, pdfTopY]  (anchors from docs/field-matrix.md)
const MAPS = {
  wallonia: {
    // bg page 1 — header / technician / demandeur
    controlDate:[0,140,53], attestNumber:[0,470,53],
    techName:[0,165,106], techAgrement:[0,180,131], company:[0,205,148],
    techPhone:[0,275,164], bce:[0,205,180],
    clientName:[0,470,106], clientStreet:[0,455,172], clientCity:[0,455,186], clientPhone:[0,455,200],
    applianceLocation:[0,180,196],
    // bg page 1 — fuels / generator / burner
    fuelDetail:[0,250,262],
    genCount:[0,230,289], raccordement:[0,230,331], condensation:[0,330,344],
    year:[0,200,369], make:[0,150,381], model:[0,300,381], serial:[0,200,394], powerKw:[0,230,409],
    burnerType:[0,430,309], unitOrPulsed:[0,420,322], premix:[0,420,334],
    fluid:[0,470,384], production:[0,470,406],
    // bg page 1 — room / orifices
    permisDate:[0,250,469], ventLocal:[0,470,492], airSupply:[0,470,506], flue:[0,470,519],
    orifices:[0,120,622],
    // bg page 2 — measurement table / complementary / declaration
    smoke:[1,185,166], o2:[1,330,166], co2:[1,285,166], co:[1,372,166], efficiency:[1,403,166],
    chimneyPressure:[1,281,400], pumpPressure:[1,437,416],
    conformity:[1,60,566], defects:[1,120,603],
    // bg page 3 — diagnostic tree (A–E) / regulation & pumps
    diagReport:[2,500,56], diagModified:[2,500,129], diagAfter2015:[2,500,228],
    diagTwoYears:[2,500,292], diagDeferred:[2,500,423],
    regulationMode:[2,188,638], thermostat:[2,206,666], clock:[2,206,691],
    night:[2,206,716], pumpIssue:[2,494,656],
    // previously unmapped but collected fields
    // extra captured fields -> blank strip below the orifice section
    intervention:[0,60,692], building:[0,310,692], techCategory:[0,60,708],
    requester:[0,310,708], fuel:[0,60,724], clientCompany:[0,310,724],
  },
  flanders: {
    controlDate:[0,300,100], attestNumber:[0,470,8],
    techName:[0,300,32], techAgrement:[0,430,70], company:[0,110,32], bce:[0,380,100],
    clientName:[0,260,130], clientStreet:[0,260,145], clientCity:[0,260,160],
    powerKw:[0,430,230], year:[0,300,240], make:[0,180,240], model:[0,300,240], serial:[0,420,240],
    o2:[0,460,473], co2:[0,460,487], co:[0,460,502], flueTemp:[0,460,517], efficiency:[0,460,560],
    conformity:[0,400,680], defects:[0,120,720],
  },
  brussels: {
    controlDate:[0,180,94], attestNumber:[0,470,94],
    techName:[0,180,620], company:[0,180,605], bce:[0,180,635],
    clientName:[0,420,130], clientStreet:[0,420,145], clientCity:[0,420,160],
    powerKw:[1,180,200], make:[1,180,210], model:[1,320,210], serial:[1,470,210],
    o2:[0,430,398], co2:[0,430,410], co:[0,430,422], conformity:[0,300,286], defects:[2,100,100],
  }
};

// WinAnsi-safe text: standard fonts cannot encode a few Unicode characters
// (e.g. Dutch ĳ). Transliterate those, then never let one field abort the PDF.
const SUBST = {'\u0133':'ij','\u0132':'IJ','\u0153':'oe','\u0152':'OE','\u2019':"'",'\u2013':'-','\u2014':'-'};
const EXTRA_LABEL={intervention:'Intervention',building:'Bâtiment',techCategory:'Agrément',
  requester:'Demandeur',fuel:'Combustible',clientCompany:'Entreprise'};
function safeText(s){
  return String(s).replace(/[\u0133\u0132\u0153\u0152\u2019\u2013\u2014]/g,ch=>SUBST[ch]||'?');
}
function draw(page,text,x,y,size,font){
  try{ page.drawText(safeText(text).slice(0,90),{x,y:H-y,size,font,color:ink}); }
  catch(e){
    try{ page.drawText(safeText(text).replace(/[^\x20-\x7E]/g,'?').slice(0,90),{x,y:H-y,size,font,color:ink}); }
    catch(e2){ /* never abort the whole document for one field */ }
  }
}

let BOXES=null;
async function checkboxMap(){
  if(!BOXES){
    try{ const r=await fetch('assets/checkbox-rects.json'); BOXES=r.ok?await r.json():{}; }
    catch(e){ BOXES={}; }
  }
  return BOXES;
}
function tick(page,box){
  const [x0,y0,x1,y1]=box;
  page.drawRectangle({x:x0+0.8,y:H-y1+0.8,width:(x1-x0)-1.6,height:(y1-y0)-1.6,
    color:rgb(0.698,0.227,0.169)}); // solid red mark inside the printed box
}
function binaryIndex(v){
  if(v==null) return null;
  const s=String(v);
  return /^(oui|yes|ja|conforme)$/i.test(s)?0
    : /^(non|no|nee|non conforme)$/i.test(s)?1 : null;
}
// Tick printed OUI/NON boxes for binary fields, using the field's anchor to
// find the adjacent box pair. Boxes sorted top-to-bottom or left-to-right.
async function markBoxes(doc,map,data,region,keys){
  if(region!=='wallonia') return; // maps for other regions not extracted yet
  const boxes=await checkboxMap(); const pages=doc.getPages();
  for(const [key,val] of Object.entries(map)){
    if(!keys.has(key)) continue;
    const idx=binaryIndex(data[key]); if(idx===null) continue;
    const [pi,x,y]=val; const list=(boxes[String(pi)]||[]);
    // Prefer a same-row horizontal OUI/NON pair closest to the anchor row.
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
    if(pages[pi]) tick(pages[pi],pair[idx]);
  }
}
async function overlay(bytes, map, data, fontName, region){
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(fontName);
  const pages = doc.getPages();
  const marked = new Set(Object.keys(map).filter(k=>binaryIndex(data[k])!==null && region==='wallonia'));
  for(const [key,val] of Object.entries(map)){
    const v = data[key];
    if(v===''||v==null||v===false || marked.has(key)) continue;
    const [pi,x,y]=val; const page=pages[pi]; if(!page) continue;
    const raw = Array.isArray(v)?v.join(', '):String(v);
    const text = EXTRA_LABEL[key]?`${EXTRA_LABEL[key]} : ${raw}`:raw;
    draw(page,text,x,y,9,font);
  }
  await markBoxes(doc,map,data,region,marked);
  return doc.save();
}

export async function buildAttestation(state){
  const c = state.region==='wallonia'?WAL:state.region==='flanders'?FLA:BRU;
  const d = state.data;

  if(state.region==='brussels' && !/solide/i.test(d.fuel||'')){
    const payload = { product:'Attesta', region:'brussels', mode:'manual-rekey',
      encoder:'https://peb-epb.brussels/att-frontoffice/pwa/index.html',
      generatedAt:new Date().toISOString(), data:d,
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

  let src = c.background;
  if(state.region==='flanders' && d.document && d.document.includes('Keuringsrapport'))
    src='assets/fl-model-keuringsrapport.pdf';
  if(state.region==='flanders' && d.document && d.document.includes('reinigingsattest'))
    src='assets/fl-model-reinigingsattest.pdf';

  const res = await fetch(src);
  if(!res.ok) throw new Error('Model PDF not found: '+src);
  const bytes = await res.arrayBuffer();
  const out = await overlay(bytes, MAPS[state.region], d, StandardFonts.Helvetica, state.region);
  return new Blob([out],{type:'application/pdf'});
}
