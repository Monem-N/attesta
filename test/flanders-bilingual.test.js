import test from 'node:test';
import assert from 'node:assert/strict';
import {flanders, B, O} from '../regions/flanders.js';
import {buildFlandersHtml} from '../print-flanders.js';

const isB = v => v && typeof v === 'object' && !Array.isArray(v) && ('nl' in v || 'fr' in v);
const fields = flanders.steps.flatMap(s => s.fields);

function bilingualStrings() {
  const out = [];
  for (const step of flanders.steps) {
    out.push(['step.title', step.title], ['step.hint', step.hint]);
    for (const f of step.fields) {
      out.push([`${f.key}.label`, f.label], [`${f.key}.hint`, f.hint]);
      for (const [i, o] of (f.options || []).entries()) {
        out.push([`${f.key}.option${i}`, o.l]);
      }
    }
  }
  return out.filter(([, v]) => v !== undefined);
}

test('every Flanders visible string has nl and fr translations', () => {
  const pairs = bilingualStrings();
  assert.ok(pairs.length > 60, `expected a broad translation surface, got ${pairs.length}`);
  for (const [where, v] of pairs) {
    assert.ok(isB(v), `${where} is not bilingual`);
    assert.ok(typeof v.nl === 'string' && v.nl.trim(), `${where} missing nl`);
    assert.ok(typeof v.fr === 'string' && v.fr.trim(), `${where} missing fr`);
  }
});

test('canonical option values are unchanged Dutch strings', () => {
  const values = Object.fromEntries(fields.filter(f => f.options).map(f => [f.key, f.options.map(o => o.v)]));
  assert.deepEqual(values.document, [
    'Verbrandingsattest + reinigingsattest',
    'Keuringsrapport + verbrandingsattest',
  ]);
  assert.deepEqual(values.fuel, ['Gasvormig', 'Vloeibaar', 'Vast']);
  assert.deepEqual(values.techCategory, [
    'Erkend technicus gasvormige brandstof (GV)',
    'Erkend technicus vloeibare brandstof (TV)',
    'Erkend verwarmingsaannemer (VA+)',
    'Geschoold vakman (vaste brandstof)',
  ]);
  assert.deepEqual(values.conformity, ['Goed en veilig', 'Niet goed', 'Niet veilig']);
  assert.deepEqual(values.conformStooktoestel, ['OK', 'Niet OK']);
  assert.deepEqual(values.intervention[0], 'Periodiek onderhoud');
});

test('rules still resolve on canonical values regardless of UI language', () => {
  const doc = flanders.steps[0].fields.find(f => f.key === 'document');
  assert.ok(/Keuringsrapport/i.test(doc.options[1].v));
  assert.ok(!/Keuringsrapport/i.test(doc.options[0].v));
  assert.ok(/gas/i.test(flanders.steps[3].fields.find(f => f.key === 'fuel').options[0].v));
  assert.match(flanders.recognition[0].source, /GV/);
  const due = flanders.rules.nextDue('2026-01-31', {fuel: 'Gasvormig', powerKw: '80'});
  assert.equal(due.years, 2);
});

test('the Flanders region label translates but keeps a Dutch canonical name', () => {
  assert.equal(flanders.label.nl, 'Vlaanderen');
  assert.equal(flanders.label.fr, 'Flandre');
});

test('print data is independent of the wizard UI language', () => {
  const data = {
    controlDate: '2026-01-31', fuel: 'Gasvormig', year: '2020',
    unitOrPulsed: 'air pulsed', powerKw: '80',
    techCategory: 'Erkend technicus gasvormige brandstof (GV)',
    conformity: 'Goed en veilig', co2: {i: '10', f: '10'},
  };
  const nl = buildFlandersHtml({region: 'flanders', lang: 'nl', data});
  const fr = buildFlandersHtml({region: 'flanders', lang: 'fr', data});
  assert.deepEqual(fr, nl);
});

test('bilingual helpers reject malformed pairs', () => {
  assert.equal(B('a', 'b').fr, 'b');
  assert.equal(O('v', 'nl', 'fr').v, 'v');
  assert.ok(!isB('plain string'));
});
