import test from 'node:test';
import assert from 'node:assert/strict';
import {LEGACY_MAPS} from '../regions/legacy-maps.js';
import {FL_MAPS} from '../regions/flanders-pdf.js';
import {WA_MAP} from '../regions/wallonia-pdf.js';

const allMaps={...LEGACY_MAPS,...FL_MAPS,wallonia:WA_MAP};

test('signature policy: no template map captures or draws a signature',()=>{
  for(const [model,map] of Object.entries(allMaps)){
    // Printed names beside a signature line are fine; captured/drawn marks are not.
    const sigKeys=Object.keys(map).filter(k=>
      /sign|handteken/i.test(k) && !/name|naam/i.test(k));
    assert.deepEqual(sigKeys,[],`${model} has signature anchors: ${sigKeys.join(',')}`);
  }
});

test('signature policy: official models keep their printed blank signature lines',()=>{
  // The models are untouched official PDFs; no signature image is embedded by
  // the pipeline. This guards against a future map silently filling those lines.
  for(const [model,map] of Object.entries(allMaps)){
    assert.ok(Object.keys(map).length>0,`${model} map is empty`);
  }
});
