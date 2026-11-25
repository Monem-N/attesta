import test from 'node:test';
import assert from 'node:assert/strict';
import {wallonia} from '../regions/wallonia.js';
import {selectedOption} from '../print-wallonia.js';

const categories = ['Technicien agréé L','Technicien agréé GI','Technicien agréé GII',
  'Technicien spécialisé en combustibles solides'];

test('AWAC category list matches the official model', () => {
  const field = wallonia.steps.flatMap(s=>s.fields).find(f=>f.key==='techCategory');
  assert.deepEqual(field.options, categories);
});

test('agrément accepts bare digits and an optional spaced/hyphenated prefix', () => {
  const ok = v => wallonia.recognition.some(r=>r.test(v));
  for (const v of ['05431','12345','1234567','L 12345','GI-12345','GII05431','GII 05431'])
    assert.ok(ok(v), `${v} should be accepted`);
  for (const v of ['abc','L','GI-','12345678','X12345','L/GI 12345'])
    assert.ok(!ok(v), `${v} should be rejected`);
});

test('each category ticks exactly one exclusive box', () => {
  assert.equal(selectedOption('techCategory','Technicien agréé L'),'l');
  assert.equal(selectedOption('techCategory','Technicien agréé GI'),'gi');
  assert.equal(selectedOption('techCategory','Technicien agréé GII'),'gii');
  assert.equal(selectedOption('techCategory','Technicien spécialisé en combustibles solides'),'solide');
});
