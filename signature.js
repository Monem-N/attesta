/**
 * signature.js — Zone de signature manuscrite (souris / doigt / stylet).
 * Module ES autonome, zéro dépendance, offline-first (aucun réseau, aucun CDN).
 *
 * Couche 1 : cœur pur exporté, importable sous Node (tests `node --test`).
 * Couche 2 : adaptateur DOM `createSignaturePad(canvas, opts)`.
 *
 * Format persisté (draft localStorage) :
 *   { v: 1, strokes: [{ points: [[x, y, p], …] }] }
 *   x, y ∈ [0,1] normalisés à la taille CSS du canvas (indépendants DPI / resize) ;
 *   p ∈ [0,1] : pression stylet réelle, sinon estimation par vitesse (trait effilé).
 * Le PNG produit n'est PAS une signature électronique opposable (eIDAS).
 */

export const DATA_VERSION = 1;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const INVISIBLE = /[\p{Cc}\p{Cf}]/gu;

/** Texte tapé : NFC, sans caractères de contrôle/format, espaces extérieurs retirés. */
function normalizeTyped(value) {
  return typeof value === 'string' ? value.normalize('NFC').replace(INVISIBLE, '').trim() : '';
}

/** Nombre fini depuis un JSON persisté ; refuse les objets et les booléens. */
function finiteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Structure vide sérialisable. */
export function emptyData() {
  return { v: DATA_VERSION, strokes: [], typed: '' };
}

/** Normalise des données de draft ; tolérant aux données corrompues ou anciennes. */
export function normalizeData(raw) {
  const out = emptyData();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  out.typed = normalizeTyped(raw.typed);
  if (!Array.isArray(raw.strokes)) return out;
  for (const s of raw.strokes) {
    if (!s || !Array.isArray(s.points)) continue;
    const pts = [];
    for (const p of s.points) {
      if (!Array.isArray(p) || p.length < 2) continue;
      const x = finiteNumber(p[0]), y = finiteNumber(p[1]);
      if (x === null || y === null) continue;
      const pressure = p.length > 2 ? finiteNumber(p[2]) : null;
      const pr = pressure === null ? 0.5 : clamp(pressure, 0, 1);
      pts.push([clamp(x, 0, 1), clamp(y, 0, 1), pr]);
    }
    if (pts.length) out.strokes.push({ points: pts });
  }
  return out;
}

/** Décimation à la sérialisation : extrémités gardées + points à ≥ minDist du dernier gardé. */
export function decimatePoints(points, minDist = 0.002) {
  if (points.length <= 2) return points.map((p) => p.slice());
  const kept = [points[0].slice()];
  for (let i = 1; i < points.length - 1; i++) {
    const a = kept[kept.length - 1], b = points[i];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) >= minDist) kept.push(b.slice());
  }
  kept.push(points[points.length - 1].slice());
  return kept;
}

/** Longueur d'un trait (unités normalisées). */
export function strokeLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return len;
}

/** Encre totale (somme des traits). */
export function totalInkLength(data) {
  return data.strokes.reduce((t, s) => t + strokeLength(s.points), 0);
}

/** Vide si encre totale < seuil : un tap accidentel ne compte pas comme signature. */
export function isSignatureEmpty(data, minInkLength = 0.05) {
  const d = normalizeData(data);
  if (d.typed.trim() !== '') return false;
  return totalInkLength(d) < minInkLength;
}

/** Undo pur : copie sans le dernier trait (pas de mutation). */
export function undoStroke(data) {
  return { v: DATA_VERSION, strokes: data.strokes.slice(0, -1), typed: data.typed || '' };
}

/** Vrai pour une dataURL PNG base64 (garde-fou avant injection DOM). */
export function isPngDataURL(value) {
  return typeof value === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value);
}

/**
 * Fit « contain » dans une boîte (origine haut-gauche) sans déformation.
 * Retourne {x, y, width, height} centré dans la boîte.
 */
export function containFit(box, width, height) {
  const bw = Math.max(1, box.w), bh = Math.max(1, box.h);
  const iw = Math.max(1, width), ih = Math.max(1, height);
  const scale = Math.min(bw / iw, bh / ih);
  const w = iw * scale, h = ih * scale;
  return { x: box.x + (bw - w) / 2, y: box.y + (bh - h) / 2, width: w, height: h };
}

/* ------------------------------------------------------------------ */
/* Rendu partagé (adaptateur DOM + export PNG hors écran)              */
/* ------------------------------------------------------------------ */

function widthAt(p, i, n, o) {
  // Symmetric taper: both ends thin out, the body keeps the pressure width.
  const taper = Math.max(0.35, Math.min(1, (i + 1) / 2, (n - i) / 2));
  return (o.minWidth + (o.maxWidth - o.minWidth) * p[2]) * taper;
}

