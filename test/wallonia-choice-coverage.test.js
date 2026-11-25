import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectedOption} from '../print-wallonia.js';

const tpl = fs.readFileSync(new URL('../wallonia.html', import.meta.url), 'utf8');

test('B/C raccordement has both a printed detail token and tick boxes', () => {
  assert.ok(tpl.includes('{{raccordementDetail}}'));
  assert.ok(tpl.includes('data-tick="raccordement:b"'));
  assert.ok(tpl.includes('data-tick="raccordement:c"'));
  assert.equal(selectedOption('raccordement','B'), 'b');
  assert.equal(selectedOption('raccordement','C'), 'c');
});

test('plusieurs allures ticks its printed box', () => {
  assert.ok(tpl.includes('data-tick="burnerType:plusieurs allures"'));
  assert.equal(selectedOption('burnerType','plusieurs allures'), 'plusieurs allures');
});

test('Dispensé answers OUI on the orifices question', () => {
  assert.ok(tpl.includes('data-tick="orifices:oui"'));
  assert.equal(selectedOption('orifices','Dispensé'), 'oui');
  assert.equal(selectedOption('orifices','Présent et conforme'), 'conforme');
  assert.equal(selectedOption('orifices','Présent et non conforme'), 'non conforme');
});

test('solid-fuel criteria have tick boxes and resolvable rules', () => {
  for (const marker of ['solidSmoke:oui','solidSmoke:non','solidFlue:oui','solidFlue:non',
                        'solidResult:OK','solidResult:non OK']) {
    assert.ok(tpl.includes(`data-tick="${marker}"`), `missing ${marker}`);
  }
  assert.equal(selectedOption('solidSmoke','OUI'), 'oui');
  assert.equal(selectedOption('solidSmoke','NON'), 'non');
  assert.equal(selectedOption('solidFlue','NON'), 'non');
  assert.equal(selectedOption('solidResult','OK'), 'OK');
  assert.equal(selectedOption('solidResult','non OK'), 'non OK');
});
