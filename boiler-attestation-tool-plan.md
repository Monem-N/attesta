# Final Plan — Multi-Region Boiler Attestation Tool (3 Regions)

## Goal

A free-hosted, static web app for a heating technician to:

1. Fill in intervention data on a phone/tablet right after the job (short wizard steps, no long scrolling).
2. Generate the correct report/PDF, or the correct data handoff, per region.
3. Get the document to the authority by the legally correct route.

No backend, no login, no database. Client data stays on the device.

## Scope — all 3 regions

One shared stepped form + one config object per region that swaps fields, rules, and the final action.

| Region | Final action in the app | Legal reality |
|---|---|---|
| **Wallonia** | Download AWAC attestation PDF + analyzer tickets | Complete deliverable. No authority portal. Hand PDF to client, keep copy, 4-year register. |
| **Flanders** | Download the 2 official-model attestations, **gated** on recording a VEKA registration reference | VEKA registration within 1 month is mandatory; technician may **not** issue an attest without it. App cannot auto-submit (needs vendor API onboarding) — it guides + gates + deep-links. |
| **Brussels** | Gas/liquid: **build the complete attestation payload** (structured JSON/import file) → tech imports into the BE encoder → BE generates the official PDF; fallback = deep link + read-only summary for manual re-entry. Solid fuel: generate official-model PDF + email instructions. | Since 6 Nov 2023 only EPB-Desk-generated PDFs are official for gas/liquid. Solid-fuel boilers are the sole self-generated-PDF exception. |

## Hosting & stack

- **Hosting:** GitHub Pages (or Netlify / Cloudflare Pages). Static files only, no build step, no server, free forever for this traffic.
- **Stack:** vanilla HTML/CSS/JS (ES modules). `pdf-lib` vendored locally under `/vendor/` so no CDN dependency and it works offline once loaded.
- **Storage:** single JS state object persisted to `localStorage` as a draft. No accounts, no remote storage.

```
/index.html
/styles.css
/app.js
/output.js                          (region-aware output dispatcher)
/regions/wallonia.js                 (fields, rules, PDF overlay)
/regions/flanders.js                 (fields, rules, PDF overlay, VEKA gate)
/regions/brussels.js                 (fields, rules, payload/summary builder, solid-fuel PDF)
/vendor/pdf-lib.esm.js
/assets/awac-attestation.pdf        (official background, Wallonia)
/assets/fl-model-combustion.pdf     (official background, Flanders)
/assets/fl-model-cleaning.pdf       (official background, Flanders)
/assets/br-solid-fuel-model.pdf     (official background, Brussels solid fuel)
/assets/br-1mw-annex.pdf            (>=1000 kW solid-fuel combustion table)
/manifest.webmanifest               (PWA manifest)
/sw.js                              (service worker for offline)
/assets/logo.png                    (optional)
```

## UI specification

- Full-viewport layout: `height: 100dvh`, flex column.
- Sticky progress bar top, fixed Back / Next bottom. Content area fits without scrolling; compact 2-column grid, 1 column on phone, ~6 fields max per step.
- Wizard steps (fields shown/hidden by region config):

1. **Region & intervention** — region, intervention type (commissioning / periodic / post-combustion-intervention / non-conformity follow-up), date.
2. **Technician** — name, recognition no. + pattern validation, company, BCE number.
3. **Client & site** — name, address, appliance address if different, contact.
4. **Appliance** — fuel, power kW, make, model, serial, year, burner type, system type (Brussels 1/2), connection type.
5. **Measurements** — fuel-specific fields, initial vs final series (Flanders), analyzer ticket photo/PDF upload.
6. **Checks & result** — ventilation, flue, safety devices, CO ambient (Brussels), diagnostic approfondi (Wallonia >20 kW), conformity, defects, computed next-due date, signatures.
7. **Final screen** — region-specific: Download PDF (Wallonia / Flanders / Brussels solid fuel) or "Import into BE encoder" (Brussels gas/liquid — download import file + link + read-only summary for manual re-entry).

