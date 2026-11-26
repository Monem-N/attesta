import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildBrusselsHtml,selectedOption,valueFor} from '../print-brussels.js';
import {nextControlDate} from '../regions/brussels.js';
import {LEGACY_MAPS} from '../regions/legacy-maps.js';

test('Brussels nonconformity uses the five-month remedy deadline',()=>{
  const state={data:{controlDate:'2026-01-31',conformity:'NON CONFORME'}};
  assert.equal(buildBrusselsHtml(state).data.nextDueDate,'30.06.2026');
  state.data.conformity='CONFORME';
  assert.equal(buildBrusselsHtml(state).data.nextDueDate,'31.01.2027');
});

test('Brussels deadline is shared by HTML and solid-fuel PDF output',()=>{
  assert.equal(nextControlDate({controlDate:'2026-01-31',conformity:'NON CONFORME'}).toISOString().slice(0,10),'2026-06-30');
  assert.equal(nextControlDate({controlDate:'2026-01-31',conformity:'CONFORME'}).toISOString().slice(0,10),'2027-01-31');
  assert.equal(nextControlDate({controlDate:'2026-02-30',conformity:'CONFORME'}),null);
  assert.deepEqual(LEGACY_MAPS.brussels.nextDueDate,[0,164,323]);
});

test('Brussels negative condensation is not marked as affirmative',()=>{
  assert.equal(selectedOption('condensation','À condensation'),'cond');
  assert.equal(selectedOption('condensation','PAS à condensation'),'pas');
});

test('Brussels print keeps the draught requirement and measured pressure separate',()=>{
  const data={draught:'NON',draughtPa:'-12,5'};
  assert.equal(valueFor(data,'draught'),'NON');
  assert.equal(valueFor(data,'draughtPa'),'-12,5');
  const template=fs.readFileSync(new URL('../brussels.html',import.meta.url),'utf8');
  assert.match(template,/data-tick="draught:non"/);
  assert.match(template,/\{\{draughtPa\}\}/);
  assert.doesNotMatch(template,/\{\{draught\}\}/);
  assert.deepEqual(LEGACY_MAPS.brussels.draughtPa,[3,520,258]);
});

test('Brussels print tolerates malformed persisted scalars',()=>{
  const poison={toString:null};
  assert.doesNotThrow(()=>buildBrusselsHtml({data:{controlDate:poison,conformity:poison,fuel:poison}}));
  assert.equal(selectedOption('fuel',poison),null);
});

test('Brussels print uses the same CO unit as the measurement input',()=>{
  const template=fs.readFileSync(new URL('../brussels.html',import.meta.url),'utf8');
  assert.match(template,/mg CO\/m³ à 13% O₂/);
});
