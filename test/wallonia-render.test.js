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

const {renderWallonia}=await import('../regions/wallonia-render.js');
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

test('generated source excludes instruction pages and the post-signature notice',()=>{
  const src=fs.readFileSync(new URL('../regions/wallonia-render.js',import.meta.url),'utf8');
  assert.ok(!src.includes('Dernière mise à jour'));
  assert.ok(!src.includes('Logigramme'));
  assert.ok(!/text\(p,\s*['"]ATTENTION/.test(src));
  assert.ok(src.includes('1 / 4'));
  assert.ok(src.includes('4 / 4'));
});
