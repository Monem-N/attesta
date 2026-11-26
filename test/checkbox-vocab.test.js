import test from 'node:test';
import assert from 'node:assert/strict';
import {binaryIndex,normalizeBinary} from '../regions/checkbox-vocab.js';

test('affirmative vocabulary across all three regions',()=>{
  for(const v of ['OUI','oui','Ja','YES','conforme','CONFORME','Goed en veilig','ok','present','true',1])
    assert.equal(binaryIndex(v),0,`${v} should tick the first box`);
});

test('negative vocabulary across all three regions',()=>{
  for(const v of ['NON','non','Nee','NO','non conforme','NON CONFORME','niet ok','Niet goed','Niet veilig','afwezig','false',0])
    assert.equal(binaryIndex(v),1,`${v} should tick the second box`);
});

test('non-binary values are not ticked',()=>{
  for(const v of [null,undefined,'','Contrôle périodique','Type 1',true,false,'peut-être'])
    assert.equal(binaryIndex(v),null,`${v} must be written as text, not ticked`);
});

test('malformed persisted scalars are not coerced into checkbox verdicts',()=>{
  assert.equal(binaryIndex({toString:null}),null);
  assert.equal(normalizeBinary({toString:null}),null);
});

test('normalizer prints the region-neutral tick label',()=>{
  assert.equal(normalizeBinary('Ja'),'OUI');
  assert.equal(normalizeBinary('niet goed'),'NON');
  assert.equal(normalizeBinary('Type 2'),null);
});