function drawStroke(ctx, pts, w, h, o) {
  const n = pts.length;
  if (!n) return;
  const X = (i) => pts[i][0] * w, Y = (i) => pts[i][1] * h;
  ctx.strokeStyle = o.color; ctx.fillStyle = o.color;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (n === 1) { // tap isolé : petit point (ignoré par isEmpty)
    ctx.beginPath();
    ctx.arc(X(0), Y(0), (o.minWidth + o.maxWidth) / 4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  for (let i = 0; i < n; i++) {
    const ax = i === 0 ? X(0) : (X(i - 1) + X(i)) / 2;
    const ay = i === 0 ? Y(0) : (Y(i - 1) + Y(i)) / 2;
    const bx = i === n - 1 ? X(n - 1) : (X(i) + X(i + 1)) / 2;
    const by = i === n - 1 ? Y(n - 1) : (Y(i) + Y(i + 1)) / 2;
    ctx.beginPath();
    ctx.lineWidth = widthAt(pts[i], i, n, o);
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(X(i), Y(i), bx, by);
    ctx.stroke();
  }
}

/* ------------------------------------------------------------------ */
/* Adaptateur DOM                                                      */
/* ------------------------------------------------------------------ */

export function createSignaturePad(canvas, opts = {}) {
  const o = {
    color: '#111111',
    minWidth: 0.8,           // px CSS
    maxWidth: 2.6,           // px CSS
    backgroundColor: null,   // null = PNG transparent (requis pour le PDF)
    minInkLength: 0.05,      // seuil isEmpty (unités normalisées)
    decimateDist: 0.002,     // seuil de décimation à la sérialisation
    ...opts,
  };
  const onChange = typeof o.onChange === 'function' ? o.onChange : null;

  const ctx = canvas.getContext('2d');
  let data = emptyData();
  let cssW = 0, cssH = 0, dpr = 1;
  let active = null;          // trait en cours
  let penUntil = 0;           // rejet de paume : touche ignorée peu après un stylet
  let raf = 0;
  let destroyed = false;

  canvas.style.touchAction = 'none';        // bloque le scroll pendant le tracé
  canvas.style.userSelect = 'none';
  canvas.style.webkitUserSelect = 'none';

  function redraw() {
    ctx.clearRect(0, 0, cssW, cssH);
    for (const s of data.strokes) drawStroke(ctx, s.points, cssW, cssH, o);
    if (active) drawStroke(ctx, active.points, cssW, cssH, o);
  }

  function schedule() { // rendu complet batché (rAF) : largeurs cohérentes, aucun escalier
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      redraw();
    });
  }

  function resize() {
    if (destroyed) return;
    const w = canvas.clientWidth || 300, h = canvas.clientHeight || 150;
    const r = Math.max(1, Math.min(3, window.devicePixelRatio || 1)); // borné (mémoire)
    if (w === cssW && h === cssH && r === dpr) return;
    cssW = w; cssH = h; dpr = r;
    canvas.width = Math.round(w * r);   // réinitialise le bitmap…
    canvas.height = Math.round(h * r);
    ctx.setTransform(r, 0, 0, r, 0, 0); // …donc on repose la transformation
    redraw(); // données normalisées → le tracé survit à la rotation / au resize
  }

  function addPoint(e) {
    const rect = active.rect;
    const x = clamp((e.clientX - rect.left) / cssW, 0, 1);
    const y = clamp((e.clientY - rect.top) / cssH, 0, 1);
    const pts = active.points, prev = pts[pts.length - 1];
    let p;
    if (active.type === 'pen' && e.pressure > 0) {
      p = e.pressure; // pression réelle du stylet
    } else {
      // Doigt / souris : estimation par vitesse (px CSS / ms) — lent = épais, rapide = fin.
      const dt = Math.max(1, e.timeStamp - active.lastT);
      const v = Math.hypot((x - prev[0]) * cssW, (y - prev[1]) * cssH) / dt;
      p = 0.6 * active.lastP + 0.4 / (1 + 2 * v); // lissage exponentiel
    }
    active.lastT = e.timeStamp; active.lastP = p;
    pts.push([x, y, clamp(p, 0, 1)]);
  }

  function onDown(e) {
    if (destroyed || active || !e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return; // clic droit / molette
    if (e.pointerType === 'touch' && e.timeStamp < penUntil) return; // paume
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignoré */ }
    resize(); // canvas possiblement affiché / redimensionné depuis le dernier rendu
    const rect = canvas.getBoundingClientRect();
    const p0 = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
    active = {
      id: e.pointerId, type: e.pointerType, rect,
      points: [[clamp((e.clientX - rect.left) / cssW, 0, 1),
                clamp((e.clientY - rect.top) / cssH, 0, 1), p0]],
      lastT: e.timeStamp, lastP: p0,
    };
    schedule();
  }

  function onMove(e) {
    if (!active || e.pointerId !== active.id) return;
    e.preventDefault();
    // Échantillons intermédiaires (écrans 120 Hz+), fallback propre si absent.
    const evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
    for (const ev of evs && evs.length ? evs : [e]) addPoint(ev);
    schedule();
  }

  function onUp(e) {
    if (!active || e.pointerId !== active.id) return;
    // Only a real pointerup commits. pointercancel / lostpointercapture discard
    // the partial stroke (iOS scroll-cancel, OS interruption, palm rejection).
    const commit = e.type === 'pointerup';
    if (commit) addPoint(e);
    if (active.type === 'pen') penUntil = e.timeStamp + 300; // grâce anti-paume
    if (commit) data.strokes.push({ points: active.points });
    active = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    redraw();
    if (commit && onChange) onChange();
  }

  const prevent = (e) => e.preventDefault(); // menu contextuel (appui long mobile)

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('lostpointercapture', onUp);
  canvas.addEventListener('contextmenu', prevent);

  // ResizeObserver : couvre la rotation ET les changements du conteneur (fallback : resize).
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => resize());
    ro.observe(canvas);
  } else {
    window.addEventListener('resize', resize);
  }
  resize();

  return {
    toData() {
      return {
        v: DATA_VERSION,
        strokes: data.strokes.map((s) => ({ points: decimatePoints(s.points, o.decimateDist) })),
      };
    },
    fromData(raw) { // restauration silencieuse (pas d'onChange → pas de boucle de sauvegarde)
      data = normalizeData(raw);
      active = null;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      redraw();
    },
    toDataURL(type = 'image/png') {
      if (!o.backgroundColor) return canvas.toDataURL(type);
      const out = document.createElement('canvas');
      out.width = canvas.width; out.height = canvas.height;
      const c2 = out.getContext('2d');
      c2.fillStyle = o.backgroundColor;
      c2.fillRect(0, 0, out.width, out.height);
      c2.drawImage(canvas, 0, 0);
      return out.toDataURL(type);
    },
    clear() {
      data = emptyData(); active = null;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      redraw();
      if (onChange) onChange();
    },
    undo() {
      if (!data.strokes.length) return;
      data = undoStroke(data);
      redraw();
      if (onChange) onChange();
    },
    isEmpty() { return isSignatureEmpty(data, o.minInkLength); },
    resize,
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('lostpointercapture', onUp);
      canvas.removeEventListener('contextmenu', prevent);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', resize);
    },
  };
}

