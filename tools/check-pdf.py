#!/usr/bin/env python3
"""Deterministic PDF quality gate for generated Attesta documents.

Checks page count, page geometry, embedded fonts, required/forbidden text,
text bounds, and rasterizes pages for visual snapshots. Exits non-zero with
all failures listed. Render failures never imply a correct document.
"""
import argparse, json, os, sys
import fitz

ap = argparse.ArgumentParser()
ap.add_argument('pdf')
ap.add_argument('--pages', type=int, required=True)
ap.add_argument('--font', default='DejaVuSans')
ap.add_argument('--required', action='append', default=[])
ap.add_argument('--forbidden', action='append', default=[])
ap.add_argument('--outdir', default=None)
a = ap.parse_args()

doc = fitz.open(a.pdf)
errors = []
if len(doc) != a.pages:
    errors.append(f'page count: expected {a.pages}, got {len(doc)}')

all_text = []
for i, page in enumerate(doc):
    w, h = page.rect.width, page.rect.height
    if abs(w - 595.32) > 1.5 or abs(h - 841.92) > 1.5:
        errors.append(f'page {i+1}: unexpected size {w:.1f}x{h:.1f} (expected A4 portrait)')
    fonts = [f[3] for f in page.get_fonts()]
    if a.font and not any(a.font in f for f in fonts):
        errors.append(f'page {i+1}: missing embedded font {a.font!r} (found {sorted(set(fonts))[:3]})')
    for b in page.get_text('blocks'):
        x0, y0, x1, y1 = b[:4]
        if x0 < -1 or y0 < -1 or x1 > w + 1 or y1 > h + 1:
            errors.append(f'page {i+1}: text block outside page: ({x0:.1f},{y0:.1f},{x1:.1f},{y1:.1f})')
    all_text.append(page.get_text())
text = '\n'.join(all_text)

for needle in a.required:
    if needle not in text:
        errors.append(f'required text missing: {needle!r}')
for needle in a.forbidden:
    if needle in text:
        errors.append(f'forbidden text present: {needle!r}')

if a.outdir:
    os.makedirs(a.outdir, exist_ok=True)
    for i, page in enumerate(doc):
        pix = page.get_pixmap(matrix=fitz.Matrix(1.2, 1.2))
        pix.save(os.path.join(a.outdir, f'gate-page-{i+1}.png'))

if errors:
    print('PDF GATE FAILED:')
    for e in errors:
        print('  -', e)
    sys.exit(1)
print(f'PDF GATE OK: {len(doc)} pages, A4, font {a.font}, '
      f'{len(a.required)} required strings, {len(a.forbidden)} forbidden strings checked')
