import test from 'node:test';
import assert from 'node:assert/strict';
import {LEGACY_MAPS} from '../regions/legacy-maps.js';
import {FL_MAPS} from '../regions/flanders-pdf.js';
import {WA_MAP} from '../regions/wallonia-pdf.js';

const allMaps={...LEGACY_MAPS,...FL_MAPS,wallonia:WA_MAP};

// Superseded 2026-11-26: the product now supports an optional drawn/typed
// signature (PRODUCT.md, docs/field-matrix.md). The maps carry exactly one
// `signature` anchor per model; printed name anchors stay separate.
test('signature policy: each template map carries exactly one signature anchor',()=>{
  for(const [model,map] of Object.entries(allMaps)){
    const sigKeys=Object.keys(map).filter(k=>
      /sign|handteken/i.test(k) && !/name|naam/i.test(k));
    assert.deepEqual(sigKeys,['signature'],`${model} signature anchors: ${sigKeys.join(',')}`);
  }
});

test('signature policy: the signature anchor never reuses a printed-name anchor',()=>{
  for(const [model,map] of Object.entries(allMaps)){
    const name=map.techSignatureName;
    if(!name) continue;
    assert.notEqual(name.join(','),map.signature.join(','),
      `${model} signature anchor collides with the printed name`);
  }
});

test('signature policy: official models keep their printed signature lines',()=>{
  for(const [model,map] of Object.entries(allMaps)){
    assert.ok(Object.keys(map).length>0,`${model} map is empty`);
  }
});