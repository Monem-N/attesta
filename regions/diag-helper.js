// Interactive diagnostic logigramme helper for the Wallonia wizard.
// The technician walks the A→E decision tree; each answer writes the matching
// diag* field, and the outcome (effectuer / attendre / en ordre) is derived.
// The five diag* selects on the Déclaration step stay in sync (same data).

const QUESTIONS = [
  ['A', 'diagReport', 'Un rapport de diagnostic approfondi est-il présent ?', 'OUI → point B · NON → point C'],
  ['B', 'diagModified', 'Modification du système ou des exigences depuis le dernier diagnostic ?', 'OUI → point D · NON → installation en ordre (sortie)'],
  ['C', 'diagAfter2015', 'Modification après le 30/04/2015 ?', 'OUI → point D · NON → point E'],
  ['D', 'diagTwoYears', 'Au moins 2 ans depuis la modification ?', 'OUI → effectuer le diagnostic · NON → attendre le 1er contrôle après 2 ans'],
  ['E', 'diagDeferred', 'Le diagnostic a-t-il déjà été reporté ?', 'OUI → effectuer · NON → effectuer (report unique toléré)'],
];

export function diagOutcome(d) {
  const A = d.diagReport, B = d.diagModified, C = d.diagAfter2015, D = d.diagTwoYears, E = d.diagDeferred;
  if (A === 'OUI') {
    if (B === 'NON') return { cls: 'ok', t: 'Installation en ordre', d: 'Aucune modification depuis le dernier diagnostic — en ordre jusqu’au prochain contrôle périodique.' };
    if (D === 'OUI') return { cls: 'ok', t: 'Effectuer un diagnostic approfondi', d: 'Modification depuis ≥ 2 ans — diagnostic à réaliser, installation ensuite en ordre.' };
    if (D === 'NON') return { cls: 'warn', t: 'Attendre', d: 'Modification depuis < 2 ans — attendre le 1er contrôle périodique après ces 2 ans.' };
  } else if (A === 'NON') {
    if (C === 'OUI') {
      if (D === 'OUI') return { cls: 'ok', t: 'Effectuer un diagnostic approfondi', d: 'Modification après le 30/04/2015, depuis ≥ 2 ans — diagnostic à réaliser.' };
      if (D === 'NON') return { cls: 'warn', t: 'Attendre', d: 'Modification après le 30/04/2015, depuis < 2 ans — attendre le 1er contrôle après 2 ans.' };
    }
    if (E === 'OUI') return { cls: 'ok', t: 'Effectuer un diagnostic approfondi', d: 'Diagnostic déjà reporté — à réaliser, installation en ordre.' };
    if (E === 'NON') return { cls: 'ok', t: 'Effectuer un diagnostic approfondi', d: 'Report toléré une seule fois — diagnostic à réaliser au prochain contrôle périodique.' };
  }
  return { cls: '', t: 'Répondez aux questions', d: 'Le résultat se calcule automatiquement en suivant l’arbre A → E.' };
}

const STYLE = `<style>
.dh{border:1px solid var(--border,#d8d8d8);padding:10px 12px;margin:0 0 14px;background:var(--card,#fff)}
.dh-head{font-weight:700;font-size:13px;margin-bottom:8px;color:var(--foreground,#111)}
.dh-note{font-weight:400;font-size:11px;color:var(--muted-foreground,#666)}
.dh-q{display:grid;grid-template-columns:18px 1fr auto;gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--border,#eee)}
.dh-l{font-weight:700;color:var(--muted-foreground,#666)}
.dh-t{font-size:12.5px}.dh-r{font-size:10.5px;color:var(--muted-foreground,#666);margin-top:1px}
.dh-b{display:flex;gap:6px}
.dh-btn{border:1px solid var(--border,#ccc);background:var(--secondary,#f5f5f5);padding:4px 10px;min-height:24px;font-size:11.5px;font-weight:600;cursor:pointer;color:var(--foreground,#111)}
.dh-btn.on{background:var(--ink,#111);color:var(--paper,#fff);border-color:transparent}
.dh-out{margin-top:10px;padding:9px 11px;border:1px solid var(--border,#ddd);background:transparent;font-size:12.5px}
.dh-out.ok{border-color:var(--ink,#111)}
.dh-out.warn{border-color:var(--red,#b23a2b)}
.dh-out div{font-size:11.5px;color:var(--muted-foreground,#555);margin-top:2px}
</style>`;

export function diagHelperHTML(d) {
  const rows = QUESTIONS.map(([L, k, q, route]) => {
    const v = d[k];
    const btn = val => `<button type="button" class="dh-btn ${v === val ? 'on' : ''}" aria-pressed="${v === val}" data-dk="${k}" data-dv="${val}">${val}</button>`;
    return `<div class="dh-q"><div class="dh-l">${L}</div>
      <div><div class="dh-t">${q}</div><div class="dh-r">${route}</div></div>
      <div class="dh-b">${btn('OUI')}${btn('NON')}</div></div>`;
  }).join('');
  const o = diagOutcome(d);
  return STYLE + `<div class="dh"><div class="dh-head">Logigramme — diagnostic approfondi <span class="dh-note">(si P<sub>nom</sub> &gt; 20 kW)</span></div>${rows}
    <div class="dh-out ${o.cls}"><b>${o.t}</b><div>${o.d}</div></div></div>`;
}

export function wireDiagHelper(root, onChange) {
  root.querySelectorAll('.dh-btn').forEach(b =>
    b.addEventListener('click', () => onChange(b.dataset.dk, b.dataset.dv)));
}