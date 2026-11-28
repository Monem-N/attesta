import test from 'node:test';
import assert from 'node:assert/strict';
import {T} from '../i18n.js';

const isPlainObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);

// Compare key structure of two translation trees. Recurse into plain objects
// (e.g. docs), require functions to stay functions, and skip array contents
// (glossary) — only presence is checked for arrays.
function keyParity(fr,nl,path){
  const fk=Object.keys(fr), nk=Object.keys(nl);
  const missingNl=fk.filter(k=>!nk.includes(k));
  const missingFr=nk.filter(k=>!fk.includes(k));
  assert.deepEqual(missingNl,[],`missing in nl at ${path}: ${missingNl.join(',')}`);
  assert.deepEqual(missingFr,[],`missing in fr at ${path}: ${missingFr.join(',')}`);
  for(const key of fk){
    const a=fr[key], b=nl[key], at=`${path}.${key}`;
    if(typeof a==='function'||typeof b==='function'){
      assert.equal(typeof a,'function',`${at} fr should be a function`);
      assert.equal(typeof b,'function',`${at} nl should be a function`);
      continue;
    }
    if(Array.isArray(a)||Array.isArray(b)){
      assert.ok(Array.isArray(a)&&Array.isArray(b),`${at} array mismatch`);
      continue;
    }
    if(isPlainObject(a)&&isPlainObject(b)){ keyParity(a,b,at); continue; }
    assert.ok(a!=null&&b!=null,`${at} missing leaf value`);
  }
}

test('T.fr and T.nl share identical key structure',()=>{
  assert.ok(T.fr&&T.nl,'both language dictionaries exist');
  keyParity(T.fr,T.nl,'T');
});

test('profile editor keys exist in both languages',()=>{
  const required=['openProfile','profileTitle','profileHint','saveProfile','profileSaved',
    'profileCleared','profileIdentity','clearProfile','profileBack','confirmClearProfile',
    'profileApplied','updatedOn','profileIncomplete','purgeAll','confirmPurge',
    'updateAvailable','reload','later','exportProfile','importProfile','importOk','importInvalid'];
  for(const key of required){
    assert.ok(key in T.fr,`fr missing ${key}`);
    assert.ok(key in T.nl,`nl missing ${key}`);
  }
});