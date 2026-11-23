import test from 'node:test';
import assert from 'node:assert/strict';
import {toPdfY, PORTRAIT} from '../regions/pdf-render.js';
import {loadAttachmentBytes,saveAttachmentBytes,clearAttachmentBytes} from '../attachments.js';

test('top-left anchors convert against the real page height',()=>{
  assert.equal(toPdfY(PORTRAIT.h,100),PORTRAIT.h-100);
  // Landscape combustion annex: 842x595. A fixed 842 conversion would be off by 247pt.
  const landscapeH=595.32;
  assert.ok(Math.abs(toPdfY(landscapeH,100)-495.32)<1e-9);
  assert.notEqual(toPdfY(landscapeH,100),toPdfY(PORTRAIT.h,100));
});

test('attachment bytes API degrades safely without IndexedDB',async()=>{
  // Node has no IndexedDB; the module must reject clearly rather than hang.
  if(typeof indexedDB==='undefined'){
    await assert.rejects(()=>loadAttachmentBytes(),/indexedDB unavailable/);
    await assert.rejects(()=>saveAttachmentBytes(new Map()),/indexedDB unavailable/);
    await assert.rejects(()=>clearAttachmentBytes(),/indexedDB unavailable/);
  }
});
