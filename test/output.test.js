import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const tmp=os.tmpdir();
const libPath=path.join(tmp,'attesta-output-pdf-lib.cjs');
const fkPath=path.join(tmp,'attesta-output-fontkit.cjs');
fs.copyFileSync(new URL('../vendor/pdf-lib.min.js',import.meta.url),libPath);
fs.copyFileSync(new URL('../vendor/fontkit.umd.min.js',import.meta.url),fkPath);
globalThis.window={PDFLib:require(libPath),fontkit:require(fkPath)};
globalThis.fetch=async(p)=>{
  const abs=new URL('../'+p,import.meta.url);
  return {ok:fs.existsSync(abs),arrayBuffer:async()=>fs.readFileSync(abs)};
};
const {buildAttestation,embedSignature}=await import('../output.js');
const {overlayWallonia}=await import('../regions/wallonia-official.js');

for(const conformity of ['CONFORME','NON CONFORME']){
  test(`Brussels solid-fuel PDF prints the ${conformity.toLowerCase()} deadline`,async()=>{
    const blob=await buildAttestation({region:'brussels',data:{fuel:'Solide',
      controlDate:'2026-01-31',conformity}});
    assert.equal(blob.type,'application/pdf');
    assert.ok(blob.audit.printed.includes('nextDueDate'));
    assert.ok(!blob.audit.warnings.some(w=>w.startsWith('nextDueDate:')));
  });
}

test('Brussels PDF drops a stale deadline when the control date is invalid',async()=>{
  const blob=await buildAttestation({region:'brussels',data:{fuel:'Solide',
    controlDate:'2026-02-30',conformity:'CONFORME',nextDueDate:'01/01/1999'}});
  assert.ok(blob.audit.omitted.includes('nextDueDate'));
  assert.ok(!blob.audit.printed.includes('nextDueDate'));
});

test('output tolerates malformed persisted scalar values',async()=>{
  const poison={toString:null};
  const blob=await buildAttestation({region:'brussels',data:{fuel:poison,controlDate:poison,conformity:poison}});
  assert.equal(blob.type,'application/json');
  const payload=JSON.parse(await blob.text());
  assert.equal(payload.mode,'manual-rekey');
});

test('Wallonia calibrated output tolerates malformed persisted scalars',async()=>{
  const poison={toString:null};
  const data=Object.fromEntries(['controlDate','attestNumber','techCategory','techName',
    'clientName','clientStreetName','clientStreetNumber','clientCity','techEmail',
    'applianceLocation','model','defects','analyzerMake','analyzerSerial','measureTime',
    'nozzleMake','nozzleFlow','nozzleAngle','conformity','powerKw','followUp',
    'techSignatureName','recipientName','recipientCapacity'].map(key=>[key,poison]));
  const blob=await buildAttestation({region:'wallonia',data});
  assert.equal(blob.type,'application/pdf');
});

test('Wallonia official overlay tolerates malformed persisted scalars',async()=>{
  const poison={toString:null};
  const data=Object.fromEntries(['attestNumber','clientName','fuelDetail','condensation',
    'conformity','powerKw','measureDate','defects','recipientCapacity'].map(key=>[key,poison]));
  const template=fs.readFileSync(new URL('../assets/wa-attestation-blank.pdf',import.meta.url));
  const font=new Uint8Array(fs.readFileSync(new URL('../vendor/DejaVuSans.ttf',import.meta.url)));
  const bytes=await overlayWallonia(template,data,font,{printed:[],ticked:[],warnings:[],omitted:[]});
  const doc=await globalThis.window.PDFLib.PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(),9);
});

test('typed signatures support names outside the standard PDF font',async()=>{
  const doc=await globalThis.window.PDFLib.PDFDocument.create();
  for(let i=0;i<4;i++) doc.addPage([595,842]);
  const audit={printed:[],warnings:[],omitted:[]};
  const previousDocument=globalThis.document;
  let drawnText='';
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  globalThis.document={createElement:()=>({
    width:0,height:0,
    getContext:()=>({setTransform(){},fillRect(){},measureText:text=>({width:text.length*10}),fillText(text){drawnText=text;}}),
    toDataURL:()=>png,
  })};
  try{
    const embedded=await embedSignature(doc,{v:1,typed:'李 AMARA'},'wallonia',audit);
    assert.equal(embedded,true);
    assert.equal(drawnText,'李 AMARA');
    assert.ok(audit.printed.includes('signature'));
    assert.deepEqual(audit.omitted,[]);
  }finally{ globalThis.document=previousDocument; }
});
