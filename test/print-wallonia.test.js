import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedOption,valueFor,fmtDots,buildWalloniaHtml} from '../print-wallonia.js';

test('exclusive option resolution: GII does not tick GI/L',()=>{
  assert.equal(selectedOption('techCategory','Technicien agréé GII'),'gii');
  assert.equal(selectedOption('techCategory','Technicien agréé GI'),'gi');
  assert.equal(selectedOption('techCategory','Technicien spécialisé en combustibles solides'),'solide');
  assert.equal(selectedOption('techCategory','Erkend technicus vloeibare brandstof (TV)'),null);
});

test('non conforme does not tick conforme; production + ECS wins',()=>{
  assert.equal(selectedOption('orifices','Présent et non conforme'),'non conforme');
  assert.equal(selectedOption('orifices','Présent et conforme'),'conforme');
  assert.equal(selectedOption('production','Chauffage + ECS'),'chauffage+ecs');
  assert.equal(selectedOption('production','Eau chaude sanitaire'),'ecs');
  assert.equal(selectedOption('production','Chauffage des locaux'),'chauffage');
});

test('anchored fuel/burner options resolve exactly',()=>{
  assert.equal(selectedOption('fuelDetail','Gaz nat. G20'),'g20');
  assert.equal(selectedOption('fuelDetail','Gaz nat.G25'),'g25');
  assert.equal(selectedOption('fuelDetail','Gasoil extra'),'gasoil extra');
  assert.equal(selectedOption('burnerType','modulant'),'modulant');
  assert.equal(selectedOption('unitOrPulsed','air pulsé'),'air pulsé');
  assert.equal(selectedOption('premix','non-premix'),'non-premix');
  assert.equal(selectedOption('raccordement','B'),'b');
});

test('Wallonia print tolerates malformed persisted scalars',()=>{
  const poison={toString:null};
  assert.equal(selectedOption('fuelDetail',poison),null);
  assert.doesNotThrow(()=>buildWalloniaHtml({region:'wallonia',data:{fuel:poison,fuelDetail:poison,unitOrPulsed:poison,premix:poison}}));
});

test('date formatting accepts both ISO and slash',()=>{
  assert.equal(fmtDots('2026-10-15'),'15.10.2026');
  assert.equal(fmtDots('15/10/2029'),'15.10.2029');
});

test('injected values use formatted dates and fall back to legacy address',()=>{
  const d={controlDate:'2026-10-15',nextFrom:'15/10/2029',clientStreet:'Rue de la Gare 12'};
  assert.equal(valueFor(d,'controlDate'),'15.10.2026');
  assert.equal(valueFor(d,'nextFrom'),'15.10.2029');
  assert.equal(valueFor(d,'clientStreet'),'Rue de la Gare 12');
});
