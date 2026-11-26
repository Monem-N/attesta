# Attesta

Attesta is a static, offline-capable wizard for preparing heating-control attestations in Wallonia, Flanders, and Brussels.

## Run locally

ES modules and PDF assets require an HTTP origin. No backend or build step is needed:

```powershell
npm start
```

Open `http://localhost:4173`. The static server is only a local development convenience; production can be deployed to GitHub Pages or a static host.

## Tests

```powershell
npm test
```

The current tests cover regional deadline rules. Browser, PDF-render, and PWA coverage are not yet included.

## Structure

- `index.html`, `styles.css`, `app.js`: wizard shell, state, navigation, validation, and UI.
- `regions/*.js`: region-specific steps, recognition rules, and due-date calculations.
- `output.js`: official-model PDF loading, overlays, Brussels payload creation, and optional attachment/annex handling.
- `signature.js`: optional handwritten signature pad (pointer events, pressure/velocity ink) and its PNG/typed rendering.
- `assets/`: official source and converted PDF models.
- `docs/field-matrix.md`: PDF field anchors and model inventory.
- `sw.js`, `manifest.webmanifest`: PWA caching and installation metadata.

## Signature field

Optional in all three regions. The technician can draw with mouse, finger or
stylus, or type a name; the mark is rendered on the printed attestation and, for
the Brussels solid-fuel PDF, embedded in the document. Stored value is
`{v:1,strokes:[…]}` or `{v:1,typed:"Name"}` — never a PNG (regenerated on demand).

It is **not** a qualified electronic signature (eIDAS). Strokes are personal
data: everything stays in the browser (localStorage), nothing is logged or sent
over the network, and the Brussels gas/liquid JSON omits the signature.

## Important output limitations

Official-model PDF overlays are not yet coordinate-tuned or legally reviewed. Review every preview against the official model before professional use. Flanders VEKA reference and date are required before export. Brussels gas/liquid output is a JSON preparation aid for manual re-keying, not a proprietary `.attest` import file. Upload contents are appended to PDF outputs when supported and are listed as attachment metadata in Brussels JSON payloads.

Model coordinates and official backgrounds must be rechecked whenever an authority changes or replaces a form.
