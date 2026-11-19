# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/JS (vanilla, ES modules) + pdf-lib vendored locally. No build step, no server, no secrets. Deployed free on GitHub Pages / Netlify / Cloudflare Pages. PWA-installable with offline support.

## Users

A **recognized / agréé heating technician** working in Belgium who must deliver a legal control document after a periodic control (entretien / onderhoud) or first-commissioning inspection (Flanders *keuring* / Brussels 1st CP of a gas water heater). The technician is typically on-site, at the end of a job, on a phone or tablet. One technician may work across all three regions, so region is a per-job choice, not a fixed account setting.

## Product Purpose

The tool asks a short series of questions (wizard steps, ~6 fields max per step) and then produces the correct **attestation PDF** for the technician's region, ready to download, hand to the client, and (where required) submit to the authority. It replaces manual form-filling or proprietary software for technicians who want a free, lightweight alternative.

## Positioning

- **Free and static** — no subscription, no account, no proprietary ecosystem lock-in.
- **Region-aware from a single wizard** — one tool handles Wallonia, Flanders, and Brussels, swapping fields/rules per region config. Competing tools are typically single-region.
- **Reproduces official models exactly** — PDF overlay on the official government background; never shortened, never simplified. This is the only way a self-generated PDF stays legal.
- **Draft-safe** — auto-saved to localStorage; technician can finish later on the same device.
- **Honest about handoffs** — Brussels gas/liquid does not produce a PDF (that is legally impossible); it prepares the data set and provides a read-only summary + checklist for manual re-key into the BE encoder. The tool never pretends to do something it cannot.

## Operating Context

- **At the job site, end of intervention.** The technician has just finished the control and needs the paperwork done before leaving.
- **Phone or tablet primary.** One-handed use, gloves, variable lighting. Large tap targets, high contrast.
- **Short attention, no patience for scroll.** Fixed Back/Next buttons, sticky progress bar, compact 2-column grid on tablet / 1 column on phone.
- **Data stays on device.** No cloud sync, no accounts — the technician owns the data.
- **Region may change per job.** The technician selects Wallonia / Flanders / Brussels at the start of each attestation.
- **Legal deadline pressure.** Flanders: 1-month VEKA registration; Wallonia: 3-month window after anniversary; Brussels: 5-month remediation. The tool surfaces these deadlines.
- **Paper output.** The PDF is printed or emailed to the client. The technician keeps a copy and (where required) maintains a register.

## Capabilities and Constraints

### Capabilities
- Multi-region wizard (Wallonia, Flanders, Brussels) with per-region field visibility and validation.
- PDF generation via pdf-lib: official model PDF as background + text overlay at fixed x/y + signature image + analyzer-ticket pages.
- Flanders gate: download blocked until VEKA registration reference + timestamp recorded.
- Brussels gas/liquid data prep: structured JSON + read-only summary + checklist + deep-link to BE encoder for manual re-key. The `.attest` import format is proprietary and undocumented — third-party generation is not possible without a convention agreement with Bruxelles Environnement.
- Brussels solid fuel PDF: official BE model + ≥1000 kW combustion annex auto-included.
- Auto-computed next control date per region rules.
- Draft auto-save to localStorage.
- Status tracker per job: Draft → Ready → Submitted → Done.
- **Dutch-language output for Flanders models** (`model-keuringsrapport`, `model-verbrandingsattest`, `model-reinigingsattest`).

### Constraints
- **No backend, no database, no accounts.** Static files only.
- **No automatic authority submission.** VEKA API, BE encoder API — both require vendor onboarding, out of scope for Phase 1.
- **No multi-device sync.** Data lives on one device.
- **No push reminders.** Out of scope.
- **Recognition number patterns differ per region** and must be validated client-side (Wallonia: L/GI/GII/solid; Flanders: GV#####/TV#####/VA+#####; Brussels: GI/GII/L).
- **Official models may change.** PDF backgrounds must be versioned in the repo; coordinate drift is a known risk.
- **Brussels `.attest` import format is proprietary and undocumented.** Third-party generation requires a convention agreement with Bruxelles Environnement (vendor onboarding). The tool uses a data-prep + manual re-key approach for Brussels gas/liquid.

### Undecided
- **Phase 0b (in progress):** models downloaded and coordinates recorded in `docs/field-matrix.md`; remaining = tune overlay coordinates against rendered pages (Phase 1) and legal review per region.

### Resolved decisions
- **100 kW boundary conflict:** At exactly 100 kW the law (AGW art. 13, ≤100 kW = 3 yrs) governs over model footnote 14 (≥100 kW = 2 yrs). **Decision:** use 3 years and show a UI warning to the technician explaining the footnote conflict.
- **Brand name:** **Attesta.** No logo, voice, or visual identity established yet — greenfield beyond the name.

## Brand Commitments

Product name: **Attesta**. No logo, voice, or visual identity is established yet; the visual world is greenfield and will be defined during Phase 1.

## Evidence on Hand

- Wallonia official model: `assets/wa-attestation-bg.pdf` (cleaned: instruction page removed; **all embedded images kept** — they are mandatory measurement/category tables).
- Flanders official models: `assets/fl-model-keuringsrapport.pdf`, `fl-model-verbrandingsattest.pdf`, `fl-model-reinigingsattest.pdf` (Dutch, downloaded + converted).
- Brussels official models: `assets/br-solid-fuel-model.pdf` (media/19677), `assets/br-1mw-annex.pdf` (media/19676) — downloaded.
- Field/coordinate matrix: `docs/field-matrix.md`.
- Product spec: `boiler-attestation-tool-plan.md` (verified requirements, 160 lines).

## Product Principles

1. **Official models are sacred.** Never shorten, always reproduce exactly. The legal validity of the PDF depends on it.
2. **Honesty about constraints.** Brussels gas/liquid does not produce a PDF; the tool says so and does the next best thing. No fake functionality.
3. **The technician is the user, not the admin.** No accounts, no dashboards, no team seats. One job at a time, done fast.
4. **Region is a per-job choice, not an identity.** The same technician works across borders; the tool adapts, not the technician.
5. **Free means free.** No subscription, no trial, no "pro" tier hiding the good stuff. Static hosting, open code.

## Accessibility & Inclusion

- **Good usability, no formal standard.** Large tap targets, high contrast, readable font sizes for outdoor/glare conditions.
- **No WCAG audit required** at this stage, but the tool should not be hostile to screen readers or keyboard navigation.
- **Offline-capable (PWA).** The technician may be in a basement with no signal. The tool must work fully offline after initial load.