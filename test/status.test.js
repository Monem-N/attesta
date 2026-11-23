import test from 'node:test';
import assert from 'node:assert/strict';
import {STATUSES,isComplete,isSubmitted,statusOnIssue,statusOnHandoff,statusText} from '../status.js';

test('draft is not complete; every other state is',()=>{
  assert.equal(isComplete('Draft'),false);
  for(const s of STATUSES.filter(s=>s!=='Draft')) assert.equal(isComplete(s),true,`${s} should be complete`);
});

test('only an explicit user action yields Submitted',()=>{
  assert.equal(isSubmitted('Submitted'),true);
  assert.equal(isSubmitted('Registered'),false);
  assert.equal(isSubmitted('Issued'),false);
});

test('a PDF download does not mean submitted or verified',()=>{
  assert.equal(statusOnIssue('flanders'),'Registered');
  assert.equal(statusOnIssue('wallonia'),'Issued');
  assert.equal(statusOnIssue('brussels'),'Issued');
  assert.equal(statusOnHandoff('brussels'),'Prepared');
});

test('status labels exist for all states',()=>{
  const t={statusDraft:'Draft',statusPrepared:'Prepared',statusIssued:'Issued',
    statusRegistered:'Registered',statusSubmitted:'Submitted'};
  for(const s of STATUSES) assert.equal(statusText(s,t),t[`status${s[0].toUpperCase()}${s.slice(1)}`]);
});
