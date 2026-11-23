// Pure rendering helpers shared by the PDF writer. No browser globals here so
// they can be unit-tested in Node.

// All official models used here are A4 portrait unless noted; the renderer
// uses the real page size for bounds checks (see br-1mw-annex landscape).
export const PORTRAIT = {w:595.32, h:841.92};

const TRUE_LABEL = {flanders:'Ja', wallonia:'OUI', brussels:'OUI'};
const FALSE_LABEL = {flanders:'Nee', wallonia:'NON', brussels:'NON'};

export const WA_OUTCOME={
  'CONFORME':'OUI','NON CONFORME':'NON',
  'Goed en veilig':'OK','Niet goed':'non OK','Niet veilig':'non OK',
};

export function formatScalar(value, region){
  if(value==null) return '';
  if(typeof value==='boolean') return value?TRUE_LABEL[region]:FALSE_LABEL[region];
  if(region==='wallonia' && WA_OUTCOME[value]) return WA_OUTCOME[value];
  const s=String(value).trim();
  // ISO dates are an internal format; official models use DD/MM/YYYY.
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m?`${m[3]}/${m[2]}/${m[1]}`:s;
}

export function formatValue(value, region){
  if(Array.isArray(value)) return value.map(v=>formatScalar(v,region)).join(', ');
  return formatScalar(value,region);
}

// Wrap to a measured width. `measure(text)` is supplied by pdf-lib's font.
export function wrapText(text, measure, maxWidth, maxLines=3){
  const words=String(text).split(/\s+/).filter(Boolean);
  const lines=[]; let current='';
  for(const word of words){
    const next=current?`${current} ${word}`:word;
    if(measure(next)<=maxWidth || !current){ current=next; }
    else{ lines.push(current); current=word; }
  }
  if(current) lines.push(current);
  if(maxLines && lines.length>maxLines){
    const kept=lines.slice(0,maxLines);
    // Keep the overflow visible with an ellipsis rather than losing it silently.
    let last=kept[maxLines-1];
    while(last && measure(`${last}…`) > maxWidth) last=last.slice(0,-1);
    kept[maxLines-1]=`${last}…`;
    return {lines:kept, clipped:true};
  }
  return {lines, clipped:false};
}

export function fieldWidth(key, pageWidth, x, overrides={}){
  const wanted=overrides[key] || (/^(defects|remarks|causes|recommendations|diagnosis)/i.test(key)?280
    : /^(client[A-Z]|company|address|techName)/.test(key)?230:210);
  return Math.max(40,Math.min(wanted,pageWidth-x-24));
}

export function boundsWarnings(pageWidth,pageHeight,x,yTop,width,height){
  const out=[];
  if(x<0||x+width>pageWidth) out.push(`horizontal overflow at x=${x.toFixed(1)}, width=${width.toFixed(1)}`);
  if(yTop<0||yTop+height>pageHeight) out.push(`vertical overflow at y=${yTop.toFixed(1)}, height=${height.toFixed(1)}`);
  return out;
}

export function emptyAudit(){
  return {printed:[], ticked:[], omitted:[], clipped:[], warnings:[], template:null};
}
