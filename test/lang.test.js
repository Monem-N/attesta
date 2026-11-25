import test from 'node:test';
import assert from 'node:assert/strict';
import {resolved,optionValue,optionLabel,optionValues,isBilingual} from '../lang.js';
import {flanders,O} from '../regions/flanders.js';

test('resolved picks the requested language and falls back to nl', () => {
  const label={nl:'Brandstof',fr:'Combustible'};
  assert.equal(resolved(label,'nl'),'Brandstof');
  assert.equal(resolved(label,'fr'),'Combustible');
  assert.equal(resolved(label,'de'),'Brandstof');
  assert.equal(resolved('Plain string','fr'),'Plain string');
  assert.equal(resolved(null,'fr'),'');
});

test('option display translates but the stored value stays canonical', () => {
  const o=O('Gasvormig','Gasvormig','Gazeux');
  assert.equal(optionValue(o),'Gasvormig');
  assert.equal(optionLabel(o,'nl'),'Gasvormig');
  assert.equal(optionLabel(o,'fr'),'Gazeux');
  assert.equal(optionValue('OK'),'OK');
  assert.equal(optionLabel('OK','fr'),'OK');
});

test('optionValues returns canonical values for a Flanders select', () => {
  const fuel=flanders.steps.flatMap(s=>s.fields).find(f=>f.key==='fuel');
  assert.deepEqual(optionValues(fuel),['Gasvormig','Vloeibaar','Vast']);
  assert.deepEqual(optionValues({options:['a','b']}),['a','b']);
});

test('isBilingual only accepts label pairs', () => {
  assert.ok(isBilingual({nl:'a',fr:'b'}));
  assert.ok(!isBilingual(['a','b']));
  assert.ok(!isBilingual('a'));
});
