import test from 'node:test';
import assert from 'node:assert/strict';
import {flanders} from '../regions/flanders.js';

const base={
  intervention:'Periodiek onderhoud',controlDate:'2026-01-31',attestNumber:'1',
  document:'Verbrandingsattest + reinigingsattest',
  techCategory:'Erkend technicus gasvormige brandstof (GV)',techName:'Jan Jansen',
  techAgrement:'GV12345',company:'Installatie NV',bce:'0123456789',
  clientName:'Marie Peeters',clientStreet:'Kerkstraat 10',clientCity:'3000 Leuven',
  fuel:'Gasvormig',powerKw:'80',
  conformity:'Goed en veilig',vekaRef:'VEKA-1',vekaDate:'2026-02-10',
};
const keuring={...base,document:'Keuringsrapport + verbrandingsattest',
  conformity:undefined,
  conformStooktoestel:'OK',conformRookgas:'OK',conformStookplaats:'OK',conformVerbranding:'OK'};

function missingRequired(data){
  const visible=f=>typeof f.when!=='function'||f.when(data);
  return flanders.steps.flatMap(s=>s.fields).filter(f=>visible(f)&&f.required)
    .filter(f=>data[f.key]===''||data[f.key]==null).map(f=>f.key);
}

test('every step can be completed for the periodic document',()=>{
  assert.deepEqual(missingRequired(base),[]);
});
test('every step can be completed for the keuring document',()=>{
  assert.deepEqual(missingRequired(keuring),[]);
  // The combustion-only assessment must not block the keuring path.
  const fields=flanders.steps.flatMap(s=>s.fields);
  assert.equal(fields.find(f=>f.key==='conformity').when(keuring),false);
});
test('keuring requires all four signed-off conclusions',()=>{
  const incomplete={...keuring,conformRookgas:undefined};
  assert.deepEqual(missingRequired(incomplete),['conformRookgas']);
});
test('solid-fuel tradesman does not need a GV/TV recognition number',()=>{
  const solid={...base,techCategory:'Geschoold vakman (vaste brandstof)',techAgrement:''};
  const field=flanders.steps.flatMap(s=>s.fields).find(f=>f.key==='techAgrement');
  assert.equal(field.required,undefined);
  assert.deepEqual(missingRequired(solid),[]);
});
