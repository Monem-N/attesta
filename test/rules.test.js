import test from 'node:test';
import assert from 'node:assert/strict';
import {wallonia} from '../regions/wallonia.js';
import {flanders} from '../regions/flanders.js';
import {brussels} from '../regions/brussels.js';

test('Wallonia uses 3 years at exactly 100 kW gas',()=>{
  const result=wallonia.rules.nextDue('2026-01-31',{fuel:'Gazeux',powerKw:'100'});
  assert.equal(result.years,3);
  assert.equal(result.conflict,true);
  assert.equal(result.date.getFullYear(),2029);
});

test('Wallonia clamps leap-day and month-end deadlines',()=>{
  assert.equal(wallonia.rules.nonConformity('2026-09-30').getMonth(),1);
  assert.equal(wallonia.rules.nextDue('2028-02-29',{fuel:'Gazeux',powerKw:'50'}).date.getDate(),28);
});

test('Flanders and Brussels fuel schedules return regional due dates',()=>{
  assert.equal(flanders.rules.nextDue('2026-01-31',{fuel:'Gasvormig'}).years,2);
  assert.equal(flanders.rules.nextDue('2026-01-31',{fuel:'Vloeibaar'}).years,1);
  assert.equal(brussels.rules.nextDue('2026-01-31',{fuel:'Gazeux'}).years,2);
  assert.equal(brussels.rules.nextDue('2026-01-31',{fuel:'Liquide'}).years,1);
  assert.equal(brussels.rules.nonConformity('2026-01-31').getMonth(),5);
});