- Status tracker per job: `Draft → Ready → Submitted (ref + timestamp) → Done`. The Flanders gate lives here.

## Data & rules engine

Canonical intervention object; region configs drive which fields are required and what the final action is.

Verified rules to encode:

| | Flanders | Wallonia | Brussels |
|---|---|---|---|
| Mazout/liquid | 1 yr, from 20 kW | 1 yr | 1 yr |
| Gas ≤100 kW | 2 yrs (from 20 kW) | **3 yrs (≤100 kW incl.)** — ⚠️ CONFLICT: AGW art. 13 says ≤100 kW = 3 yrs, but model footnote 14 says ≥100 kW = 2 yrs. **Decision (confirmed):** use 3 yrs (law governs) and show a UI warning at exactly 100 kW. | 2 yrs |
| Gas >100 kW | 2 yrs | 2 yrs | 2 yrs |
| Solid | Not in scope of the 2006 besluit — skilled tradesman, cleaning attestation only | 1 yr | 1 yr |
| Trigger events | After combustion intervention; first-commissioning keuring | After combustion intervention | After combustion intervention, appliance move, replacement, **1st CP of a gas water heater** |
| Window / deadline | Register within 1 month; remedy combustion-value defects within 3 months (new verbrandingsattest) | Control within 3 months of anniversary; non-conformity 5 months (residential exception 3 months, 1 Sept–30 Apr, once) | Non-conformity 5 months |
| Retention | Last 2 attestations; govt may request last 5 interventions | Last 2 attestations + 4-year chronological register; produce within 5 working days | 5 years in logbook |
| Recognition | `GV#####` / `TV#####` / `VA+#####` | L / GI / GII / solid-fuel specialist | GI / GII / L; biomass = RESCERT or trained |

All regions: next control also required after any intervention on the combustion part; attestation number is optional / company-internal.

Brussels needs a richer data model than the other two: 3 parties (technician, owner/PE holder, contact), PEB-unit address, `motif` enum, and system type 1/2 + collectif — see the full block list under the Brussels adapter below. Region configs must gate which fields are required, but the canonical object must be able to hold all of them so a single capture serves every region.

## Output generation (region-aware)

Single dispatcher: `buildAttestation(state, region) → { bytes, mime, filename, instructions }`.

- **Wallonia / Flanders / Brussels solid fuel:** `pdf-lib` loads the official model PDF as a background page, overlays text at fixed x/y coordinates, appends signature image and analyzer ticket pages, returns `Uint8Array` downloaded via Blob URL.
- **Brussels gas/liquid:** builds the **complete attestation payload** as structured JSON + read-only summary + checklist. The `.attest` import format is proprietary and undocumented — third-party generation requires a convention agreement with Bruxelles Environnement (vendor onboarding). No self-generated PDF.

**Phase 0 tasks (complete):** download each official model PDF and record field coordinates; investigate Brussels `.attest` import format — **resolved: no-go** (proprietary, requires vendor convention). The models may be personalised (logo) or extended but **never shortened** — reproduction must contain at least all model fields.

## Region adapters

