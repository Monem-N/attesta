import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {brussels} from '../regions/brussels.js';

const opts=JSON.parse(fs.readFileSync(new URL('../assets/br-option-marks.json',import.meta.url),'utf8'));

test('Brussels option marks cover the key wizard enums',()=>{
  for(const key of ['ownerType','techCategory','motif','systemType','collective','condensation','usage','connection']){
    assert.ok(opts[key]&&Object.keys(opts[key]).length,`${key} has no option marks`);
  }
});

test('every marked option is a real wizard option and a valid page',()=>{
  const fields=brussels.steps.flatMap(s=>s.fields);
  for(const [key,values] of Object.entries(opts)){
    const field=fields.find(f=>f.key===key);
    assert.ok(field,`${key} is not a wizard field`);
    for(const value of Object.keys(values)){
      assert.ok(field.options.some(o=>o===value),`${key}=${value} is not a wizard option`);
      const box=values[value];
      assert.equal(box.length,6);
      assert.ok(Number(box[0])>=0&&Number(box[0])<4,`${key}=${value} bad page`);
    }
  }
});
