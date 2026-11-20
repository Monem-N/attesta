---
name: Attesta
description: Multi-region boiler attestation wizard — a compliance reading, not a form filler.
colors:
  archival-paper: "#f4f3ee"
  header-band: "#eceae3"
  ink-black: "#16181d"
  signal-red: "#b23a2b"
  hairline: "#c9c7bf"
  soft-grey: "#61666e"
  verdict-green: "#2f6b4f"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "clamp(22px, 5vw, 30px)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, Consolas, monospace"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.12em"
  value:
    fontFamily: "IBM Plex Mono, ui-monospace, Consolas, monospace"
    fontSize: "14px"
    fontWeight: 400
  # Full size ramp used by the implemented wizard (advisories cleared 2026-11-20)
  micro: "10px"          # step count, due label, threshold, ack
  meta: "11px"           # region tag, mono chips
  hint: "12px"           # step hint, warning, buttons
  hint-lg: "12.5px"      # prose hints, measurement labels
  row: "13px"            # ledger row / region choice label
  wordmark: "15px"       # ATTESTA wordmark, next button
  readout: "20px"        # monumental due date, phone
  readout-lg: "27px"     # monumental due date, desktop
colors-extra:
  final-card-wash: "rgba(255,255,255,.35)"
rounded:
  none: "0px"
spacing:
  gutter: "20px"
  field-gap: "11px"
  column-gap: "16px"
  header-height: "64px"
  footer-height: "64px"
components:
  button-next:
    backgroundColor: "{colors.signal-red}"
    textColor: "{colors.archival-paper}"
    rounded: "{rounded.none}"
    padding: "10px 16px"
  button-back:
    backgroundColor: "transparent"
    textColor: "{colors.soft-grey}"
    rounded: "{rounded.none}"
    padding: "10px 16px"
  field-input:
    backgroundColor: "transparent"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.none}"
    padding: "5px 0"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.none}"
    padding: "7px 10px"
  chip-selected:
    backgroundColor: "{colors.ink-black}"
    textColor: "{colors.archival-paper}"
    rounded: "{rounded.none}"
    padding: "7px 10px"
---

# Design System: Attesta

## Overview

**Creative North Star: "The Registry Ledger"**

Attesta reads like an official registry document, not a consumer app. Every screen is a ruled ledger: a label in the left margin, a measured value entered on the line, and a verdict resolved at the right. The technician is not "filling a form" — they are reading an installation against a published standard and recording the result, one row at a time. The interface borrows the authority of a stamped government form: archival paper ground, near-black ink, grey hairline rules, and a single signal red reserved for control and warning.

Density is high but never cramped. Type is a compact grotesque (Inter) for prose paired with a tabular monospace (IBM Plex Mono) for every label, value, and verdict — so columns of numbers align and a measured value reads as data, not decoration. The signature move is the measurement row: a value lands in its column and the row resolves to **OK** (green) or **NON OK** (red). Corners are square, there are no drop shadows; depth comes only from hairline rules and the tonal header/footer bands that frame the working area.

The system explicitly refuses the soft, rounded SaaS wizard with a floating purple button. It is flat, ruled, and square because the document it produces is. The output PDF must look like the source of truth because it *is* the source of truth.

**Key Characteristics:**
- Archival-paper ground with near-black ink; one signal red for control/warning.
- Tabular monospace for all labels, values, and verdicts; grotesque for prose.
- Square corners, zero radius, no drop shadows — depth via hairlines and tonal bands.
- The measurement row as the recurring signature: value → verdict (OK / NON OK).
- Fixed progress rail and fixed footer; the working area alone scrolls.

## Colors

A warm archival palette: paper and ink do the work, a single red carries all control and warning meaning, and a muted green is the only other chromatic signal — the OK verdict.

