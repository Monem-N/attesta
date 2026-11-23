import test from 'node:test';
import assert from 'node:assert/strict';
import {formatScalar, formatValue, wrapText, fieldWidth, boundsWarnings, emptyAudit} from '../regions/pdf-render.js';

test('ISO dates are converted to the official DD/MM/YYYY form',()=>{
  assert.equal(formatScalar('2026-11-23','flanders'),'23/11/2026');
  assert.equal(formatValue('2026-11-23','brussels'),'23/11/2026');
  assert.equal(formatScalar('not a date','wallonia'),'not a date');
});

test('booleans use region wording',()=>{
  assert.equal(formatScalar(true,'flanders'),'Ja');
  assert.equal(formatScalar(false,'wallonia'),'NON');
});

test('wrapText wraps and reports clipping instead of truncating silently',()=>{
  const measure=s=>s.length*5;
  const wrapped=wrapText('Gebreken die niet door de onderhoudsbeurt kunnen worden weggewerkt',measure,40,3);
  assert.ok(wrapped.lines.length>1);
  assert.ok(wrapped.lines.every(l=>measure(l)<=40));
  assert.equal(wrapped.clipped,true);
  assert.ok(wrapped.lines.at(-1).endsWith('…'));
});

test('fieldWidth respects page bounds',()=>{
  assert.ok(fieldWidth('defects',595,500)<=595-500-24+0.01);
  assert.ok(fieldWidth('clientName',595,50)>150);
});

test('boundsWarnings flags off-page placements',()=>{
  assert.equal(boundsWarnings(595,842,50,100,100,20).length,0);
  assert.ok(boundsWarnings(595,842,560,100,100,20).some(x=>x.includes('horizontal')));
  assert.ok(boundsWarnings(595,842,50,830,100,20).some(x=>x.includes('vertical')));
});

test('audit starts empty',()=>{
  const a=emptyAudit();
  assert.deepEqual(a.printed,[]);
  assert.deepEqual(a.warnings,[]);
});
