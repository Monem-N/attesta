import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WA_TEMPLATE_VERSION, WA_CATEGORIES, categoryFor, limitsForField, evaluateCriteria,
} from '../regions/wallonia-criteria.js';

const base = {
  controlDate:'2026-01-31',
  fuel:'Liquide', year:2005, unitOrPulsed:'air pulsé', premix:'non-premix',
};

test('thresholds are pinned to the official template revision',()=>{
  assert.equal(WA_TEMPLATE_VERSION,'2015-10-29');
  // LP A row printed on page 8: smoke 1, CO2 12, O2 4.4, CO 155, efficiency 90.
  const lpA = WA_CATEGORIES.find(c=>c.code==='LP A');
  assert.deepEqual(lpA.limits,{
    smoke:{max:1,lower:true}, co2:{min:12}, o2:{max:4.4,lower:true},
    co:{max:155,lower:true}, efficiency:{min:90},
  });
});

test('liquid burner resolves to LP A and uses its printed limits',()=>{
  const c = categoryFor(base);
  assert.equal(c.code,'LP A');
  assert.equal(c.limits.o2.max,4.4);
  assert.equal(c.limits.smoke.max,1); // the old hard-coded 2 was LP C
});

test('gas pulsed resolves to GP A, where smoke and O2 have NO printed rule',()=>{
  const c = categoryFor({...base, fuel:'Gazeux'});
  assert.equal(c.code,'GP A');
  assert.equal(c.limits.co2.min,8.5);
  assert.equal(c.limits.co.max,110);
  assert.equal(c.limits.flueTemp.max,200);
  assert.equal(c.limits.smoke,undefined);
  assert.equal(c.limits.o2,undefined);
});

test('gas unit premix / non-premix resolve to the GUP / GUnP rows',()=>{
  assert.equal(categoryFor({...base, fuel:'Gazeux', unitOrPulsed:'unit', premix:'prémix', year:2010}).code,'GUP A');
  assert.equal(categoryFor({...base, fuel:'Gazeux', unitOrPulsed:'unit', premix:'non-premix', year:2010}).code,'GUnP A');
});

test('the 30/05/2017 reclassification promotes B categories to A',()=>{
  const old = {...base, year:1990};
  assert.equal(categoryFor({...old, controlDate:'2017-05-29'}).code,'LP B');
  assert.equal(categoryFor({...old, controlDate:'2017-05-30'}).code,'LP A');
});

test('butane and propane add 15 mg/kWh to the CO limit and suffix the code',()=>{
  const butane = categoryFor({...base, fuel:'Gazeux', fuelDetail:'Butane'});
  assert.equal(butane.code,'GP A B');
  assert.equal(butane.limits.co.max,125);
  assert.equal(categoryFor({...base, fuel:'Gazeux', fuelDetail:'Propane'}).code,'GP A P');
});

test('no deciding field means no category, no rule and no OK',()=>{
  const result = evaluateCriteria({co2:'10.1', o2:'5'});
  assert.equal(result.category,null);
  assert.equal(result.globalResult,null);
  for(const r of Object.values(result.results)) assert.equal(r.verdict,null);
  assert.deepEqual(limitsForField({}),{});
});

test('the same CO2 value is OK in GP A but non OK in LP A',()=>{
  const measured = {co2:'9.5', flueTemp:'190', efficiency:'92'};
  const liquid = evaluateCriteria({...base, ...measured});
  const gas = evaluateCriteria({...base, fuel:'Gazeux', ...measured});
  assert.equal(liquid.results.co2.verdict,'non OK'); // LP A requires 12
  assert.equal(gas.results.co2.verdict,'OK');        // GP A requires 8.5
});

test('a value with no printed rule never earns OK',()=>{
  const result = evaluateCriteria({...base, fuel:'Gazeux', o2:'5', smoke:'4'});
  assert.equal(result.results.o2.noRule,true);
  assert.equal(result.results.o2.verdict,null);
  assert.equal(result.results.smoke.noRule,true);
  assert.equal(result.results.smoke.verdict,null);
  assert.equal(result.globalResult,null); // nothing with a rule was measured
});

test('global OK requires a valid reading for every applicable category rule',()=>{
  const partial=evaluateCriteria({...base,fuel:'Gazeux',co2:'12'});
  assert.equal(partial.globalResult,null);
  const complete=evaluateCriteria({...base,fuel:'Gazeux',flueTemp:'190',co2:'9',co:'100',efficiency:'91'});
  assert.equal(complete.globalResult,'OK');
  const malformed=evaluateCriteria({...base,fuel:'Gazeux',flueTemp:'190',co2:'9',co:'bad',efficiency:'91'});
  assert.equal(malformed.globalResult,null);
});

test('global result is non OK as soon as one applicable rule fails',()=>{
  const result = evaluateCriteria({...base, fuel:'Gazeux', co2:'12', co:'200'});
  assert.equal(result.results.co2.verdict,'OK');
  assert.equal(result.results.co.verdict,'non OK');
  assert.equal(result.globalResult,'non OK');
});
