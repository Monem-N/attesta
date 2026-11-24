import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

const tmp=os.tmpdir();
const libPath=path.join(tmp,'attesta-pdf-lib.cjs');
const fkPath=path.join(tmp,'attesta-fontkit.cjs');
fs.copyFileSync(new URL('../vendor/pdf-lib.min.js',import.meta.url),libPath);
fs.copyFileSync(new URL('../vendor/fontkit.umd.min.js',import.meta.url),fkPath);
globalThis.window={PDFLib:require(libPath),fontkit:require(fkPath)};

const {renderWallonia,parseLoad}=await import('../regions/wallonia-render.js');
const fontBytes=new Uint8Array(fs.readFileSync(new URL('../vendor/DejaVuSans.ttf',import.meta.url)));

test('Wallonia output is a clean four-page generated attestation',async()=>{
  const audit={printed:[],ticked:[],warnings:[],omitted:[],clipped:[]};
  const data={controlDate:'2026-03-15',commissioningDate:'2020-03-15',fuel:'Gazeux',
    fuelDetail:'Gaz nat. G20',powerKw:'80',year:2020,techCategory:'Technicien agréé GI',
    techName:'Élise Laurent',clientName:'Albert Dupont',conformity:'CONFORME',
    co2:'12',co:'100',efficiency:'92',waCategory:'GUP A'};
  const bytes=await renderWallonia(data,fontBytes,audit);
  const doc=await globalThis.window.PDFLib.PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(),4);
  assert.equal(audit.template.model,'wallonia-clean-4p');
  assert.deepEqual(audit.warnings,[]);
});

test('audit is populated and selections are exclusive',async()=>{
  const audit={printed:[],ticked:[],warnings:[],omitted:[],clipped:[]};
  const data={controlDate:'2026-03-15',techCategory:'Technicien agréé GI',
    orifices:'Présent et non conforme',conformity:'NON CONFORME',
    followUp:'Entretien conseillé',defects:'Réglage à refaire',
    fuelDetail:'Gaz nat. G20',load2:'CO₂ 11 / O₂ 4 / CO 100 / rendement 91'};
  await renderWallonia(data,fontBytes,audit);
  assert.ok(audit.printed.length>10,'printed fields recorded');
  assert.ok(audit.ticked.includes('GI'));
  assert.ok(!audit.ticked.includes('GII'),'GI must not tick GII');
  assert.ok(audit.ticked.includes('Présent et non conforme'));
  assert.ok(!audit.ticked.includes('Présent et conforme'),'non-conforme must not tick conforme');
  assert.ok(audit.ticked.includes('NON'),'declaration mapped to NON');
  assert.ok(audit.ticked.includes('Entretien conseillé'));
});

test('solid fuel uses its own global result',async()=>{
  const audit={printed:[],ticked:[],warnings:[],omitted:[],clipped:[]};
  await renderWallonia({controlDate:'2026-03-15',fuel:'Solide',fuelDetail:'Pellets bois',
    solidSmoke:'OUI',solidFlue:'OUI',solidResult:'OK'},fontBytes,audit);
  assert.ok(audit.printed.includes('verdict:OK'));
});

test('parseLoad handles the documented CO₂/O₂ input without cross-capturing CO',()=>{
  const p=parseLoad('CO₂ 11 / O₂ 4 / CO 100 / rendement 91');
  assert.equal(p.co2,'11');
  assert.equal(p.o2,'4');
  assert.equal(p.co,'100');
  assert.equal(p.efficiency,'91');
});

test('requester and solid-technician selection tick exactly one correct box',async()=>{
  const audit={printed:[],ticked:[],warnings:[],omitted:[],clipped:[]};
  await renderWallonia({controlDate:'2026-03-15',requester:'Locataire',
    techCategory:'Technicien spécialisé en combustibles solides'},fontBytes,audit);
  assert.ok(audit.ticked.includes('Locataire'));
  assert.ok(!audit.ticked.includes('Propriétaire'));
  assert.ok(audit.ticked.includes('Technicien spécialisé en combustibles solides'));
  assert.ok(!audit.ticked.some(x=>/^(L|GI|GII)$/.test(x)),'solid specialist is not agréé');
});

test('generated source excludes instruction pages and the post-signature notice',()=>{
  const src=fs.readFileSync(new URL('../regions/wallonia-render.js',import.meta.url),'utf8');
  assert.ok(!src.includes('Dernière mise à jour'));
  assert.ok(!src.includes('Logigramme'));
  assert.ok(!/text\(p,\s*['"]ATTENTION/.test(src));
  assert.ok(src.includes('1 / 4'));
  assert.ok(src.includes('4 / 4'));
  assert.ok(!src.includes('d.causes'));
  assert.ok(src.includes('techSignatureName')&&src.includes('recipientName'));
});
