# Attesta — Field & Coordinate Matrix (Phase 0b)

All coordinates are PDF points (origin top-left), page size A4 portrait **595 × 842 pt** unless noted. Extracted from the official model PDFs in `/assets` with PyMuPDF. These are **label anchors** — final overlay x/y must be tuned against a rendered page, but these give the correct region and reading order.

## Model inventory

| Region | File | Pages | Role |
|---|---|---|---|
| Wallonia | `assets/wa-attestation-bg.pdf` | 9 | Cleaned background (official page 1 — instructions — removed). Source: `attestation_controle_generateur_chaleur_rw.docx` |
| Flanders | `assets/fl-model-keuringsrapport.pdf` | 1 | First-commissioning report (Dutch) |
| Flanders | `assets/fl-model-verbrandingsattest.pdf` | 1 | Combustion attestation (Dutch) |
| Flanders | `assets/fl-model-reinigingsattest.pdf` | 1 | Cleaning attestation (Dutch) |
| Brussels | `assets/br-solid-fuel-model.pdf` | 4 | Solid-fuel periodic control (French) — self-generated PDF path |
| Brussels | `assets/br-1mw-annex.pdf` | 1 | ≥1000 kW combustion table (landscape 842 × 595) |

## Wallonia — `wa-attestation-bg.pdf`

Background page 1 = original page 2. The fillable attestation spans background pages 1–4; pages 5–9 are footnotes, logigrams, and the category/performance table (all mandatory, keep).

### Page 1 — header, technician, demandeur
| Field | Anchor (x,y) | Notes |
|---|---|---|
| Date du contrôle | (37, 30) | dotted fill area after label |
| N° attestation | (200, 30) | optional, company-internal |
| Technicien agréé L/GI/GII / solide | (50, 71) | checkbox group |
| Nom et prénom (technicien) | (37, 104) | |
| N° d'agrément | (37, 116) | only if CL or CG |
| Nom entreprise | (140, 116) | |
| Tél / Fax-courriel | (255, 116) | |
| N° Entreprise (BCE) | (37, 163) | |
| Demandeur (propriétaire/locataire/autre) | (295, 59) | checkbox group |
| Demandeur nom/adresse/contact | (295, 72–128) | block |
| Localisation générateur si différente | (37, 192) | |

### Page 1 — appliance
| Field | Anchor (x,y) | Notes |
|---|---|---|
| Combustibles (solide/liquide/gazeux) | (37, 192) | detailed enums |
| Nb de générateurs | (37, 322) | |
| Raccordement B / C | (37, 322) | NBN codes |
| À condensation oui/non | (37, 322) | |
| Plaque signalétique | (37, 322) | |
| Année construction / Marque / Type / N° série | (37, 322) | |
| Puissance nominale utile (kW) | (37, 322) | |
| Allures (1 / multiple / modulant) | (295, 284) | |
| Gaz: unit / air pulsé; prémix | (295, 284) | |
| Air pulsé: burner make/type/year/serial | (295, 284) | |
| Fluide caloporteur / production | (295, 363) | |

### Page 1 — room, orifices
| Field | Anchor (x,y) | Notes |
|---|---|---|
| Permis d'urbanisme avant/après 29/05/2009 | (37, 421) | selects applicable norms |
| Conformité ventilation local | (37, 489) | OUI/NON |
| Conformité amenée d'air | (37, 489) | OUI/NON |
| Conformité évacuation gaz | (37, 489) | OUI/NON |
| Causes non-conformité + actions | (37, 547) | free text |
| Orifices de mesure dispensé OUI/NON | (37, 562) | |
| Orifices état (3 options) | (37, 562) | |
| Remarque / cause | (37, 647) | free text |

### Page 2 — measurements
| Field | Anchor (x,y) | Notes |
|---|---|---|
| Critères bon fonctionnement (table) | page 2 top | **image1.emf — mandatory, keep** |
| Température d'eau | in table | |
| Indice de fumée, t° gaz, CO₂, O₂, CO, rendement | in table | multi-stage rows |
| Résultat global OK/non OK | in table | |
| Pression cheminée (Pa) type B | page 2 | |
| Pression pompe / gicleur | page 2 | optional, liquid fuel |
| Solid-fuel block (3 OUI/NON + global) | page 2 | |
| Déclaration de conformité OUI/NON | page 2 | |
| Causes non-conformité | page 2 | free text |

### Page 3 — diagnostic tree (>20 kW)
Decision tree A→E at (37, top). Nodes: prior report? → modification since? → after 30/04/2015? → ≥2 yrs? → deferred once? Each branch ends in "effectuer le diagnostic" / "en ordre" / "attendre".

### Page 4 — regulation, next interventions, signatures
| Field | Anchor (x,y) | Notes |
|---|---|---|
| Régulation AUTO/MAN | page 4 top | |
| Thermostat / horloge / nuit / pompe | page 4 top | OUI/NON + remarks |
| Prochaines interventions (5 variants + windows) | page 4 top | dates |
| Attestation établie par + signature technicien | page 4 mid | |
| Attestation reçue par + en qualité de + signature | page 4 mid | |

### Pages 5–9 (reference, no overlay)
Footnotes 1–17; periodic-control logigram; diagnostic logigram; category/performance table (**image5.emf — mandatory, keep**).

## Flanders — `fl-model-verbrandingsattest.pdf` (combustion)