### Primary
- **Signal Red** (#b23a2b): The one control color. Primary action (Continue), the top regional rule, active step marker, required-field asterisk, focus underline, warnings, and the NON OK verdict. Used sparingly — its rarity is what makes it read as a signal.
- **Ink Black** (#16181d): Primary text, the wordmark, completed progress segments, selected chips, and button borders. The "printed" content of the ledger.

### Neutral
- **Archival Paper** (#f4f3ee): The page ground — a warm off-white that reads as document stock, not screen white.
- **Header Band** (#eceae3): Tonal band for the fixed header and footer, separating chrome from the working area without a shadow.
- **Hairline** (#c9c7bf): All rules, borders, input underlines, and dividers. The structural grid of the ledger.
- **Soft Grey** (#61666e): Secondary text, hints, placeholder text, idle/back affordances, and threshold captions.

### Tertiary
- **Verdict Green** (#2f6b4f): Reserved exclusively for the OK verdict in a resolved measurement row. Never decorative.

### Named Rules
**The One Signal Rule.** Signal red appears on ≤10% of any screen. It marks only control, focus, warning, or a NON OK verdict. If everything is red, nothing is.
**The Green-Only-Verdict Rule.** Verdict green is never used for branding, success toasts, or decoration — only a measurement row resolving to OK.

## Typography

**Display Font:** Inter (with system-ui, -apple-system, sans-serif fallback)
**Body Font:** Inter (with system-ui fallback)
**Label / Value Font:** IBM Plex Mono (with ui-monospace, Consolas, monospace fallback)

**Character:** A neutral grotesque for human-readable prose and headings, paired with a tabular monospace that gives every label, number, and verdict the aligned, typed feel of a ledger column. The contrast is the point: prose is quiet, data is precise.

### Hierarchy
- **Display** (Inter 600, clamp 22–30px, line-height 1.1, tracking -0.02em): Step headings ("Technician", "Appliance"). Tight, confident, never large enough to scroll.
- **Title** (Inter 600, 17px): Final-screen card headings.
- **Body** (Inter 400, 12.5–14px, line-height ~1.5): Hints and prose, capped near 62ch.
- **Label** (IBM Plex Mono 500, 10px, uppercase, tracking 0.12em, soft grey): Every field label, the wordmark, region tag, step count, due-date label.
- **Value / Data** (IBM Plex Mono 400, 11–14px): All input values, measurement numbers, verdicts, document lists. Verdicts are 600 weight with 0.06em tracking.

### Named Rules
**The Tabular Data Rule.** Anything the technician measures, enters, or reads back as a value is set in IBM Plex Mono — never the proportional face. Labels are mono uppercase; values are mono sentence-case.
**The Quiet Prose Rule.** Hints and explanatory text stay in Inter and stay short. The interface explains in one line, then gets out of the way.

## Layout

A single centered column, max-width 780px, full dynamic viewport height (`100dvh`) with `overflow:hidden` at the document level. The app is a flex column of three fixed regions: header (64px), a scrolling stage, and footer (64px). Only the stage scrolls; chrome never moves.

Fields flow in a grid: one column on phone, two columns at ≥560px, with a hard single-column collapse at ≤520px. Related full-width blocks (measurement tables, warnings, the final card) span all columns via `grid-column: 1/-1`. Vertical rhythm is tight — 11px field gaps, 16px column gaps, 20px side gutters.

The footer is the fixed action bar: Back on the left, Continue pushed to the right (`margin-left:auto`), with a monumental next-due date (`+1 yr` / `+2 ans` etc.) as the right-aligned focal readout when present. The header carries a 4px signal-red rule, the wordmark, the region tag, a segmented progress rail, and a `2 / 6` step count.

## Elevation & Depth

Flat by default. There are **no drop shadows** anywhere in the system and no border-radius. Depth is conveyed entirely by hairline rules (1px #c9c7bf) and two tonal bands (the header/footer #eceae3 against the paper stage). Layering is implied by ruled separation, not by lift.

### Named Rules
**The Flat-By-Default Rule.** Surfaces sit flush on the paper. Nothing floats. Separation is a hairline, never a shadow.
**The Lit-Edge Exception.** The only non-hairline emphasis is the measurement row's warning state, marked by an inset 3px signal-red left edge (`box-shadow: inset 3px 0 0`) — a margin annotation, not a drop shadow.

## Shapes

Entirely square. Corner radius is 0 across every element — buttons, inputs, chips, cards, selects. Form language is the ruled line: text inputs are borderless with a single 1px bottom underline that turns signal red on focus; buttons are 1px-outlined rectangles; chips are 1px-outlined rectangles that invert to solid ink when selected. Borders are always 1px hairline. There is no clipping, no pill, no soft corner anywhere.

## Components

### Buttons
- **Shape:** Square (0px radius), 1px border, IBM Plex Mono 12px uppercase-ish with 0.06em tracking.
- **Primary (Continue):** Signal red fill (#b23a2b), paper text, `padding:10px 16px`, 600 weight, pinned right in the footer.
- **Back:** Transparent fill, hairline border, soft-grey text. Quiet, secondary.
- **Focus:** 2px signal-red outline with 2px offset (`:focus-visible`) — the shared focus treatment across all controls.
- **Disabled:** 40% opacity, not-allowed cursor.

### Chips / Choices
- **Style:** 1px hairline border, transparent ground, mono 11px, `padding:7px 10px`. Wraps as a flex row.
- **Selected:** Inverts to solid ink-black fill with paper text; a `.red` variant inverts to signal red for consequential choices.
- **State:** Driven by `aria-pressed`.

### Cards / Containers
- **The Final Card:** 1px hairline border on a translucent paper wash (`rgba(255,255,255,.35)`), square corners, no shadow. Holds the output summary and a mono document list separated by hairlines.

### Inputs / Fields
- **Style:** Borderless, single 1px bottom underline (hairline), transparent ground, mono 14px. Uppercase mono label above; required fields get a red `*`.
- **Focus:** Underline turns signal red; no outline, no glow.
- **Error:** Underline turns signal red and a mono red error line appears beneath the field.

### Measurement Rows (signature component)
- **Style:** A ruled grid row — label on the left, numeric input right-aligned in mono, verdict in a fixed column. Top and bottom hairlines form the ledger rule.
- **States:** Pending rows use a dashed underline; a warning row gets the inset 3px red left edge; the verdict reads OK (green), NON OK (red), or idle (soft grey).

### Navigation / Progress
- **Progress rail:** A row of 3px segments — hairline for pending, ink for done, signal red for the current step — above a mono `2 / 6` count.
- **Header:** 4px signal-red top rule, mono wordmark "ATTESTA" (0.22em tracking), red uppercase region tag.
- **Footer:** Fixed 64px band, hairline top border, Back/Continue/due-date layout. No mobile drawer — this is a single linear flow.

## Do's and Don'ts

### Do:
- **Do** set every label, value, and verdict in IBM Plex Mono; reserve Inter for headings and one-line hints.
- **Do** keep corners square (0px) and rely on 1px hairlines and the two tonal bands for all structure.
- **Do** resolve each measurement row to an explicit OK / NON OK verdict; that resolution is the product's signature.
- **Do** hold the fixed header, footer, and progress rail steady while only the stage scrolls.
- **Do** reserve signal red for control, focus, warning, or NON OK — honor The One Signal Rule.

### Don't:
- **Don't** introduce drop shadows, border-radius, gradients, or pill shapes — the system is flat, square, and ruled.
- **Don't** set measured data in the proportional (Inter) face.
- **Don't** use verdict green for anything except a resolved OK row.
- **Don't** let the working area scroll the whole page or move the footer Continue button.
- **Don't** invent a soft SaaS look (floating rounded buttons, card shadows, purple accents) — it is the explicit anti-reference.