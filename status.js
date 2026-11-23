// Distinct document states. "Submitted" is asserted by the user, never inferred
// from a PDF download or from a manually entered VEKA reference.
export const STATUSES=['Draft','Prepared','Issued','Registered','Submitted'];

export const isComplete=s=>!!s&&s!=='Draft';
export const isSubmitted=s=>s==='Submitted';

export function statusOnIssue(region){
  if(region==='flanders') return 'Registered'; // reference entered by user, not verified
  if(region==='brussels') return 'Issued';
  return 'Issued';
}
export function statusOnHandoff(region){
  return region==='brussels'?'Prepared':'Draft';
}
export function statusText(s,t){
  return ({Draft:t.statusDraft,Prepared:t.statusPrepared,Issued:t.statusIssued,
    Registered:t.statusRegistered,Submitted:t.statusSubmitted})[s]||t.statusDraft;
}
