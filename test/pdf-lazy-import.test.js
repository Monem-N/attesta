import test from 'node:test';
import assert from 'node:assert/strict';

// Regression guard: pdf-lib is loaded lazily by app.js. These modules must be
// importable before it exists — a top-level window.PDFLib read would throw at
// startup and leave the wizard blank (the bug fixed in 4b08468).
test('PDF modules import with no pdf-lib on window', async () => {
  const had = Object.hasOwn(globalThis, 'window');
  const prev = globalThis.window;
  globalThis.window = {};
  try {
    const output = await import('../output.js');
    const wa = await import('../regions/wa-template.js');
    assert.equal(typeof output.buildAttestation, 'function');
    assert.equal(typeof wa.generateWallonia, 'function');
  } finally {
    if (had) globalThis.window = prev;
    else delete globalThis.window;
  }
});
