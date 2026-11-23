// Shared checkbox/verdict vocabulary. All regions, all models.
// Returns 0 for the affirmative/first printed box, 1 for the negative/second,
// or null when the value is not a binary tick and should be written as text.
const TRUE_RE=/^(goed en veilig|oui|yes|ja|conforme|goed|ok|aanwezig|present|vrai|true|1)$/i;
const FALSE_RE=/^(niet goed|niet veilig|niet ok|non conforme|non|no|nee|niet|afwezig|absent|faux|false|0)$/i;

export function binaryIndex(value){
  if(value==null||typeof value==='boolean') return null;
  const s=String(value).trim().toLowerCase().replace(/\s+/g,' ');
  if(TRUE_RE.test(s)) return 0;
  if(FALSE_RE.test(s)) return 1;
  return null;
}

export function normalizeBinary(value){
  const i=binaryIndex(value);
  return i===0?'OUI':i===1?'NON':null;
}
