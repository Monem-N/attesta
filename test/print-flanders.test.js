import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedOption, categoryFor, computeVerdicts, buildFlandersHtml, valueFor, fmtDots} from '../print-flanders.js';

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

test('j12: overall verdict derived from measurements', () => {
  const ok = computeVerdicts({fuel: 'gasvormig', year: '2020', unitOrPulsed: 'air pulsed', netTemp: {i: '150', f: '150'}, efficiency: {i: '91', f: '91'}});
  assert.equal(ok.v_overall, 'OK');
  const bad = computeVerdicts({fuel: 'gasvormig', year: '2020', unitOrPulsed: 'air pulsed', netTemp: {i: '250', f: '250'}});
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

test('fmtDots formats ISO and slash', () => {
  assert.equal(fmtDots('2026-10-15'), '15.10.2026');
  assert.equal(fmtDots('15/10/2026'), '15.10.2026');
});