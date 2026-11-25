// Pure helpers for bilingual wizard labels. Stored values are never translated:
// a select option carries a canonical `v` and a display label pair `l`.
export const isBilingual = v => v && typeof v==='object' && !Array.isArray(v) && ('nl' in v || 'fr' in v);

export function resolved(v,lang='nl'){
  return isBilingual(v)?(v[lang]??v.nl??''):(v??'');
}

export function optionValue(o){ return typeof o==='string'?o:o.v; }
export function optionLabel(o,lang='nl'){ return typeof o==='string'?o:resolved(o.l,lang); }
export function optionValues(f){ return (f.options||[]).map(optionValue); }
