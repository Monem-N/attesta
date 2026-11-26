import test from 'node:test';
import assert from 'node:assert/strict';
import {wallonia} from '../regions/wallonia.js';
import {flanders} from '../regions/flanders.js';
import {brussels} from '../regions/brussels.js';
import {
  validateWorkflow, recognitionPattern, brusselsAnnexRequired, attachmentsForFields
} from '../input-validation.js';

const allFields=config=>config.steps.flatMap(step=>step.fields);

test('every configured field has a unique key and a supported input type', () => {
  const supported=new Set(['text','textarea','select','number','date','time','measure','checkbox','file','signature']);
  for (const config of [wallonia,flanders,brussels]) {
    const keys=allFields(config).map(field=>field.key);
    assert.equal(new Set(keys).size,keys.length,`${config.id} has duplicate keys`);
    for (const field of allFields(config)) {
      assert.ok(supported.has(field.type),`${config.id}.${field.key} has unsupported type ${field.type}`);
      assert.equal(typeof field.label==='object'||typeof field.label==='string',true);
    }
  }
});

test('workflow validation trims required values in every region', () => {
  for (const config of [wallonia,flanders,brussels]) {
    const errors=validateWorkflow(config,{});
    for (const field of allFields(config)) {
      if (!field.required || typeof field.when==='function') continue;
      assert.equal(errors[field.key],'required',`${config.id}.${field.key}`);
    }
  }
  assert.equal(validateWorkflow(wallonia,{techName:'   '}).techName,'required');
  assert.equal(validateWorkflow(flanders,{clientName:'\n\t'}).clientName,'required');
  assert.equal(validateWorkflow(brussels,{company:'   '}).company,'required');
});

test('hidden conditional fields neither validate nor retain stale errors', () => {
  const config={id:'test',steps:[{fields:[
    {key:'always',type:'text',required:true},
    {key:'hidden',type:'text',required:true,when:()=>false}
  ]}]};
  assert.deepEqual(validateWorkflow(config,{always:'ok',hidden:'bad shape'}),{});
  assert.deepEqual(validateWorkflow(config,{always:' ',hidden:''}),{always:'required'});
});

test('step validation ignores cross-field errors owned by another step',()=>{
  const first={...wallonia,steps:[wallonia.steps[0]]};
  const errors=validateWorkflow(first,{});
  assert.equal(errors.clientStreetName,undefined);
  assert.equal(errors.controlDate,'required');
});

test('recognition validation is category-safe and does not throw on malformed drafts', () => {
  assert.equal(recognitionPattern('flanders',{techCategory:'Erkend technicus gasvormige brandstof (GV)'}).test('GV12345'),true);
  assert.equal(recognitionPattern('flanders',{techCategory:'Geschoold vakman (vaste brandstof)'}),null);
  assert.equal(recognitionPattern('wallonia',{techCategory:'Technicien agréé GI'}).test('05431'),true);
  assert.equal(recognitionPattern('wallonia',{techCategory:'Technicien spécialisé en combustibles solides'}),null);
  assert.equal(recognitionPattern('brussels',{techCategory:'Technicien chaudière PEB GII'}).test('GII'),true);
  assert.doesNotThrow(()=>recognitionPattern('brussels',{techCategory:{}}));
  const errors=validateWorkflow(brussels,{techCategory:{},techAgrement:'GII'});
  assert.equal(errors.techCategory,'invalid');
});

test('Wallonia requires a nonblank split or legacy address', () => {
  assert.equal(validateWorkflow(wallonia,{clientStreetName:' ',clientStreetNumber:'12'}).clientStreetName,'required');
  assert.equal(validateWorkflow(wallonia,{clientStreetName:'Rue',clientStreetNumber:' '}).clientStreetName,'required');
  assert.equal(validateWorkflow(wallonia,{clientStreet:' Rue 12 '}).clientStreetName,undefined);
});

