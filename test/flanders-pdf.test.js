import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FL_MAPS, BOX_SELECT, anchorOf, isPaired, explicitBoxes, flTextValue} from '../regions/flanders-pdf.js';
import {flanders} from '../regions/flanders.js';

const rects=JSON.parse(readFileSync(new URL('../assets/checkbox-rects.json',import.meta.url),'utf8'));
const center=b=>[(b[0]+b[2])/2,(b[1]+b[3])/2];

test('each Flanders model has its own coordinate map',()=>{
  assert.deepEqual(Object.keys(FL_MAPS).sort(),['fl-keuring','fl-reiniging','fl-verbranding']);
  assert.notDeepEqual(FL_MAPS['fl-keuring'].make,FL_MAPS['fl-verbranding'].make);
  assert.notDeepEqual(FL_MAPS['fl-reiniging'].controlDate,FL_MAPS['fl-verbranding'].controlDate);
});

test('every explicit box selection is present in its model map',()=>{
  for(const [model,table] of Object.entries(BOX_SELECT)){
    for(const key of Object.keys(table)){
      assert.ok(FL_MAPS[model] && key in FL_MAPS[model],`${model}: ${key} has boxes but no map entry`);
    }
  }
});

test('no two single fields share an anchor within a map',()=>{
  for(const [model,map] of Object.entries(FL_MAPS)){
    const seen=new Map();
    for(const [key,anchor] of Object.entries(map)){
      if(typeof anchor==='function'||anchor.length===4) continue;
      const k=anchor.join(',');
      assert.equal(seen.get(k),undefined,`${model}: ${key} collides with ${seen.get(k)}`);
      seen.set(k,key);
    }
  }
});

test('Eindbeoordeling ticks the four printed boxes by value',()=>{
  const list=rects['fl-verbranding']['0'];
  const sel=BOX_SELECT['fl-verbranding'].conformity;
  assert.deepEqual(sel['goed en veilig'],[[137.45,687.25],[208.3,687.25]]);
  assert.deepEqual(sel['niet goed'],[[137.45,696.95]]);
  assert.deepEqual(sel['niet veilig'],[[208.3,696.95]]);
  for(const [value,expected] of Object.entries(sel)){
    const boxes=explicitBoxes('fl-verbranding','conformity',value,list);
    assert.ok(boxes,`no boxes for ${value}`);
    assert.deepEqual(boxes.map(center),expected);
  }
});

test('keuring final assessment uses the four correct box rows',()=>{
  const list=rects['fl-keuring']['0'];
  const expected=[
    ['conformStooktoestel',[[246.05,576.8],[294.7,576.8]]],
    ['conformRookgas',[[246.05,586.65],[294.7,586.65]]],
    ['conformStookplaats',[[246.05,596.4],[294.7,596.4]]],
    ['conformVerbranding',[[246.05,606.1],[294.7,606.1]]],
  ];
  for(const [key,centers] of expected){
    const ok=explicitBoxes('fl-keuring',key,'OK',list);
    const no=explicitBoxes('fl-keuring',key,'Niet OK',list);
    assert.equal(ok.length,1); assert.equal(no.length,1);
    for(const [actual,want] of [[center(ok[0]),centers[0]],[center(no[0]),centers[1]]]){
      assert.ok(Math.abs(actual[0]-want[0])<0.01 && Math.abs(actual[1]-want[1])<0.01,
        `${key}: got ${actual}, expected ${want}`);
    }
  }
});

test('anchor functions and paired measurements resolve correctly',()=>{
  const a=FL_MAPS['fl-verbranding'].techAgrement;
  assert.equal(anchorOf(a,{techCategory:'Erkend technicus vloeibare brandstof (TV)'})[1],478);
  assert.equal(anchorOf(a,{techCategory:'Erkend technicus gasvormige brandstof (GV)'})[1],380);
  assert.equal(isPaired(FL_MAPS['fl-verbranding'].o2,{i:'3.2',f:'4.1'}),true);
  assert.equal(isPaired(FL_MAPS['fl-verbranding'].make,'Bosch'),false);
});

test('Flanders PDF helpers tolerate malformed persisted scalars',()=>{
  const poison={toString:null};
  assert.doesNotThrow(()=>anchorOf(FL_MAPS['fl-verbranding'].techAgrement,{techCategory:poison}));
  assert.equal(explicitBoxes('fl-verbranding','fuel',poison,rects['fl-verbranding']['0']),null);
  assert.equal(flTextValue('techCategory',poison),'');
});

test('long recognition labels are shortened for the printed line',()=>{
  assert.equal(flTextValue('techCategory','Erkend technicus gasvormige brandstof (GV)'),'GV');
  assert.equal(flTextValue('techCategory','Erkend technicus vloeibare brandstof (TV)'),'TV');
  assert.equal(flTextValue('techCategory','Erkend verwarmingsaannemer (VA+)'),'VA+');
  assert.equal(flTextValue('techAgrement','GV12345'),'12345');
  assert.equal(flTextValue('clientName','Marie Peeters'),'Marie Peeters');
});

test('keuring-only fields are gated on the document choice',()=>{
  const all=flanders.steps.flatMap(s=>s.fields);
  const keuring=all.find(f=>f.key==='conformStooktoestel');
  const base=all.find(f=>f.key==='conformity');
  assert.equal(keuring.when({document:'Keuringsrapport + verbrandingsattest'}),true);
  assert.equal(keuring.when({document:'Verbrandingsattest + reinigingsattest'}),false);
  assert.equal(base.when({document:'Verbrandingsattest + reinigingsattest'}),true);
  assert.equal(base.when({document:'Keuringsrapport + verbrandingsattest'}),false);
});

test('Flanders legal deadlines and recognition patterns are present',()=>{
  assert.equal(flanders.rules.registrationDeadline('2026-01-31').getDate(),28);
  assert.equal(flanders.rules.remedy('2026-01-31').getMonth(),3);
  assert.ok(flanders.recognition.some(r=>r.test('VA+12345')));
  assert.ok(flanders.recognition.some(r=>r.test('GV12345')));
});
