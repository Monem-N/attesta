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

test('agrément is a numeric registration number, never a category prefix', () => {
  assert.ok(wallonia.recognition.some(r=>r.test('05431')));
  assert.ok(wallonia.recognition.some(r=>r.test('1234567')));
  assert.ok(!wallonia.recognition.some(r=>r.test('GII05431')));
  assert.ok(!wallonia.recognition.some(r=>r.test('L05431')));
  assert.ok(!wallonia.recognition.some(r=>r.test('GI05431')));
  assert.ok(!wallonia.recognition.some(r=>r.test('abc')));
});

test('each category ticks exactly one exclusive box', () => {
  assert.equal(selectedOption('techCategory','Technicien agréé L'),'l');
  assert.equal(selectedOption('techCategory','Technicien agréé GI'),'gi');
  assert.equal(selectedOption('techCategory','Technicien agréé GII'),'gii');
  assert.equal(selectedOption('techCategory','Technicien spécialisé en combustibles solides'),'solide');
});
