// Wallonia pieces renderer — builds a fresh 9-page A4 attestation from
// reusable pieces (no overlay, no hardcoded per-field coordinates).
// Pages 1-4: drawn piece-by-piece with cursor-driven layout.
// Pages 5-9: static reference content (footnotes, logigrams, category table)
// appended from the official blank template since they carry no user data.
// French only.

import { walloniaPieces as P } from './wallonia-pieces.js';
import { walloniaComputed } from './wallonia.js';

const BLANK_URL = 'assets/wa-attestation-blank.pdf';
const LOGOS = {
  wallonie: 'assets/logos/wallonie.jpg',
  dgo4: 'assets/logos/dgo4.png',
  airClimat: 'assets/logos/air-climat.jpg',
};

async function loadFontBytes() {
  const r = await fetch('vendor/DejaVuSans.ttf');
  if (!r.ok) throw new Error('Font file could not be loaded');
  return new Uint8Array(await r.arrayBuffer());
}

async function loadImageBytes(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  return new Uint8Array(await r.arrayBuffer());
}

export async function buildWalloniaPieces(data, audit) {
  const { PDFDocument, rgb } = globalThis.window.PDFLib;
  const fontBytes = await loadFontBytes();
  const doc = PDFDocument.create();
  const font = await doc.embedFont(fontBytes, { subset: true });
  P.fontRef.regular = font;
  P.fontRef.bold = font;
  P.A = audit || { printed: [], ticked: [], warnings: [], omitted: [], clipped: [] };

  const d = walloniaComputed(data);
  const pnomKw = Number(d.powerKw || 0);

  // ---- load logos ----
  const logoBytes = {};
  for (const [key, url] of Object.entries(LOGOS)) {
    const bytes = await loadImageBytes(url);
    if (bytes) logoBytes[key] = bytes;
  }
  const logos = {};
  if (logoBytes.wallonie) logos.wallonie = await doc.embedJpg(logoBytes.wallonie);
  if (logoBytes.dgo4) logos.dgo4 = await doc.embedPng(logoBytes.dgo4);
  if (logoBytes.airClimat) logos.airClimat = await doc.embedJpg(logoBytes.airClimat);

  // Helper: add a blank A4 page
  const addPage = () => doc.addPage([P.W, P.H]);

  // ================= PAGE 1 =================
  let p1 = addPage();
  let y = 30;
  y = P.drawMasthead(p1, logos, y);
  y = P.drawControlId(p1, d.controlDate, d.attestNumber, y);
  y += 8;
  y = P.drawTechnicianBlock(p1, d, y);
  y += 6;
  y = P.drawDemandeurBlock(p1, d, y);
  y += 6;
  y = P.drawCombustiblesBlock(p1, d, y);
  y += 6;
  y = P.drawGeneratorBlock(p1, d, y);
  P.footer(p1, 1);

  // ================= PAGE 2 =================
  let p2 = addPage();
  y = 30;
  y = P.drawVentilationBlock(p2, d, y);
  y += 6;
  y = P.drawOrificesBlock(p2, d, y);
  y += 6;
  y = P.drawMeasurementTable(p2, d, y);
  y += 6;
  y = P.drawTechInfoBlock(p2, d, y);
  y += 6;
  y = P.drawDeclarationBlock(p2, d, y);
  P.footer(p2, 2);

  // ================= PAGE 3 =================
  let p3 = addPage();
  y = 30;
  y = P.drawDiagnosticTree(p3, d, y, pnomKw);
  y += 6;
  y = P.drawRegulationBlock(p3, d, y);
  P.footer(p3, 3);

  // ================= PAGE 4 =================
  let p4 = addPage();
  y = 30;
  y = P.drawFollowUpBlock(p4, d, y);
  y += 8;
  y = P.drawSignatureBlock(p4, d, y);
  y += 8;
  y = P.drawAttentionNotice(p4, d, y);
  P.footer(p4, 4);

  // ================= PAGES 5-9 (static reference) =================
  let refDoc;
  try {
    const res = await fetch(BLANK_URL);
    if (!res.ok) throw new Error('blank template not found');
    refDoc = await PDFDocument.load(await res.arrayBuffer());
  } catch (e) {
    audit.warnings.push('wa-attestation-blank.pdf missing — pages 5-9 omitted');
    refDoc = null;
  }
  if (refDoc) {
    const totalRef = refDoc.getPageCount();
    // Blank is 9 pages; pages 5-9 (indices 4-8) are the static reference.
    const start = 4;
    for (let i = start; i < totalRef; i++) {
      const [copied] = await doc.copyPages(refDoc, [i]);
      doc.addPage(copied);
    }
  }

  // Renumber footers on appended pages (they carry "1 / 9"…"9 / 9" from blank;
  // we re-stamp the correct page index on top). Simpler: leave blank's own
  // numbering since it matches 1/9..9/9 already.

  const pdfBytes = await doc.save();
  audit.template = { model: 'wallonia-pieces', pages: doc.getPageCount() };
  return pdfBytes;
}