### Wallonia (complete)
- Official model: *Attestation de contrôle d'un générateur de chaleur* (FR + DE), mandatory since 01/10/2015 — [AWAC chauffagistes](https://awac.be/home/guichet-technique/agrements/chauffagistes.html).
- Legal basis: [AGW 29/01/2009 consolidated](https://awac.wallonie.be/files/Files/chauffagistes/informations/agw_chauffage_central_29_01_2009_consolide.pdf), art. 13–15, Annex IV.
- Output: attestation + attached tickets. No authority submission. Admin-only extras: register, 4-year retention, produce within 5 working days on request.
- Field guide: [hoteo](https://hoteo.be/guides/attestation-controle-chaudiere-wallonie/).

#### Wallonia attestation — full field scope (must cover all blocks)

The official model has 16 sections (the model numbers them 1–14, with two sub-sections split out). The tool must cover all of them:

1. **Date & attestation number:** control date, attestation number (optional, company-internal).
2. **Technician:** agrément (L / GI / GII / solid-fuel specialist), name, company, BCE, phone/email.
3. **Demandeur:** enum (propriétaire / locataire / autre), name, company (if applicable), address, contact, appliance location (if different).
4. **Combustibles:** solid (pellets / bûches / plaquettes / céréales / charbon / autre), liquid (gasoil / gasoil extra / fuel lourd / autre), gas (G20 / G25 / propane / butane / biogaz / autre). Multi-fuel: mention all.
5. **Générateur & brûleur:** nb of generators in the room, identification (if multiple), raccordement type (B / C with NBN codes e.g. B11BS, C33), condensation (OUI/NON), plaque signalétique (present/absent), year of construction, make, type, serial no., Pnom (kW), allures (1 / multiple [count] / modulant), unit vs air pulsé, premix vs non-premix, separate burner make/type/year/serial (if air pulsé).
6. **Installation:** fluide caloporteur (eau / vapeur basse pression / huile thermique), production (chauffage / ECS / both).
7. **Local:** 3 conformités (ventilation / amenée d'air comburant / évacuation gaz combustion), permis d'urbanisme date (avant/après 29/05/2009 — selects applicable norms NBN B61-001/002, D51-003/004/006).
8. **Orifices de mesure:** dispensé (OUI/NON), if not dispensé: present & conforme / present & non conforme / absent & non réalisable + remark.
9. **Critères de bon fonctionnement (tableau seuils):** O2, CO2, CO (mg/kWh), température nette, rendement, indice de noircissement (mazout only). Pression cheminée (Pa) for type B atmospheric.
10. **Informations techniques complémentaires:** pression pompe (bar), gicleur (marque/type/débit/angle) — non-obligatoire si combustible liquide.
11. **Solid-fuel block (if applicable):** 3 OUI/NON questions (fumée visible, évacuation gaz, résultat global OK/non OK).
12. **Diagnostic approfondi (>20 kW) decision tree:** A) prior report? → B) modification since? → C) modification after 30/04/2015? → D) ≥2 yrs? → E) already deferred once? Each branch leads to: effectuer le diagnostic / installation en ordre jusqu'au prochain contrôle / attendre le prochain contrôle.
13. **Régulation & pompes:** AUTO/MAN mode, thermostat OUI/NON, horloge OUI/NON, nightly reduction OUI/NON, pump dysfunction OUI/NON + remark.
14. **Prochaines interventions:** 5 checkbox variants with date windows — (a) prochaine inspection périodique (date range), (b) non-conformité sans mise à l'arrêt (deadline), (c) remise en fonctionnement après mise à l'arrêt, (d) entretien constructeur (deadline), (e) diagnostic approfondi (date range).
15. **Signatures:** technicien signature, recipient signature (name + qualité).
16. **Danger procedure:** immediate danger (emergency numbers, written warning to user/owner), potential danger (registered letter with acknowledgment of receipt for absent parties).

> **⚠️ 100 kW boundary conflict — DECIDED:** AGW art. 13 says ≤100 kW = 3 yrs, but model footnote 14 says ≥100 kW = 2 yrs. At exactly 100 kW the law governs → **use 3 yrs and show a UI warning** explaining the conflict. No further decision needed.

> **Model cleanup — DONE (corrected):** Only the instruction page ("A quoi sert ce modèle?" / "cadre à supprimer après l'avoir lu") was removed from the Wallonia DOCX. **Embedded images must be kept** — `image1.emf` is the mandatory measurement-criteria table and `image5.emf` the mandatory category/performance table; removing them would shorten the official form. Cleaned background: `assets/wa-attestation-bg.pdf`.

