import test from 'node:test';
import assert from 'node:assert/strict';
import {walloniaComputed, WA_MAP, WA_COMPUTED_KEYS} from '../regions/wallonia-pdf.js';

const gas = {controlDate:'2026-01-31',fuel:'Gazeux',year:2005,unitOrPulsed:'air pulsé',powerKw:'80'};

test('computes per-measurement OK/non OK verdicts from the category table',()=>{
  const good=walloniaComputed({...gas,
    co2:'12', co:'110', flueTemp:'200', efficiency:'90'});
  assert.equal(good.cmpCo2,'OK');
  assert.equal(good.cmpFlueTemp,'OK');
  assert.equal(good.globalResult,'OK');
  assert.equal(good.waCategory,'GP A');
  // GP A has no O2 criterion: it must not be printed as OK.
  assert.equal(good.cmpO2,undefined);

  const bad=walloniaComputed({...gas, co2:'12', co:'200', efficiency:'90'});
  assert.equal(bad.cmpCo,'non OK');
  assert.equal(bad.globalResult,'non OK');
});

test('an unclassifiable appliance produces no ticks and no global result',()=>{
  const out=walloniaComputed({controlDate:'2026-01-31',fuel:'Gazeux',co2:'9.5',o2:'5'});
  assert.equal(out.globalResult,undefined);
  assert.equal(out.cmpCo2,undefined);
  assert.equal(out.cmpO2,undefined);
});

test('writes the follow-up date range and remedy date onto page 4',()=>{
  const out=walloniaComputed(gas);
  assert.equal(out.nextFrom,'31/01/2029');
  assert.equal(out.nextTo,'30/04/2029');
  assert.equal(out.remedyDate,'30/06/2026');
  assert.equal(out.maintenanceDate,'31/01/2027');
  assert.equal(WA_MAP.nextFrom[0],3);
  assert.equal(WA_MAP.techSignatureName[0],3);
});

test('computed keys are present on the tool map',()=>{
  for(const k of WA_COMPUTED_KEYS) assert.ok(k in WA_MAP,`${k} has no position`);
});

test('measurement date/time and analyzer identity are mapped',()=>{
  for(const k of ['measureDate','measureTime','analyzerMake','analyzerSerial','waterTemp','flueTemp'])
    assert.ok(k in WA_MAP);
});
