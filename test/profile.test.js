import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  PROFILE_KEY, emptyProfile, normalizeProfile, loadProfile, saveProfile, clearProfile,
  applyProfileToData, captureProfileFromData, profileFieldError, migrateProfile, PROFILE_VERSION,
} from '../profile.js';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const appSource=fs.readFileSync(path.join(root,'app.js'),'utf8');

function makeStorage(){
  const map=new Map();
  return {
    getItem:key=>map.has(key)?map.get(key):null,
    setItem:(key,value)=>map.set(key,String(value)),
    removeItem:key=>map.delete(key),
    clear:()=>map.clear(),
  };
}
globalThis.localStorage=makeStorage();

test('emptyProfile has identity and empty recognition',()=>{
  assert.deepEqual(emptyProfile(),{v:1,identity:{},recognition:{}});
});

test('applyProfileToData merges identity + only the requested region recognition',()=>{
  const profile={
    v:1,
    identity:{techName:'Jean',company:'ACME',bce:'0123456789',techPhone:'0470',techEmail:'j@acme.be'},
    recognition:{
      wallonia:{techCategory:'Technicien agréé GI',techAgrement:'05431'},
      flanders:{techCategory:'Erkend technicus gasvormige brandstof (GV)',techAgrement:'GV12345'},
      brussels:{techCategory:'Technicien chaudière PEB GI',techAgrement:'GI'},
    },
  };
  const wa=applyProfileToData(profile,'wallonia');
  assert.equal(wa.techName,'Jean');
  assert.equal(wa.techEmail,'j@acme.be');
  assert.equal(wa.techCategory,'Technicien agréé GI');
  assert.equal(wa.techAgrement,'05431');
  const fl=applyProfileToData(profile,'flanders');
  assert.equal(fl.techCategory,'Erkend technicus gasvormige brandstof (GV)');
  assert.equal(fl.techAgrement,'GV12345');
  // Wallonia-only email is still identity, applied everywhere it exists.
  assert.equal(fl.techEmail,'j@acme.be');
});

test('applyProfileToData ignores non-profile keys and other regions',()=>{
  const profile={v:1,identity:{techName:'A',workDuration:'x'},recognition:{wallonia:{techAgrement:'1'}}};
  const data=applyProfileToData(profile,'brussels');
  assert.deepEqual(data,{techName:'A'}); // no workDuration, no wallonia recognition
});

test('applyProfileToData skips empty values and empty profile yields {}',()=>{
  assert.deepEqual(applyProfileToData(emptyProfile(),'wallonia'),{});
  const profile={v:1,identity:{techName:'',company:'ACME'},recognition:{}};
  assert.deepEqual(applyProfileToData(profile,'wallonia'),{company:'ACME'});
});

test('captureProfileFromData overlays identity + current region, preserves others',()=>{
  const existing={
    v:1,
    identity:{techName:'Old',company:'OldCo'},
    recognition:{wallonia:{techAgrement:'W1'},flanders:{techAgrement:'F1'}},
  };
  const data={techName:'New',techAgrement:'F2',workDuration:'8-17',signature:{v:1,typed:'X'},analyzerMake:'Testo',analyzerSerial:'123'};
  const captured=captureProfileFromData(data,'flanders',existing);
  assert.equal(captured.identity.techName,'New');
  assert.equal(captured.identity.company,'OldCo'); // untouched identity preserved
  assert.equal(captured.recognition.flanders.techAgrement,'F2');
  assert.equal(captured.recognition.wallonia.techAgrement,'W1'); // other region preserved
  for(const excluded of ['workDuration','signature','analyzerMake','analyzerSerial'])
    assert.equal(excluded in captured.identity,false);
});

test('captureProfileFromData is immutable (deep clone)',()=>{
  const existing={v:1,identity:{techName:'A'},recognition:{wallonia:{techAgrement:'W'}}};
  const data={techName:'B'};
  const captured=captureProfileFromData(data,'flanders',existing);
  captured.identity.techName='MUT';
  captured.recognition.wallonia.techAgrement='MUT';
  assert.equal(existing.identity.techName,'A');
  assert.equal(existing.recognition.wallonia.techAgrement,'W');
  assert.equal(data.techName,'B');
});

