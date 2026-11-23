import test from 'node:test';
import assert from 'node:assert/strict';
import {walloniaComputed, WA_MAP, WA_COMPUTED_KEYS, WA_WIDTHS} from '../regions/wallonia-pdf.js';

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

test('writes the follow-up date range only when commissioning is known',()=>{
  const anchored=walloniaComputed({...gas,commissioningDate:'2020-01-31'});
  assert.equal(anchored.nextFrom,'31/01/2023');
  assert.equal(anchored.nextTo,'30/04/2023');
  assert.equal(WA_MAP.nextFrom[0],3);
  assert.equal(WA_MAP.techSignatureName[0],3);
  const provisional=walloniaComputed(gas);
  assert.equal(provisional.nextFrom,undefined);
  assert.equal(provisional.nextTo,undefined);
});

test('remedy and maintenance dates are only printed when applicable',()=>{
  const compliant=walloniaComputed({...gas,conformity:'CONFORME',maintenanceIntervalMonths:'12'});
  assert.equal(compliant.remedyDate,undefined);
  assert.equal(compliant.maintenanceDate,'31/01/2027');
  const nonConform=walloniaComputed({...gas,conformity:'NON CONFORME'});
  assert.equal(nonConform.remedyDate,'30/06/2026');
  assert.equal(nonConform.maintenanceDate,undefined);
  const stale=walloniaComputed({...gas,remedyDate:'01/01/2000',maintenanceDate:'02/02/2000'});
  assert.equal(stale.remedyDate,undefined);
  assert.equal(stale.maintenanceDate,undefined);
});

test('page-1 widths keep values inside their printed columns',()=>{
  const left=['controlDate','techName','techAgrement','company','techPhone','techEmail','bce'];
  const right=['clientName','clientCompany','clientStreet','clientCity','clientPhone','clientEmail'];
  for(const key of left){
    const [pi,x]=WA_MAP[key];
    assert.equal(pi,0);
    assert.ok(x+WA_WIDTHS[key]<=292,`${key} crosses the centre divider`);
  }
  for(const key of right){
    const [pi,x]=WA_MAP[key];
    assert.equal(pi,0);
    assert.ok(x+WA_WIDTHS[key]<=560,`${key} runs off the right column`);
  }
});

test('computed keys are present on the tool map',()=>{
  for(const k of WA_COMPUTED_KEYS) assert.ok(k in WA_MAP,`${k} has no position`);
});

test('measurement date/time and analyzer identity are mapped',()=>{
  for(const k of ['measureDate','measureTime','analyzerMake','analyzerSerial','waterTemp','flueTemp'])
    assert.ok(k in WA_MAP);
});