| Field | Anchor (x,y) |
|---|---|
| Type (onderhoud / keuring) + volgnummer | (29, 2) |
| Firma / Technicus naam / voornaam | (29, 24) |
| Adres, postnummer, gemeente, erkenningsnummer (GV/TV) | (29, 65) |
| e-mail, datum keuring, ondernemingsnummer | (29, 94) |
| Klant + adres stooktoestel | (29, 104) |
| Kenmerken stooktoestel (type, brandstof, raccordement) | (29, 173) |
| Meetwaarden header (Proef I / Proef II) | (377, 302) / (459, 302) |
| keteltemperatuur … rendement (Hi/Hs) | (26, 338–571) — 15 measurement rows |
| druk rookgasafvoerkanaal + verluchting | (26, 625) |
| Het stooktoestel werkt goed/veilig/… | (135, 674) |
| Eerstvolgende verbrandingscontrole vóór | (276, 674) |
| Gebreken en maatregelen | (29, 702) |
| Signaturen (technicus + klant) | (29, 761) / (340, 761) |

All output text in **Dutch**. Recognition patterns: `GV#####`, `TV#####`, `VA+#####`.

## Flanders — `fl-model-reinigingsattest.pdf` (cleaning)

| Field | Anchor (x,y) |
|---|---|
| Type + volgnummer + firma | (28, 2) |
| Technicus / erkend GV/TV of schoorsteenveger | (28, 52) |
| Adres, tel, e-mail, datum reiniging, ondernemingsnummer | (28, 66–110) |
| Klant + adres stooktoestel | (28, 123–195) |
| Kenmerken stooktoestel | (28, 208) |
| type / bouwjaar / fabricatienummer / vermogen | (28, 295–338) |
| Reiniging rookgasafvoerkanaal checks | (28, 352–391) |
| Reiniging stooktoestel: gas / vloeibaar / vast | (28, 459–560) |
| Gebreken en maatregelen + opmerkingen | (28, 574–651) |
| Eerstvolgende reiniging vóór | (28, 687) |
| Signaturen | (290, 708) |

## Flanders — `fl-model-keuringsrapport.pdf` (first commissioning)

| Field | Anchor (x,y) |
|---|---|
| KEURINGSRAPPORT + volgnummer | (25, 0) |
| Firma / technicus / adres / erkenningsnummer | (25, 23–65) |
| e-mail, datum keuring, ondernemingsnummer | (25, 94) |
| Klant + adres toestel | (25, 121) |
| Materiaal / mantel / hoogte / isolatie checks | (27, 411) |
| verluchting sectie + andere checks | (27, 471) |
| EINDBEOORDELING conform/niet | (27, 563) |
| Signaturen | (25, 737) |

## Brussels — `br-solid-fuel-model.pdf` (self-generated path)

4 pages, French. Note: the official attestation **also exists as an Excel model**; the PDF path is the one used here.

- **Page 1**: Date de l'acte / Motif (enum at x=130,y=99); Adresse unité PEB + Propriétaire (54,121); CONFORME / NON-CONFORME (162,282); protocole injonction d'arrêt (54,303); Date prochain contrôle (54,323) = act + 5 mo / +1 yr mazout / +2 yr gaz; 8 exigences bon fonctionnement (54,382+); CO max mesuré PPM (284,393); société + agrément GI/GII/L/RESCERT (306,650); signatures (54,698).
- **Page 2**: Système type 1/2, individuel/collectif (64,108–117); appareil (54,86–179); brûleur (54,283–313); entretien (54,365); dimensionnement type 1 (54,448–489); recommandations; certificateur PEB info (54,561).
- **Pages 3–4**: additional recommendations / annexes.
- **≥1000 kW**: append `br-1mw-annex.pdf` (landscape) — measurement rows at x=67, y=259–476.

## Cleanup rules (corrected)

**Only page 1 of the Wallonia source (the "A quoi sert ce modèle?" instruction page with the "cadre à supprimer après l'avoir lu" and emergency notices) was removed.** Do **not** remove embedded images: `image1.emf` is the mandatory measurement-criteria table and `image5.emf` is the mandatory category/performance table. Removing either would shorten the official model and void its legal validity. Regional logos (image2/3/4) are retained as part of the official document.

## Overlay implementation notes

- **Checkbox model:** `assets/checkbox-rects.json` holds the real printed checkbox rectangles extracted from the Wallonia background (vector rects + Wingdings `U+F097` glyph boxes). `output.js` ticks the correct OUI/NON box by finding the nearest same-row pair to each field anchor. Text for ticked binary fields is suppressed (the printed OUI/NON labels remain).
- **Previously unmapped fields:** `intervention`, `building`, `techCategory`, `requester`, `fuel`, `clientCompany` now render as labelled lines in the blank strip below the orifice section on Wallonia page 1.
- **Text encoding:** standard-font WinAnsi renders French accents correctly (verified: Élise, François, Béland, Église). Non-WinAnsi characters (e.g. Dutch `ĳ`) are transliterated (`ij`) and each field draw is guarded so one bad character can never abort the PDF. Full Unicode via a vendored TTF + fontkit was rejected: it would add ~2 MB to a deliberately lightweight static app.

## Status

- [x] All 6 model files downloaded and converted
- [x] Wallonia background cleaned (instruction page removed, mandatory tables kept)
- [x] Label anchors recorded for all fillable pages
- [ ] Overlay coordinates tuned against rendered pages (Phase 1)
- [ ] Legal review per region before real use
