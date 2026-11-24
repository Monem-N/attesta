#!/usr/bin/env python3
"""Build a blank official-layout Wallonia template from the accepted reference
(Zied.pdf) — the official published AWAC form (branded header + 3 logos).

Removal strategy
  1. Font pass: Roboto-Medium spans are entered values; NotoSans ✓/● are entered
     check marks. Redact them (keep preprinted → routing arrows).
  2. Residual pass: a few values were typed in Roboto-Regular (company, phone,
     e-mail, BCE, analyser, signature). Redact those exact spans by (page,text).
  3. Page-4 date pass: the "prochaines interventions" dates are typed inline in a
     Roboto-Regular span together with the label and dotted line. Redact only the
     date characters (char-level rects) so label + dots survive.

Run:  python tools/build-wa-blank.py
"""
import re
import fitz

REF = r"C:\Users\MonemNaifer\Downloads\Zied.pdf"
OUT = r"C:\zied\assets\wa-attestation-blank.pdf"
ENTERED_MARKS = {"\u2713", "\u25cf"}          # ✓  ●
DATE_RE = re.compile(r"\d{2}/\d{2}/\d{4}")

# (page_index, exact span text) typed in Roboto-Regular but still entered data.
RESIDUAL = {
    (0, "Joffage"), (0, "0486797724"), (0, "Info@joffage.be"),
    (0, "BE0773.540.950"), (0, "Joffage"),
    (1, "BLUELYZER ST"), (1, "06-44-01189"),
    (3, "Zied BEN AMARA"), (3, "Rit"),
}

doc = fitz.open(REF)
removed_values = removed_marks = removed_residual = removed_dates = 0

for pi, page in enumerate(doc):
    # 1. font pass -----------------------------------------------------------
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                font, txt = s["font"], s["text"].strip()
                if not txt:
                    continue
                if "Medium" in font or (("Noto" in font) and (txt in ENTERED_MARKS)):
                    page.add_redact_annot(fitz.Rect(s["bbox"]))
                    if "Medium" in font:
                        removed_values += 1
                    else:
                        removed_marks += 1

    # 2. residual Roboto-Regular data spans ---------------------------------
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                if (pi, s["text"].strip()) in RESIDUAL:
                    page.add_redact_annot(fitz.Rect(s["bbox"]))
                    removed_residual += 1

    # 3. page-4 inline dates (char-level) -----------------------------------
    for b in page.get_text("rawdict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                if "Noto" in s["font"]:
                    continue
                text = "".join(c["c"] for c in s["chars"])
                if not DATE_RE.search(text):
                    continue
                # accumulate char rects that belong to a date
                run = []
                for c in s["chars"]:
                    ch = c["c"]
                    if ch.isdigit() or ch == "/":
                        run.append(fitz.Rect(c["bbox"]))
                    else:
                        if run:
                            page.add_redact_annot(run[0] | run[-1] if len(run) > 1 else run[0])
                            for r in run[1:]:
                                pass
                            removed_dates += 1
                            run = []
                if run:
                    page.add_redact_annot(run[0] | run[-1])
                    removed_dates += 1

    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)

doc.save(OUT, garbage=3, deflate=True)
print(f"saved {OUT}: values={removed_values} marks={removed_marks} "
      f"residual={removed_residual} date-runs={removed_dates} pages={doc.page_count}")