test('captureProfileFromData clears a field set to empty string (hasOwn)',()=>{
  const existing={v:1,identity:{techName:'A',company:'C'},recognition:{}};
  const captured=captureProfileFromData({techName:''},'wallonia',existing);
  assert.ok(!captured.identity.techName); // cleared: empty value dropped from profile
  assert.equal(captured.identity.company,'C'); // untouched identity preserved
});

test('loadProfile falls back to empty on malformed JSON',()=>{
  localStorage.setItem(PROFILE_KEY,'{not json');
  assert.deepEqual(loadProfile(),emptyProfile());
});

test('loadProfile drops poisoned/non-string values without crashing',()=>{
  localStorage.setItem(PROFILE_KEY,JSON.stringify({
    v:1,
    identity:{techName:{evil:true},company:42,bce:null},
    recognition:{wallonia:{techAgrement:['x']}},
  }));
  const profile=loadProfile();
  assert.ok(!('techName' in profile.identity)); // object dropped
  assert.equal(profile.identity.company,'42'); // number coerced
  assert.ok(!('bce' in profile.identity)); // null dropped
  assert.ok(!profile.recognition.wallonia?.techAgrement); // array dropped
});

test('loadProfile keeps an inline-invalid agrement string (shape-only)',()=>{
  localStorage.setItem(PROFILE_KEY,JSON.stringify({
    v:1,identity:{},recognition:{flanders:{techAgrement:'not-a-valid-number'}},
  }));
  assert.equal(loadProfile().recognition.flanders.techAgrement,'not-a-valid-number');
});

test('saveProfile <-> loadProfile roundtrip',()=>{
  const profile={v:1,identity:{techName:'Zoë',bce:'0123456789'},recognition:{brussels:{techCategory:'GI'}}};
  saveProfile(profile);
  assert.deepEqual(loadProfile(),profile);
});

test('clearProfile removes the stored profile',()=>{
  saveProfile({v:1,identity:{techName:'X'},recognition:{}});
  clearProfile();
  assert.deepEqual(loadProfile(),emptyProfile());
});

test('normalizeProfile ignores unknown keys and non-object input',()=>{
  assert.deepEqual(normalizeProfile(null),emptyProfile());
  assert.deepEqual(normalizeProfile([]),emptyProfile());
  const n=normalizeProfile({v:9,identity:{techName:'A',junk:'z'},recognition:{mars:{techAgrement:'x'}}});
  assert.equal(n.v,1);
  assert.deepEqual(n.identity,{techName:'A'});
  assert.deepEqual(n.recognition,{});
});

// Source-level guard: prefill is wired into the new-attestation, popstate and
// deep-link fallback paths, and NOT into the resume-draft path.
test('app.js centralizes prefill in prefillFor and uses it at all three sites',()=>{
  assert.match(appSource,/function prefillFor\(region\)/);
  assert.match(appSource,/const \{data,applied\}=prefillFor\(requested\)/);
  assert.match(appSource,/const \{data,applied\}=prefillFor\(b\.dataset\.region\)/);
  assert.match(appSource,/const prefill=changingRegion\?prefillFor\(region\):null/);
  // Deep-link derives the chip flag from the FINAL draft (deep-link bug fix).
  assert.match(appSource,/profileApplied=s\.profileApplied===true/);
  // Resume path must keep an empty data object (no profile prefill).
  assert.ok(appSource.includes("readRegionDraft(b.dataset.resume)||{region:b.dataset.resume,step:0,data:{},status:'Draft'}"));
});