### Flanders (PDF + gated registration handoff)
- Models: `model-keuringsrapport`, `model-verbrandingsattest`, `model-reinigingsattest` — [Vlaanderen.be technicus page](https://www.vlaanderen.be/natuur-milieu-en-klimaat/informatie-voor-de-technicus-vloeibare-en-technicus-gasvormige-brandstof-cv-ketel). **Dutch-language output required.**
- Output: combustion + cleaning attestations (periodic) or keuring set (first commissioning). **All Flanders PDFs in Dutch.**
- **Gate:** download enabled only after tech enters VEKA registration reference + timestamp. Show checklist of the 30-day-window data (appliance type, location, power, fuel, burner tech, year, activity type, date, final assessment) and a deep link to `Melding Centrale Stooktoestellen` (`melding.veka.vlaanderen.be`).
- Registration is mandatory since 1 Jan 2023; 1-month deadline since 1 Sept 2023; no attest without registration. ([BIS-nota](https://themis.vlaanderen.be/files/63dcae65b867a9000c0035ea/download))
- Official auto-transmit vendors (do not try to replace them): 2FACT, Cafca, Climapulse, InstaMobile–InstaCert, Maintenanz, Plenion, TESTO, Zamia. VEKA API onboarding is Phase 2 only.

### Brussels (no self-generated PDF except solid fuel)
- All attestations digital since 6 Nov 2023; official PDF generated by Bruxelles Environnement via EPB-Desk & PLAGE. ([BE pro tools](https://environnement.brussels/pro/documentation-et-outils/sites-web-et-outils-interactifs/outils-pour-les-pros-des-installations-techniques-peb), [BE newsletter](https://environnement.brussels/media/21057/download?inline=))
- Gas/liquid: app builds the **complete attestation payload** (structured JSON). **`.attest` import format is proprietary and undocumented — third-party generation requires a convention agreement with Bruxelles Environnement (vendor onboarding).** The tool provides: read-only summary + checklist + deep link to `peb-epb.brussels/att-frontoffice/pwa/index.html` for manual re-key. This is a data-prep tool, not an import-file generator.
- Solid fuel: official PDF/Excel model → generate PDF → email to BE address on the model. ≥1000 kW needs extra combustion table. (Model IDs: 19677, ≥1 MW annex 19676.)
- Rules: [BE entretien chaudière](https://environnement.brussels/entretien-chaudiere), [BE pro obligations](https://environnement.brussels/pro/reglementation-et-inspection/obligations-et-autorisations/installations-techniques-les-controles-et-entretiens-peb).

#### Brussels attestation payload — full field scope (must cover all blocks)

The official form has ~8 blocks. The payload must cover all of them, not just appliance + measurements + checks:

1. **3-party data:** Professionnel agréé (name, recognition no., company, BCE) **+** Propriétaire/titulaire PE (name, address, contact) **+** Personne de contact (if different) **+** Adresse de l'unité PEB (rue/n°, étage, CP/commune, référence unité PEB, nom du bâtiment).
2. **Motif du contrôle** — enumerated: `(rem)placement` / `mise en conformité` / `autre raison` / `délai max entre 2 CP atteint` / `intervention partie combustion`.
3. **Système:** type 1 vs type 2, individuel vs collectif, nombre de chaudières. This drives many downstream required/optional fields.
4. **Appareil block:** chaudière à condensation / PAS à condensation, chauffe-eau gaz, usage (chauffage / ECS / both / secours), Type A/B/C, B22p/B23p, conduit individuel/collectif, EN 437 category, gas conversion compatibility (I2E+, I2N, I2E(S)…).
5. **Exigences de bon fonctionnement (8 OUI/NON items):** CO ambiant, dispositifs de sécurité, état des conduits, orifices de mesure, ventilation du local, dépression, émissions, + B1 cheminée collective.
6. **Dimensionnement (type 1):** consommation annuelle, temps de fonctionnement, thresholds >1000 / 500–1000 / <500 h/an.
7. **Déclaration de conformité** decision tree (dérogation, protocole d'injonction d'arrêt) + auto-computed **Date prochain contrôle**: `+5 mois si non conforme; +1 an mazout; +2 ans gaz`.
8. **Annexes obligatoires:** tickets de mesures initiales **et** finales; ≥1000 kW solid-fuel combustion table; carnet de bord / feuille de route (5-year logbook) references.

## Deployment

1. Push static files to a GitHub repo.
2. Enable GitHub Pages (main branch / root).
3. No build, no env vars, no secrets, no server.
4. Optional custom domain.

## Phases

- **Phase 0 (complete):** All official models downloaded and converted to PDF in `/assets`. Wallonia instruction page removed (mandatory tables kept). Label anchors recorded in `docs/field-matrix.md`. Brussels `.attest` import format investigated — **resolved: no-go** (proprietary, requires vendor convention).
- **Phase 0b (remaining):** Tune overlay coordinates against rendered pages during Phase 1; legal review per region before real use.
- **Phase 1 (2 weeks):** Shared wizard + 3 region configs + local draft + region-aware output dispatcher. Wallonia fully working, Flanders with gate + handoff, Brussels with data-prep + manual re-key + solid-fuel PDF. Deploy free.
- **Validation (2 weeks):** One real technician uses it on real jobs daily; collect field/UX gaps.
- **Phase 2 (later, only if needed):** VEKA API onboarding; Brussels connected-vendor path; accounts, cloud archive, region-specific reminders, admin seat.

## Explicitly out of scope for now

Backend, database, user accounts, VEKA API integration, automatic authority submission, push reminders, team seats, multi-device sync.

## Key risks / open items

- **Legality of self-rendered PDF:** reproduce official models exactly (never shorten); get a legal review per region before real use.
- **Brussels `.attest` import format:** proprietary and undocumented — third-party generation requires a convention agreement with Bruxelles Environnement (vendor onboarding). The tool uses a data-prep + manual re-key approach for Brussels gas/liquid. Phase 0 is complete: no-go on import file generation.
- **VEKA API:** vendor onboarding required, not self-serve.
- **Resolved edge cases (do not re-flag):** Flanders gas/liquid obligation starts at 20 kW. Wallonia gas exactly 100 kW → **3 years** per AGW art. 13 ("inférieure ou égale à 100 kW"), despite model footnote 14 (≥100 kW = 2 yrs). Decision: 3 yrs + UI warning.
- **Flemish claims — NOW VERIFIED:** (1) 3 months to remedy combustion-value defects with a new verbrandingsattest ([Eisen verbrandingsrendement](https://www.vlaanderen.be/bouwen-wonen-en-energie/verwarming-koeling-en-ventilatie/keuring-en-onderhoud-van-uw-verwarming/eisen-verbrandingsrendement-van-cv-ketel)); (2) government may request data of the last 5 keuringen/onderhouden/audits ([technicus page](https://www.vlaanderen.be/natuur-milieu-en-klimaat/informatie-voor-de-technicus-vloeibare-en-technicus-gasvormige-brandstof-cv-ketel)). Encode both. Wallonia's 3-month residential exception is a separate rule (5-month baseline).
- **Coordinates drift** if official models change — keep models versioned in repo.

## Sources

- Vlaanderen.be: maintenance, technician obligations, recognition, models, [8 Dec 2006 besluit Annex I](https://emis.vito.be/sites/emis/files/legislation/migrated/sb270407-1-a.pdf)
- AWAC / Energie Info Wallonie: [AGW 2009](https://awac.wallonie.be/files/Files/chauffagistes/informations/agw_chauffage_central_29_01_2009_consolide.pdf), [frequency](https://www.energieinfowallonie.be/fr/quelle-frequence-le-controle-periodique-doit-il-etre-effectue)
- Bruxelles Environnement: pro tools, entretien chaudière, obligations, newsletters
