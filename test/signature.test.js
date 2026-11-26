// test/signature.test.js — node --test (aucune dépendance, aucun DOM requis)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DATA_VERSION, emptyData, normalizeData, decimatePoints, containFit,
  strokeLength, totalInkLength, isSignatureEmpty, undoStroke,
  applySignatureToDocument,
} from '../signature.js';
import {validateField} from '../input-validation.js';

const line = (n, dx = 0.01) => ({
  points: Array.from({ length: n }, (_, i) => [i * dx, 0.5, 0.5]),
});

test('round-trip JSON : toData → stockage → fromData (via normalizeData)', () => {
  const data = { v: DATA_VERSION, typed: '', strokes: [line(20), { points: [[0.2, 0.2, 1], [0.8, 0.8, 0.1]] }] };
  const restored = normalizeData(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(restored, data);
});

test('round-trip typed : le nom tapé survit à la normalisation', () => {
  const data = { v: DATA_VERSION, typed: 'Jean Dupont', strokes: [] };
  assert.deepEqual(normalizeData(JSON.parse(JSON.stringify(data))), data);
  assert.equal(isSignatureEmpty(data), false);
  assert.equal(isSignatureEmpty({ v: 1, typed: '   ' }), true);
});

test('normalizeData : données corrompues tolérées, coordonnées/pression bornées', () => {
  assert.deepEqual(normalizeData(null), emptyData());
  assert.deepEqual(normalizeData({ strokes: 'x' }), emptyData());
  const dirty = { v: 1, strokes: [
    { points: [[NaN, 0, 0.5], [0.1, 0.1, 5], [2, -1, 0.5], 'x', [0.3, 0.3]] },
    null, { points: [] },
  ] };
  assert.deepEqual(normalizeData(dirty), { v: 1, typed: '', strokes: [
    { points: [[0.1, 0.1, 1], [1, 0, 0.5], [0.3, 0.3, 0.5]] },
  ] });
});

test('normalizeData : les objets JSON hostiles ne peuvent pas faire échouer la coercition', () => {
  const poison = JSON.parse('{"toString":null,"valueOf":null}');
  const dirty = { v: 1, strokes: [
    { points: [[poison, 0.2, 0.5], [0.4, 0.4, poison], [0.6, 0.6]] },
  ] };
  assert.deepEqual(normalizeData(dirty), { v: 1, typed: '', strokes: [
    { points: [[0.4, 0.4, 0.5], [0.6, 0.6, 0.5]] },
  ] });
});

test('typed names ignore invisible formatting characters', () => {
  const invisible = { v: 1, typed: '\u200B \uFEFF\u2060' };
  assert.deepEqual(normalizeData(invisible), emptyData());
  assert.equal(isSignatureEmpty(invisible), true);
  assert.equal(validateField({ key: 'signature', type: 'signature', required: true }, invisible), 'required');
  assert.equal(normalizeData({ v: 1, typed: '  Jean\u200B Dupont ' }).typed, 'Jean Dupont');
});

test('applySignatureToDocument : une signature tapée ne s’affiche pas deux fois', () => {
  const png = 'data:image/png;base64,AAAA';
  const makeDoc = () => {
    const img = { hidden: true, src: '' };
    const span = { hidden: false, textContent: 'ancien nom' };
    return {
      img, span,
      doc: { querySelectorAll: (sel) => sel === '.sigimg' ? [img] : sel === '.sigtyped' ? [span] : [] },
    };
  };
  const withImage = makeDoc();
  applySignatureToDocument(withImage.doc, { url: png, typed: 'Jean Dupont' });
  assert.equal(withImage.img.hidden, false);
  assert.equal(withImage.img.src, png);
  assert.equal(withImage.span.hidden, true);
  const fallback = makeDoc();
  applySignatureToDocument(fallback.doc, { url: null, typed: 'Jean Dupont' });
  assert.equal(fallback.img.hidden, true);
  assert.equal(fallback.span.hidden, false);
  assert.equal(fallback.span.textContent, 'Jean Dupont');
});

test('isEmpty : vide, tap isolé, vrai tracé, seuil configurable', () => {
  assert.equal(isSignatureEmpty(emptyData()), true);
  assert.equal(isSignatureEmpty({ v: 1, strokes: [{ points: [[0.5, 0.5, 0.5]] }] }), true);
  assert.equal(isSignatureEmpty({ v: 1, strokes: [{ points: [[0.5, 0.5, 0.5], [0.501, 0.5, 0.5]] }] }), true);
  assert.equal(isSignatureEmpty({ v: 1, strokes: [line(30)] }), false);
  assert.equal(isSignatureEmpty({ v: 1, strokes: [line(30)] }, 1), true);
});

test("undo : retire le dernier trait sans muter l'original", () => {
  const data = { v: 1, strokes: [line(5), line(8)] };
  const after = undoStroke(data);
  assert.equal(after.strokes.length, 1);
  assert.equal(data.strokes.length, 2);
  assert.equal(after.strokes[0], data.strokes[0]);
  assert.deepEqual(undoStroke(emptyData()), emptyData());
});

test('décimation : extrémités conservées, seuil de distance respecté', () => {
  const dense = Array.from({ length: 500 }, (_, i) => [i * 0.0001, 0.5, 0.5]);
  const kept = decimatePoints(dense, 0.002);
  assert.ok(kept.length < dense.length / 10);
  assert.deepEqual(kept[0], dense[0]);
  assert.deepEqual(kept[kept.length - 1], dense[dense.length - 1]);
  for (let i = 1; i < kept.length - 1; i++) {
    assert.ok(Math.hypot(kept[i][0] - kept[i - 1][0], kept[i][1] - kept[i - 1][1]) >= 0.002);
  }
  const two = [[0, 0, 0.5], [1, 1, 0.5]];
  assert.deepEqual(decimatePoints(two), two);
});

test('longueurs : géométrie connue + somme des traits', () => {
  assert.ok(Math.abs(strokeLength([[0, 0, 0.5], [0.3, 0.4, 0.5]]) - 0.5) < 1e-9);
  const data = { v: 1, strokes: [line(11), line(11)] }; // 0.1 + 0.1
  assert.ok(Math.abs(totalInkLength(data) - 0.2) < 1e-9);
});

test('containFit : tient dans la boîte, centré, sans déformation', () => {
  const box = { x: 10, y: 20, w: 180, h: 40 };
  const fit = containFit(box, 600, 200); // ratio 3:1 → limité par la hauteur (40/200)
  assert.equal(fit.height, 40);
  assert.equal(fit.width, 120);
  assert.equal(fit.x, 40); // 10 + (180-120)/2
  assert.equal(fit.y, 20);
  assert.ok(fit.x >= box.x - 1e-9 && fit.x + fit.width <= box.x + box.w + 1e-9);
  assert.ok(fit.y >= box.y - 1e-9 && fit.y + fit.height <= box.y + box.h + 1e-9);
  const wide = containFit(box, 200, 600); // ratio 1:3 → limité par la hauteur
  assert.equal(wide.height, 40);
  assert.ok(Math.abs(wide.width - (200 * 40) / 600) < 1e-9);
});

test('required : signature vide (strokes ou tapé) bloquante, tracé ou nom acceptés', () => {
  const field = { key: 'signature', type: 'signature', required: true };
  assert.equal(validateField(field, undefined), 'required');
  assert.equal(validateField(field, { v: 1, strokes: [] }), 'required');
  assert.equal(validateField(field, { v: 1, typed: '   ' }), 'required');
  assert.equal(validateField(field, { v: 1, strokes: [{ points: [[0.5, 0.5, 0.5]] }] }), 'required');
  assert.equal(validateField(field, { v: 1, strokes: [line(30)] }), null);
  assert.equal(validateField(field, { v: 1, typed: 'Jean Dupont' }), null);
  assert.equal(validateField({ key: 'signature', type: 'signature' }, undefined), null);
});