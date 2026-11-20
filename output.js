const {PDFDocument,StandardFonts,rgb}=window.PDFLib;

const WAL={background:'assets/wa-attestation-bg.pdf'};
const FLA={background:'assets/fl-model-verbrandingsattest.pdf'};
const BRU={background:'assets/br-solid-fuel-model.pdf'};

const H = 842; // A4 height in points
const ink = rgb(0.086,0.094,0.114);

// field key -> [pageIndex, x, pdfTopY]  (anchors from docs/field-matrix.md)
const MAPS = {
  wallonia: {
    controlDate:[0,150,34], attestNumber:[0,350,34],
    techName:[0,165,108], techAgrement:[0,175,120], company:[0,215,120], bce:[0,215,167],
    clientName:[0,470,92], clientStreet:[0,430,140], clientCity:[0,430,152],
    applianceLocation:[0,180,198],
    powerKw:[0,430,322], year:[0,310,330], make:[0,180,340], model:[0,260,340], serial:[0,400,340],
    ventLocal:[0,470,493], airSupply:[0,470,505], flue:[0,470,517],
    chimneyPressure:[1,300,420], smoke:[1,430,455], o2:[1,430,470], co2:[1,430,485], co:[1,430,500], efficiency:[1,430,515],
    conformity:[2,300,120], defects:[2,120,180],
    regulationMode:[3,200,80], thermostat:[3,200,95], clock:[3,200,110], night:[3,200,125], pumpIssue:[3,470,110],
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

async function overlay(bytes, map, data, fontName){
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(fontName);
  const pages = doc.getPages();
  for(const [key,val] of Object.entries(map)){
    const v = data[key];
    if(v===''||v==null||v===false) continue;
    const [pi,x,y]=val; const page=pages[pi]; if(!page) continue;
    const text = Array.isArray(v)?v.join(', '):String(v);
    page.drawText(text.slice(0,90),{x,y:H-y,size:9,font,color:ink});
  }
  return doc.save();
}

async function appendFiles(doc, attachments){
  for(const [key,files] of attachments?.entries?.()||[]){
    if(!files) continue;
    for(const file of files){
      const bytes=await file.arrayBuffer();
      if(file.type==='application/pdf'||file.name.toLower?.endsWith('.pdf')){
        const attached=await PDFDocument.load(bytes);
        const pages=await doc.copyPages(attached,attached.getPageIndices());
        pages.forEach(page=>doc.addPage(page));
      }else if(file.type==='image/png'||file.type==='image/jpeg'||/\.(png|jpe?g)$/i.test(file.name)){
        const image=file.type==='image/png'||/\.png$/i.test(file.name)
          ? await doc.embedPng(bytes)
          : await doc.embedJpg(bytes);
        const page=doc.addPage([595,842]);
        const scale=Math.min(535/image.width,760/image.height);
        page.drawImage(image,{x:30,y:51,width:image.width*scale,height:image.height*scale});
      }
    }
  }
  return doc;
}

export async function buildAttestation(state,attachments){
  const c = state.region==='wallonia'?WAL:state.region==='flanders'?FLA:BRU;
  const d = state.data;

  if(state.region==='brussels' && !/solide/i.test(d.fuel||'')){
    const attachmentList=[];
    for(const [key,files] of attachments?.entries?.()||[]){
      for(const file of files){
        attachmentList.push({field:key,name:file.name,type:file.type||'application/octet-stream',size:file.size});
      }
    }
    const payload = { product:'Attesta', region:'brussels', mode:'manual-rekey',
      encoder:'https://peb-epb.brussels/att-frontoffice/pwa/index.html',
      generatedAt:new Date().toISOString(), data:d, attachments:attachmentList,
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
  if(state.region==='flanders'){
    if(d.document?.includes('Keuringsrapport')) src='assets/fl-model-keuringsrapport.pdf';
    else if(d.document?.includes('reinigingsattest')||d.document?.includes('Reinigingsattest')) src='assets/fl-model-reinigingsattest.pdf';
  }

  const res = await fetch(src);
  if(!res.ok) throw new Error('Model PDF not found: '+src);
  const bytes = await res.arrayBuffer();
  let out=await overlay(bytes, MAPS[state.region], d, StandardFonts.Helvetica);
  let doc=await PDFDocument.load(out);

  if(state.region==='brussels'&&d.annex1mw===true){
    const annexRes=await fetch('assets/br-1mw-annex.pdf');
    if(!annexRes.ok) throw new Error('Brussels annex PDF not found');
    const annex=await PDFDocument.load(await annexRes.arrayBuffer());
    const pages=await doc.copyPages(annex,annex.getPageIndices());
    pages.forEach(page=>doc.addPage(page));
  }
  doc=await appendFiles(doc,attachments);
  out=await doc.save();
  return new Blob([out],{type:'application/pdf'});
}
