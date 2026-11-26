# Surface Brief — Attesta Wizard

_Mode: **Operate** (task-completion tool). Visual world: greenfield — defined in new-work, not here._

## 1. Job and audience
A recognized/agréé heating technician, on-site at the end of a boiler control, on a phone or tablet, possibly wearing gloves, in variable light. They open Attesta to turn the just-finished intervention into the correct legal document before leaving. One job at a time. Region may differ per job. Visitor mode: **Operate** — focused, impatient, wants done.

## 2. Outcome and proof
**Primary action:** complete a short wizard → download the correct attestation PDF(s) (or, for Brussels gas/liquid, the data-prep handoff).
**Success:** correct document the first time, no rework, no office call; legal deadlines surfaced (Flanders VEKA 1-month, Wallonia 3-month window, Brussels 5-month remediation).
**Product truth:** one wizard, three regions, region-appropriate output, zero transcription error. Reproduces official models exactly. Brussels gas/liquid honestly does **not** produce a PDF.

## 3. Selected direction
- **Structural thesis:** single linear wizard, ~6 fields/step, region config swaps fields/rules/output. One question per screen group, never a wall of fields.
- **Focal moment:** the final screen — region-correct output with the next-due date and deadline called out.
- **Visual world:** **The Norms Table** — chosen via concept-seed (`seed:51e40bb4fd0084f5`), code-led. The AGW threshold tables and category-code grids become the wizard's visual language: warm paper ground, hairline rules, tabular figures, one control red, and a measured row resolving to OK / NON OK. Direction contract lives in `.impeccable/surfaces/index-html.md`.

## 4. Scope and boundaries
- **Fidelity:** all 3 regions usable at once (Wallonia PDF, Flanders PDF+VEKA gate, Brussels gas/liquid data-prep + solid-fuel PDF).
- **In scope:** region & job step, technician (remembered), client/site, appliance, measurements, checks/result, final output; local draft; next-due computation; recognition-number validation.
- **Untouched / anti-goals:** official model PDFs never shortened; no backend/accounts/cloud; no authority auto-submit; no fake Brussels PDF; not a long-scroll page; not a dashboard.

## 5. States and ranges
- **Technician profile:** entered once, remembered in localStorage, reused every job (editable later).
- **Draft:** auto-saved; resumable on same device; job status `Draft → Ready → Submitted (ref+ts) → Done`.
- **Flanders gate:** download disabled until VEKA reference + timestamp entered; shows the 30-day data checklist + deep link.
- **Brussels gas/liquid:** end screen is data-prep (read-only summary + checklist + deep link), never a download button.
- **First-run / empty:** no tech profile yet → step 2 prompts for it once.
- **Ranges:** 1 boiler typical; multi-boiler (Brussels type 2) supported; solid-fuel adds its block; ≥1000 kW adds Brussels annex.

## 6. Interaction and layout
- Full-viewport (`100dvh`), flex column; sticky progress bar top; fixed Back/Next bottom; the content area scrolls internally only when a step is long.
- 2-column grid on tablet, 1-column on phone; large tap targets; high contrast for glare.
- Region selected first; downstream steps show/hide by config; inline validation on recognition numbers; computed next-due shown on result step.
- Signatures: **optional on-screen capture** (drawn or typed name) embedded in the printed/PDF output; blank printed lines remain when no signature is given. Superseded 2026-11-26 (was: blank lines only).

## 7. Constraints and open decisions
- Static HTML/CSS/JS + vendored pdf-lib; PWA (manifest + service worker); localStorage only.
- Overlay coordinates per `docs/field-matrix.md` (tune against rendered pages in Phase 1).
- **Resolved:** visual world = The Norms Table; product name = Attesta; 100 kW → 3 years with a UI warning.
- **Open:** logo/wordmark asset; legal review per region; overlay-coordinate tuning against rendered pages.
- **Must not invent:** legal rules, retention periods, or output formats — all fixed by PRODUCT.md + plan.