test('app.js drops stale categories on editor open and at every prefill site',()=>{
  // Editor open sanitizes the draft (non-destructive; persisted only on Save).
  assert.match(appSource,/profileDraft=sanitizeProfileCategories\(loadProfile\(\)\)/);
  // Helper is region-aware and defined in app.js (not in region-agnostic profile.js).
  assert.match(appSource,/function sanitizeProfileCategories\(profile\)/);
  const profileSource=fs.readFileSync(path.join(root,'profile.js'),'utf8');
  assert.ok(!/from\s*'\.\/regions\//.test(profileSource)); // profile.js stays region-agnostic
});

test('app.js confirms before clearing the profile',()=>{
  assert.match(appSource,/window\.confirm\(tr\(\)\.confirmClearProfile\)/);
});

test('app.js surfaces profileFieldError in the editor',()=>{
  assert.match(appSource,/import\s*\{[^}]*profileFieldError[^}]*\}\s*from\s*'\.\/profile\.js'/);
  assert.match(appSource,/error=profileFieldError\(profileDraft,scope,region,key,value\)/);
});

test('profileFieldError: empty values are allowed (partial profile)',()=>{
  const p=emptyProfile();
  assert.equal(profileFieldError(p,'identity',null,'bce',''),null);
  assert.equal(profileFieldError(p,'identity',null,'techEmail','   '),null);
  assert.equal(profileFieldError(p,'recognition','flanders','techAgrement',''),null);
});

test('profileFieldError: BCE and email identity checks',()=>{
  const p=emptyProfile();
  assert.equal(profileFieldError(p,'identity',null,'bce','0123456789'),null);
  assert.equal(profileFieldError(p,'identity',null,'bce','123'),'invalid');
  assert.equal(profileFieldError(p,'identity',null,'techEmail','j@acme.be'),null);
  assert.equal(profileFieldError(p,'identity',null,'techEmail','nope'),'invalid');
  // Non-validated identity fields never error.
  assert.equal(profileFieldError(p,'identity',null,'techName','Any Name'),null);
});

test('profileFieldError: recognition number checked against the chosen category',()=>{
  // Flanders GV category + valid GV number.
  const fl={v:1,identity:{},recognition:{flanders:{techCategory:'Erkend technicus gasvormige brandstof (GV)'}}};
  assert.equal(profileFieldError(fl,'recognition','flanders','techAgrement','GV12345'),null);
  assert.equal(profileFieldError(fl,'recognition','flanders','techAgrement','12345'),'invalid');
  // No category chosen yet -> no pattern -> no error.
  const none={v:1,identity:{},recognition:{flanders:{}}};
  assert.equal(profileFieldError(none,'recognition','flanders','techAgrement','whatever'),null);
  // Wallonia agréé category requires a numeric agrement.
  const wa={v:1,identity:{},recognition:{wallonia:{techCategory:'Technicien agréé GI'}}};
  assert.equal(profileFieldError(wa,'recognition','wallonia','techAgrement','05431'),null);
  assert.equal(profileFieldError(wa,'recognition','wallonia','techAgrement','GI-ABC'),'invalid');
});

test('updatedAt survives normalize and roundtrip; non-string dropped',()=>{
  const withDate={v:1,identity:{techName:'A'},recognition:{},updatedAt:'2026-09-12T10:00:00.000Z'};
  assert.equal(normalizeProfile(withDate).updatedAt,'2026-09-12T10:00:00.000Z');
  assert.equal(normalizeProfile({...withDate,updatedAt:123}).updatedAt,undefined);
  saveProfile(withDate);
  assert.equal(loadProfile().updatedAt,'2026-09-12T10:00:00.000Z');
});

test('captureProfileFromData preserves existing updatedAt',()=>{
  const existing={v:1,identity:{techName:'A'},recognition:{},updatedAt:'2026-01-01T00:00:00.000Z'};
  const captured=captureProfileFromData({techName:'B'},'wallonia',existing);
  assert.equal(captured.updatedAt,'2026-01-01T00:00:00.000Z');
});

test('app.js sets updatedAt at the call sites (not inside saveProfile)',()=>{
  // Editor save stamps updatedAt on the object passed to saveProfile.
  assert.match(appSource,/saveProfile\(\{\.\.\.profileDraft,updatedAt:new Date\(\)\.toISOString\(\)\}\)/);
  // Save-to-profile shortcut stamps captured.updatedAt before saving.
  assert.match(appSource,/captured\.updatedAt=new Date\(\)\.toISOString\(\)/);
});

