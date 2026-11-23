import test from 'node:test';
import assert from 'node:assert/strict';
import {wallonia} from '../regions/wallonia.js';
import {brussels} from '../regions/brussels.js';
import {flanders} from '../regions/flanders.js';
import {LEGACY_MAPS, COMPUTED_KEYS} from '../regions/legacy-maps.js';
import {WA_MAP, WA_COMPUTED_KEYS, WA_MAP_ONLY} from '../regions/wallonia-pdf.js';
import {FL_MAPS} from '../regions/flanders-pdf.js';

const keys=cfg=>new Set(cfg.steps.flatMap(s=>s.fields).map(f=>f.key));
const missing=(cfg,map)=>[...keys(cfg)].filter(k=>!(k in map)&&!COMPUTED_KEYS.has(k));

test('Wallonia map covers every wizard field',()=>{
  assert.deepEqual(missing(wallonia,WA_MAP),[]);
});
test('Wallonia map has no orphan or colliding anchors',()=>{
  const seen=new Map();
  for(const [key,anchor] of Object.entries(WA_MAP)){
    if(typeof anchor==='function') continue;
    const k=anchor.join(',');
    assert.equal(seen.get(k),undefined,`${key} collides with ${seen.get(k)}`);
    seen.set(k,key);
  }
});

test('Flanders maps jointly cover every printable wizard field',()=>{
  const union=Object.assign({},...Object.values(FL_MAPS));
  assert.deepEqual(missing(flanders,union),['document','condensation','vekaRef','vekaDate']);
});

// Regression guard: the Brussels solid-fuel map is known to be incomplete
// (task P0-8). This test fails if it gets worse and passes when it improves.
test('Brussels solid-fuel coverage does not regress',()=>{
  // `tickets` bytes are appended as pages; `techCategory` needs a printed
  // option tick (no checkbox rectangles exist yet for this model).
  const outstanding=new Set(['tickets','techCategory']);
  const gap=missing(brussels,LEGACY_MAPS.brussels);
  assert.ok(gap.every(k=>outstanding.has(k)),`new unmapped fields: ${gap.filter(k=>!outstanding.has(k))}`);
  assert.ok(gap.length<=outstanding.size,`coverage improved: update outstanding list (${gap.length})`);
});

test('no template map contains a key that is not a wizard field',()=>{
  for(const [name,cfg,map] of [
    ['wallonia',wallonia,WA_MAP],
    ['brussels',brussels,LEGACY_MAPS.brussels],
    ['flanders',flanders,Object.assign({},...Object.values(FL_MAPS))],
  ]){
    const valid=new Set([...keys(cfg),...COMPUTED_KEYS,...(name==='wallonia'?[...WA_COMPUTED_KEYS,...WA_MAP_ONLY]:[])]);
    const orphans=Object.keys(map).filter(k=>!valid.has(k));
    assert.deepEqual(orphans,[],`${name}: orphan map keys ${orphans}`);
  }
});