test('Wallonia rejects impossible commissioning order and mismatched fuel details', () => {
  const order=validateWorkflow(wallonia,{controlDate:'2026-01-10',commissioningDate:'2026-02-01'});
  assert.equal(order.commissioningDate,'invalid');
  const fuel=validateWorkflow(wallonia,{fuel:'Gazeux',fuelDetail:'Gasoil'});
  assert.equal(fuel.fuelDetail,'invalid');
  assert.equal(validateWorkflow(wallonia,{fuel:'Liquide',fuelDetail:'Gasoil'}).fuelDetail,undefined);
  assert.equal(validateWorkflow(wallonia,{fuel:'Solide',fuelDetail:'Pellets bois'}).fuelDetail,undefined);
});

test('Brussels system type enforces the limits stated in its own options', () => {
  const type1=validateWorkflow(brussels,{systemType:'Type 1 (1 chaudière ≤ 100 kW)',powerKw:'120',boilerCount:'1'});
  assert.equal(type1.systemType,'invalid');
  const type1Several=validateWorkflow(brussels,{systemType:'Type 1 (1 chaudière ≤ 100 kW)',powerKw:'80',boilerCount:'2'});
  assert.equal(type1Several.systemType,'invalid');
  const type2=validateWorkflow(brussels,{systemType:'Type 2 (> 100 kW ou plusieurs chaudières)',powerKw:'80',boilerCount:''});
  assert.equal(type2.boilerCount,'required');
  assert.equal(validateWorkflow(brussels,{systemType:'Type 2 (> 100 kW ou plusieurs chaudières)',powerKw:'120',boilerCount:''}).systemType,undefined);
});

test('Brussels Type 1 requires its single boiler count', () => {
  const errors=validateWorkflow(brussels,{systemType:'Type 1 (1 chaudière ≤ 100 kW)',powerKw:'80',boilerCount:''});
  assert.equal(errors.boilerCount,'required');
});

test('Brussels malformed system types are rejected without throwing', () => {
  for (const systemType of [42,{}]) {
    const errors=validateWorkflow(brussels,{systemType,powerKw:'80'});
    assert.equal(errors.systemType,'invalid');
  }
  assert.equal(validateWorkflow(brussels,{systemType:[],powerKw:'80'}).systemType,'required');
});

test('Brussels keeps draught compliance separate from measured pressure', () => {
  const requirement=allFields(brussels).find(f=>f.key==='draught');
  const measurement=allFields(brussels).find(f=>f.key==='draughtPa');
  assert.equal(requirement.type,'select');
  assert.deepEqual(requirement.options,['OUI','NON']);
  assert.equal(measurement.type,'number');
  assert.equal(measurement.required,true);
  assert.equal(validateWorkflow(brussels,{draught:'NON',draughtPa:'-12,5'}).draught,undefined);
  assert.equal(validateWorkflow(brussels,{draught:'NON',draughtPa:'-12,5'}).draughtPa,undefined);
  assert.equal(validateWorkflow(brussels,{draught:'NON',draughtPa:'OUI'}).draughtPa,'invalid');
  assert.equal(validateWorkflow(brussels,{draught:'NON',draughtPa:''}).draughtPa,'required');
});

test('required attachment names must resolve to bytes in the current job',()=>{
  const missing=new Map([['tickets',[{name:'old.pdf'}]]]);
  assert.equal(validateWorkflow(brussels,{tickets:['current.pdf']},missing).tickets,'missing');
  const current=new Map([['tickets',[{name:'current.pdf'}]]]);
  assert.equal(validateWorkflow(brussels,{tickets:['current.pdf']},current).tickets,undefined);
});

test('Brussels mandatory measurement tickets and nonconformity details cannot be omitted',()=>{
  assert.equal(validateWorkflow(brussels,{tickets:[]}).tickets,'required');
  assert.equal(validateWorkflow(brussels,{tickets:['mesures.pdf']}).tickets,undefined);
  assert.equal(validateWorkflow(brussels,{conformity:'NON CONFORME',defects:' '}).defects,'required');
});

test('Brussels annex requirement follows nominal power at the 1000 kW boundary', () => {
  assert.equal(brusselsAnnexRequired({powerKw:'999.9'}),false);
  assert.equal(brusselsAnnexRequired({powerKw:'1000'}),true);
  assert.equal(brusselsAnnexRequired({powerKw:'1200,5'}),true);
  assert.equal(brusselsAnnexRequired({powerKw:'bad'}),false);
  assert.equal(validateWorkflow(brussels,{powerKw:'1000',annex1mw:false}).annex1mw,'required');
  assert.equal(validateWorkflow(brussels,{powerKw:'500',annex1mw:true}).annex1mw,'invalid');
});