/** Construit {url, typed} prêt pour l'impression (null si vide). */
export function signatureFor(value, opts = {}) {
  const sig = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  if (!sig) return null;
  const normalized = normalizeData(sig);
  const typed = normalized.typed;
  const url = signatureDataURL(normalized, opts);
  if (!url && !typed) return null;
  return { url, typed };
}

/** Injecte l'image / le nom tapé dans un document HTML parsé (via DOM, jamais par chaîne). */
export function applySignatureToDocument(doc, signature) {
  if (!doc || !signature || typeof doc.querySelectorAll !== 'function') return;
  const hasImage = isPngDataURL(signature.url);
  const typed = hasImage ? '' : normalizeData({ typed: signature.typed }).typed;
  for (const img of doc.querySelectorAll('.sigimg')) {
    if (hasImage) {
      img.src = signature.url;
      img.hidden = false;
    } else {
      img.hidden = true;
    }
  }
  for (const span of doc.querySelectorAll('.sigtyped')) {
    if (typed) {
      span.textContent = typed;
      span.hidden = false;
    } else {
      span.hidden = true;
    }
  }
}

/**
 * Rendu PNG hors écran (pour l'impression HTML et le PDF). Retourne null sous
 * Node ou quand la signature est vide, afin que l'appelant puisse l'omettre.
 */
export function signatureDataURL(data, opts = {}) {
  if (typeof document === 'undefined') return null;
  const d = normalizeData(data);
  const typed = d.typed.trim();
  if (!d.strokes.length && !typed) return null;
  if (!typed && isSignatureEmpty(d, opts.minInkLength ?? 0.05)) return null;
  const w = opts.width || 600, h = opts.height || 200;
  const ratio = opts.ratio || 2;
  // Keep the ink visually as thick as on screen after the image is scaled down
  // into its (much smaller) PDF/HTML box.
  const lw = opts.lineScale || 1;
  const o = {
    color: opts.color || '#111111',
    minWidth: (opts.minWidth ?? 0.8) * lw,
    maxWidth: (opts.maxWidth ?? 2.6) * lw,
  };
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  if (opts.backgroundColor) {
    ctx.fillStyle = opts.backgroundColor;
    ctx.fillRect(0, 0, w, h);
  }
  for (const s of d.strokes) drawStroke(ctx, s.points, w, h, o);
  if (typed) {
    // Typed fallback is rasterised with the platform UI font (Unicode-safe) and
    // italic, so no extra font file has to be vendored.
    let size = opts.fontSize || Math.round(h * 0.55);
    const font = (px) => `italic ${px}px "DejaVu Sans", system-ui, sans-serif`;
    ctx.fillStyle = o.color;
    ctx.font = font(size);
    ctx.textBaseline = 'middle';
    while (size > 6 && ctx.measureText(typed).width > w * 0.94) {
      size -= 1;
      ctx.font = font(size);
    }
    ctx.fillText(typed, w * 0.03, h / 2);
  }
  return canvas.toDataURL('image/png');
}