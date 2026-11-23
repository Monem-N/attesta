# PDF pipeline remediation — task list

Source: systemic review of layout, data-completeness and template routing.
Status legend: **DONE** (verified), **WIP** (being worked on), **TODO** (not started).

## P0 — Correctness of generated documents

| ID | Task | Status | Note |
|---|---|---|---|
| P0-1 | Separate coordinate maps for the three Flanders templates | DONE | `regions/flanders-pdf.js` (`FL_MAPS`) |
| P0-2 | Correct 4-box *Eindbeoordeling* and keuring OK/Niet OK rows | DONE | explicit box centres, generic heuristic disabled for Flanders |
| P0-3 | Align text baselines with printed labels (Flanders) | DONE | +8 pt baseline shift |
| P0-4 | Proef I / Proef II measurements and next-due date on Flanders PDFs | DONE | paired `{i,f}` values |
| P0-5 | Calibrated Wallonia maps for all 9 pages; add missing appliance/regulation fields | DONE | `regions/wallonia-pdf.js`, measured from the official PDF |
| P0-6 | Print Wallonia next-control date/range, remedy, maintenance and diagnostic dates | DONE | page 4 follow-up block |
| P0-7 | Signature support (blank signature lines / capture policy) for all regions | TODO | recipient/technician names are printed; signature capture is a policy decision |
| P0-8 | Complete Brussels solid-fuel maps (3-party, system, safety, dimensioning, protocol) | WIP | 53 of 55 wizard fields mapped; dense enum blocks still need printed-option ticks |
| P0-9 | Fill the ≥1000 kW annex measurement table instead of appending it blank | DONE | annex is already page 4 of the official model; duplicate append removed |
| P0-10 | Print VEKA reference/date on Flanders documents (gate evidence) | TODO |
| P0-11 | Field-key coverage test: wizard fields vs template maps | WIP |
| P0-12 | Category-aware Wallonia verdict thresholds from the official table | DONE | `regions/wallonia-criteria.js`, pinned to template 2015-10-29, page 8; LP/GP/GUP/GUnP rows, 2017 reclassification, butane/propane CO +15. Replaces the single LP A set in both UI and PDF. A category with no printed rule yields no OK. |

## P1 — Rendering engine

| ID | Task | Status | Note |
|---|---|---|---|
| P1-1 | Remove 90-character truncation; wrap text to a measured field width | DONE | `regions/pdf-render.js` |
| P1-2 | Format ISO dates to regional document format; format numbers | DONE | `formatValue()` |
| P1-3 | Bounds checking and collision warnings; never silently place off-page | DONE | audit warnings |
| P1-4 | Per-field audit of printed / ticked / omitted / clipped values | DONE | `blob.audit` + result line |
| P1-5 | Template revision + hash check; embed revision in PDF metadata | DONE | `assets/template-hashes.json` |
| P1-6 | Handle per-page geometry (landscape annex, 9-page Wallonia) | TODO |
| P1-7 | Consistent checkbox vocabulary beyond `oui/ja/non/nee` prefixes; add printed-option ticks for Brussels enums | TODO | no checkbox rectangles exist for `br-solid` yet |
| P1-8 | Reconsolidate Flanders text-encoding comment with actual DejaVu embed | TODO |

## P2 — Downloads, attachments, errors

| ID | Task | Status | Note |
|---|---|---|---|
| P2-1 | Let the user download exactly one Flanders document | DONE | document selector on final screen |
| P2-2 | Avoid double automatic downloads / partial document sets | TODO | choice reduces it to one in most cases |
| P2-3 | Stage-specific error messages (font / template / annex / attachment) | DONE | `PdfStageError` + translations |
| P2-4 | Restore attachment bytes for reloaded drafts (IndexedDB) or warn | WIP | warning shown; byte recovery still TODO |
| P2-5 | Align file input `accept` with supported attachment types; report skipped files | DONE | audit lists skipped files |
| P2-6 | Skip encrypted/corrupt attachments without aborting the document | TODO |
| P2-7 | Longer blob URL lifetime + `createObjectURL` capability check | DONE |
| P2-8 | Attachment/page count and success indicator in the result screen | TODO | audit line shows written fields/warnings |

## P3 — Validation, state, semantics

| ID | Task | Status | Note |
|---|---|---|---|
| P3-1 | Invalidate `Done` status when a completed draft is edited | DONE |
| P3-2 | Validate implausible/future dates and numeric ranges | TODO | Measurement ranges are now category-derived (P0-12); date plausibility still open |
| P3-3 | BCE / postal / phone pattern validation | TODO |
| P3-4 | Require attachments in workflows that mandate tickets | TODO |
| P3-5 | Single source of truth for drafts; guard storage failures visibly | TODO |
| P3-6 | Fix browser back/forward history semantics and attachment clearing | TODO |
| P3-7 | Scope acknowledgements per region | TODO |
| P3-8 | Honest final-screen wording (no "preview" without a preview) | TODO |
| P3-9 | Versioned JSON schema for Brussels data prep | TODO |

## P4 — Test infrastructure

| ID | Task | Status | Note |
|---|---|---|---|
| P4-1 | Unit tests for maps, boxes, steps, formatting, coverage | DONE | 31 tests passing |
| P4-2 | Snapshot-style PDF tests (rendered pages, text positions, page counts) | TODO |
| P4-3 | Template hash assertions | DONE | runtime check + `assets/template-hashes.json` |
| P4-4 | CI command that runs all PDF-related tests | TODO | `npm test` works |

## Explicitly out of scope for this pass

- Legal review of any official model.
- On-screen signature capture (policy decision required).
- Auto-submission to VEKA / Bruxelles Environnement.
- Re-keying or submitting the Brussels JSON in the BE encoder.