test('app.js purge clears profile, drafts, acks and attachment bytes',()=>{
  assert.match(appSource,/await clearAttachmentBytes\(null\)/);
  assert.match(appSource,/localStorage\.removeItem\(KEY\)/);
  assert.match(appSource,/acks=\{\}; saveAcks\(\)/);
});

test('app.js persists UI language only on explicit setLang (not in save)',()=>{
  assert.match(appSource,/localStorage\.setItem\(UI_KEY,lang\)/);
  assert.ok(!/setItem\(UI_KEY,state\.lang\)/.test(appSource),'save() must not clobber the UI lang');
  assert.match(appSource,/readUiLang\(\)/);
});

test('app.js gates the chip on a transient profileApplied flag',()=>{
  assert.match(appSource,/let profileApplied = false/);
  assert.match(appSource,/if\(profileApplied\)/);
  assert.match(appSource,/profileApplied=applied/); // set from prefillFor(...).applied
  assert.match(appSource,/profileApplied=state\.profileApplied/); // popstate mirrors the draft
  assert.match(appSource,/profileApplied=false/); // cleared on resume / region-null
  assert.match(appSource,/profile-chip/);
  assert.match(appSource,/t\.profileApplied/);
});

test('editor completeness uses recognitionRequired for the agrement check',()=>{
  assert.match(appSource,/needAgrement=recognitionRequired\(region,\{techCategory:bucket\.techCategory\}\)/);
});

test('migrateProfile stamps the current version and drops unknown keys',()=>{
  assert.deepEqual(migrateProfile(null),emptyProfile());
  assert.deepEqual(migrateProfile([]),emptyProfile());
  const m=migrateProfile({identity:{techName:'A',junk:'x'},recognition:{},updatedAt:'2026-01-01T00:00:00.000Z'});
  assert.equal(m.v,1);
  assert.deepEqual(m.identity,{techName:'A'});
  assert.equal(m.updatedAt,'2026-01-01T00:00:00.000Z');
});

test('migrateProfile upgrades a missing/older version without data loss',()=>{
  const legacy={identity:{techName:'Legacy',company:'Co'},recognition:{wallonia:{techAgrement:'05431'}}};
  const m=migrateProfile(legacy);
  assert.equal(m.v,1);
  assert.equal(m.identity.techName,'Legacy');
  assert.equal(m.recognition.wallonia.techAgrement,'05431');
});

test('app.js routes draft reads through migrateDraft',()=>{
  assert.match(appSource,/function migrateDraft\(raw\)/);
  assert.match(appSource,/s=migrateDraft\(JSON\.parse\(localStorage\.getItem\(KEY\)\)\)/);
  assert.ok(appSource.includes('const saved=migrateDraft(JSON.parse(localStorage.getItem(`${KEY}.${region}`)))'));
});

test('app.js wires profile export and import in the editor',()=>{
  assert.match(appSource,/download\(blob,'attesta-profile\.json'\)/);
  assert.match(appSource,/profileDraft=sanitizeProfileCategories\(migrateProfile\(parsed\)\)/);
  assert.match(appSource,/profileImportFile/);
});

test('app.js persists the prefill flag in drafts and restores it on load',()=>{
  assert.match(appSource,/profileApplied=s\.profileApplied===true/); // load restores from the final draft
  assert.match(appSource,/profileApplied=state\.profileApplied/); // popstate mirrors the draft
  assert.match(appSource,/profileApplied:applied/); // new-attestation persists it into the draft
});

test('update prompt is dismissible, in-flow, and reloads only on explicit click',()=>{
  assert.match(appSource,/document\.querySelector\('\.head'\)\.appendChild\(bar\)/);
  assert.match(appSource,/\$\('updateLater'\)\.onclick=\(\)=>bar\.remove\(\)/);
  const click=appSource.indexOf("$('updateReload').onclick");
  const listener=appSource.indexOf("addEventListener('controllerchange'");
  assert.ok(click>=0&&listener>click,'controllerchange listener must be registered on click');
});

test('purge syncs the URL after resetting to home',()=>{
  assert.match(appSource,/flashSaveStatus\(tr\(\)\.profileCleared\);\s*syncURL\(\);\s*render\(\);/);
});