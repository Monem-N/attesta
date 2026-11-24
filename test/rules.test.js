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

test('Wallonia anchors the control window to first commissioning (art. 13 §2)',()=>{
  const r=wallonia.rules.nextDue('2026-01-10',{
    fuel:'Gazeux',powerKw:'80',commissioningDate:'2020-03-15'});
  // first anniversary strictly AFTER the completed control
  assert.equal(r.date.getFullYear(),2026);
  assert.equal(r.date.getMonth(),2);
  assert.equal(r.date.getDate(),15);
  // three-month window after the anniversary
  assert.equal(r.to.getMonth(),5);
  assert.equal(r.to.getDate(),15);
  assert.equal(r.anchoredTo,'2020-03-15');
  assert.ok(!r.note.includes('à défaut'));
});

test('Wallonia advances a full cycle when the control falls on an anniversary (Zied sample)',()=>{
  const r=wallonia.rules.nextDue('2026-10-15',{
    fuel:'Gazeux',powerKw:'80',commissioningDate:'2023-10-15',year:2023});
  assert.equal(r.date.getFullYear(),2029);
  assert.equal(r.date.getMonth(),9);
  assert.equal(r.date.getDate(),15);
  assert.equal(r.to.getFullYear(),2030);
  assert.equal(r.to.getMonth(),0);
  assert.equal(r.to.getDate(),15);
});

test('Wallonia finds a future cycle for a very old installation',()=>{
  const r=wallonia.rules.nextDue('2026-06-01',{
    fuel:'Liquide',powerKw:'80',commissioningDate:'1970-06-01'});
  assert.ok(r.date>new Date('2026-06-01'),`${r.date} must be after the control`);
  assert.equal(r.date.getFullYear(),2027); // 1-year cycle
});

test('Wallonia falls back to the control date with an explicit caveat',()=>{
  const r=wallonia.rules.nextDue('2026-01-10',{fuel:'Gazeux',powerKw:'80'});
  assert.equal(r.date.getFullYear(),2029);
  assert.ok(r.note.includes('à défaut'));
  assert.equal(r.anchoredTo,'2026-01-10');
});

test('first-commissioning controls use their own date as the anchor',()=>{
  const r=wallonia.rules.nextDue('2026-01-10',{fuel:'Gazeux',powerKw:'80',intervention:'Première mise en service'});
  assert.equal(r.anchoredTo,'2026-01-10');
  assert.ok(!r.note.includes('à défaut'));
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