test('Wallonia requires details explicitly called for by selected answers', () => {
  assert.equal(validateWorkflow(wallonia,{conformity:'NON CONFORME',defects:' '}).defects,'required');
  assert.equal(validateWorkflow(wallonia,{pumpIssue:'OUI',regulationRemarks:''}).regulationRemarks,'required');
  assert.equal(validateWorkflow(wallonia,{raccordement:'C',raccordementDetail:''}).raccordementDetail,'required');
  assert.equal(validateWorkflow(wallonia,{burnerType:'plusieurs allures',load2:''}).load2,'required');
  assert.equal(validateWorkflow(wallonia,{plaque:'Absente',year:''}).year,'required');
});

test('Wallonia positive conformity cannot contradict mandatory local checks', () => {
  const errors=validateWorkflow(wallonia,{conformity:'CONFORME',ventLocal:'NON',airSupply:'OUI',flue:'OUI'});
  assert.equal(errors.conformity,'invalid');
  const blank=validateWorkflow(wallonia,{conformity:'CONFORME',ventLocal:'',airSupply:'OUI',flue:'OUI'});
  assert.equal(blank.ventLocal,'required');
});

test('editing a split Wallonia address cannot silently drop a legacy number', () => {
  const errors=validateWorkflow(wallonia,{clientStreetName:'Rue de la Gare',clientStreetNumber:'',clientStreet:'Rue de la Gare 12 bis'});
  assert.equal(errors.clientStreetNumber,'required');
});

test('Brussels GII recognition does not accept the GI category label', () => {
  const pattern=recognitionPattern('brussels',{techCategory:'Technicien chaudière PEB GII'});
  assert.equal(pattern.test('GI'),false);
  assert.equal(pattern.test('GII'),true);
});

test('malformed persisted scalar values cannot break visibility or cross-field checks', () => {
  const poison={toString:null};
  const fl=validateWorkflow(flanders,{document:poison});
  assert.equal(fl.document,'invalid');
  const wa=validateWorkflow(wallonia,{fuel:'Liquide',fuelDetail:poison});
  assert.equal(wa.fuelDetail,'invalid');
  const agreement=validateWorkflow(wallonia,{techCategory:'Technicien agréé GI',techAgrement:poison});
  assert.equal(agreement.techAgrement,'invalid');
  const checks=validateWorkflow(wallonia,{conformity:'CONFORME',ventLocal:poison,airSupply:'OUI',flue:'OUI'});
  assert.equal(checks.ventLocal,'invalid');
});

test('Flanders oxygen rejects negative physical readings but allows nonconforming ones', () => {
  assert.equal(validateWorkflow(flanders,{o2:{i:'-1',f:'3'}}).o2,'invalid');
  assert.equal(validateWorkflow(flanders,{o2:{i:'5',f:'3'}}).o2,undefined);
});

test('measurement fields reject impossible physical values but allow nonconforming readings', () => {
  assert.equal(validateWorkflow(wallonia,{smoke:'10'}).smoke,'invalid');
  assert.equal(validateWorkflow(wallonia,{co:'-1'}).co,'invalid');
  assert.equal(validateWorkflow(wallonia,{efficiency:'101'}).efficiency,'invalid');
  assert.equal(validateWorkflow(wallonia,{co:'200'}).co,undefined);
  assert.equal(validateWorkflow(brussels,{co:'200'}).co,undefined);
  assert.equal(validateWorkflow(brussels,{o2:'101'}).o2,'invalid');
});

test('attachments are limited to selected files from the current draft', () => {
  const fields=[{key:'tickets',type:'file'}];
  const data={tickets:['current.pdf']};
  const files=new Map([
    ['tickets',[{name:'current.pdf'},{name:'old.pdf'}]],
    ['other',[{name:'other.pdf'}]]
  ]);
  const selected=attachmentsForFields(fields,data,files);
  assert.deepEqual([...selected.keys()],['tickets']);
  assert.deepEqual(selected.get('tickets').map(file=>file.name),['current.pdf']);
  assert.equal(attachmentsForFields(fields,{tickets:'bad'},files).size,0);
});
