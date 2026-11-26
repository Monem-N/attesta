import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryFor, computeVerdicts, limitsForField} from '../regions/flanders-criteria.js';
import {selectedOption, categoryFor as printCategoryFor, computeVerdicts as printVerdicts, buildFlandersHtml, valueFor, fmtDots} from '../print-flanders.js';

test('j07: techCategory GV resolves and is case-insensitive', () => {
  assert.equal(selectedOption('techCategory', 'Erkend technicus gasvormige brandstof (GV)'), 'gv');
  assert.equal(selectedOption('techCategory', 'Erkend verwarmingsaannemer (VA+)'), 'va');
  assert.equal(selectedOption('techCategory', 'Geschoold vakman (vaste brandstof)'), 'geschoold');
});

test('j13: /va+/ no longer matches vast/vakman as VA', () => {
  // 'Geschoold ... vaste brandstof' must resolve to geschoold, not va
  assert.equal(selectedOption('techCategory', 'Geschoold vakman vaste brandstof'), 'geschoold');
});

test('j04: category by fuel/year/burner', () => {
  assert.equal(categoryFor('gasvormig', 2020, 'air pulsed').code, 'GP A');
  assert.equal(categoryFor('vloeibaar', 2020, '').code, 'LP A');
  assert.equal(categoryFor('gasvormig', 2020, 'unit').code, 'GUnP A');
  assert.equal(categoryFor('vast', 2020, ''), null);
});

test('j04/j05: liquid LP A applies co2 ≥ 12 (9 -> Niet OK)', () => {
  const v = computeVerdicts({fuel: 'vloeibaar', year: '2020', unitOrPulsed: 'air pulsed', co2: {i: '9', f: '9'}});
  assert.equal(v.v_co2_1, 'Niet OK');
});

test('j04: gas GUnP has no CO2 rule (9.1 -> no verdict)', () => {
  const v = computeVerdicts({fuel: 'gasvormig', year: '2020', unitOrPulsed: 'unit', co2: {i: '9.1', f: '9.1'}});
  assert.ok(!('v_co2_1' in v));
});

test('j05: net temperature assessed (not gross flueTemp)', () => {
  const v = computeVerdicts({fuel: 'gasvormig', year: '2020', unitOrPulsed: 'air pulsed', netTemp: {i: '210', f: '210'}});
  assert.equal(v.v_netTemp_1, 'Niet OK'); // GP A net ≤ 200
});

test('Flanders category selection distinguishes premix and non-premix burners', () => {
  assert.equal(categoryFor('gasvormig','2020','unit premix').code,'GUP A');
  assert.equal(categoryFor('gasvormig','2020','unit non-premix').code,'GUnP A');
  assert.equal(categoryFor('gasvormig','2020','unit').code,'GUnP A');
  assert.equal(categoryFor('gasvormig','bad','unit non-premix'),null);
  assert.equal(categoryFor('gasvormig','','unit non-premix'),null);
  assert.equal(printCategoryFor('gasvormig','2020','unit premix').code,'GUP A');
});

test('Flanders field limits expose the same category rules used by printing', () => {
  const gas=limitsForField({fuel:'gasvormig',year:'2020',unitOrPulsed:'air pulsed'});
  assert.deepEqual(gas.co2,{min:8.5});
  assert.deepEqual(gas.co,{max:110});
  assert.deepEqual(gas.netTemp,{max:200});
  assert.equal(gas.o2,undefined);
  assert.deepEqual(limitsForField({fuel:'gasvormig',year:'2020',unitOrPulsed:'air pulsed',gas:'Propaan'}).co,{max:125});
  const liquid=limitsForField({fuel:'vloeibaar',year:'2020'});
  assert.deepEqual(liquid.co2,{min:12});
  assert.deepEqual(liquid.o2,{max:4.4});
});

const completeGasReadings=()=>({
  netTemp:{i:'150',f:'150'},co2:{i:'9',f:'9'},co:{i:'100',f:'100'},efficiency:{i:'91',f:'91'}
});

test('Flanders overall OK requires every applicable measurement in both trials', () => {
  assert.equal(computeVerdicts({fuel:'gasvormig',year:'2020',unitOrPulsed:'air pulsed',...completeGasReadings()}).v_overall,'OK');
  const partial={fuel:'gasvormig',year:'2020',unitOrPulsed:'air pulsed',...completeGasReadings()};
  partial.efficiency.f='';
  assert.equal(computeVerdicts(partial).v_overall,undefined);
  assert.equal(printVerdicts(partial).v_overall,undefined);
  const bad={fuel:'gasvormig',year:'2020',unitOrPulsed:'air pulsed',...completeGasReadings()};
  bad.netTemp.f='250';
  assert.equal(computeVerdicts(bad).v_overall,'Niet OK');
});

test('Flanders print drops persisted verdicts when fresh measurements are incomplete', () => {
  const stale={fuel:'gasvormig',year:'2020',unitOrPulsed:'air pulsed',
    netTemp:{i:'150',f:''},co2:{i:'9',f:'9'},co:{i:'100',f:'100'},efficiency:{i:'91',f:'91'},
    nextDueDate:'01.01.1999',nextCleaning:'01.01.1999',
    v_overall:'OK',v_netTemp_1:'OK',v_netTemp_2:'OK'};
  const built=buildFlandersHtml({data:stale}).data;
  assert.equal(built.v_overall,undefined);
  assert.equal(built.v_netTemp_2,undefined);
  assert.equal(built.nextDueDate,undefined);
  assert.equal(built.nextCleaning,undefined);
  assert.equal(stale.v_overall,'OK','input draft remains unchanged');
});

test('j12: overall verdict is withheld until all applicable measurements exist', () => {
  const ok = computeVerdicts({fuel: 'gasvormig', year: '2020', unitOrPulsed: 'air pulsed', ...completeGasReadings()});
  assert.equal(ok.v_overall, 'OK');
  const bad = computeVerdicts({fuel: 'gasvormig', year: '2020', unitOrPulsed: 'air pulsed', ...completeGasReadings(), netTemp:{i:'250',f:'250'}});
  assert.equal(bad.v_overall, 'Niet OK');
});

test('valueFor pair + scalar', () => {
  assert.equal(valueFor({o2: {i: '3.1', f: '3.0'}}, 'o2_1'), '3.1');
  assert.equal(valueFor({o2: {i: '3.1', f: '3.0'}}, 'o2_2'), '3.0');
  assert.equal(valueFor({draft: '2'}, 'draft_2'), '2');
});

test('j08: buildFlandersHtml does not mutate input state', () => {
  const state = {region: 'flanders', data: {fuel: 'gasvormig', year: '2020', unitOrPulsed: 'air pulsed'}};
  buildFlandersHtml(state);
  assert.ok(!('v_overall' in state.data));
});

test('Flanders print preparation tolerates malformed persisted scalars', () => {
  const poison={toString:null};
  assert.doesNotThrow(()=>buildFlandersHtml({data:{document:poison,fuel:poison,gas:poison,year:poison}}));
  assert.equal(selectedOption('fuel',poison),null);
});

test('fmtDots formats ISO and slash', () => {
  assert.equal(fmtDots('2026-10-15'), '15.10.2026');
  assert.equal(fmtDots('15/10/2026'), '15.10.2026');
});