// Clean Wallonia attestation renderer.
// Generates a 4-page document from the collected data instead of overlaying
// the official template. The official model remains the source of truth for
// which facts must appear; instruction pages, footnotes, logigrams and the
// post-signature ATTENTION block are deliberately not reproduced.
import {evaluateCriteria} from './wallonia-criteria.js';
import {wrapText} from './pdf-render.js';
const {PDFDocument,rgb}=globalThis.window?.PDFLib||{};

const W=595.32, H=841.92, M=42, RIGHT=W-M;
const ink=rgb(0.086,0.094,0.114), soft=rgb(0.38,0.40,0.43), red=rgb(0.698,0.227,0.169),
      green=rgb(0.184,0.42,0.31), line=rgb(0.78,0.78,0.75), paper=rgb(1,1,1);

function yOf(page,v){ return page.getHeight()-v; }
function text(page,s,x,y,size,font,color=ink,maxWidth){
  const v=String(s??'');
  if(!v) return;
  if(maxWidth&&font.widthOfTextAtSize(v,size)>maxWidth)
    A?.warnings.push(`text overflows ${maxWidth}pt: ${v.slice(0,40)}`);
  page.drawText(v,{x,y:yOf(page,y),size,font,color});
  recordText(v);
}
function recordText(v){
  if(A&&!A.printed.includes(`text:${v}`)) A.printed.push(`text:${v}`);
}
function rule(page,x1,y,x2,color=line,thickness=0.6){
  page.drawRectangle({x:x1,y:yOf(page,y),width:x2-x1,height:thickness,color});
}
function band(page,label,y){
  text(page,label,M,y,10.5,fontRef.regular,red);
  rule(page,M,y+14,RIGHT,red,1);
}
// The embedded font is stored here so the pure helpers can use it.
const fontRef={regular:null,bold:null};
let A=null; // active audit sink
function recordPrinted(v){ if(A&&v) A.printed.push(v); }
function recordTicked(v){ if(A&&v&&!A.ticked.includes(v)) A.ticked.push(v); }
function field(page,label,x,y,labelW,valueW,value,font,size=9){
  text(page,label,x,y,size,font,soft);
  const vx=x+labelW;
  rule(page,vx,y+2.5,vx+valueW);
  if(value===''||value==null) return;
  const raw=fmtDate(value);
  const {lines,clipped}=wrapText(raw,s=>font.widthOfTextAtSize(s,size),Math.max(20,valueW-4),2);
  lines.forEach((line,i)=>text(page,line,vx+2,y-0.5+i*(size+3),size,font,ink));
  if(A){
    recordText(raw);
    recordPrinted(`field:${label}`);
    if(clipped){ A.clipped.push(label); A.warnings.push(`${label}: value clipped to field width`); }
  }
}
function box(page,x,y,checked,label,font,silent=false){
  const s=8;
  page.drawRectangle({x,y:yOf(page,y+ s),width:s,height:s,borderColor:ink,borderWidth:0.8,color:paper});
  if(checked){
    page.drawRectangle({x:x+1.4,y:yOf(page,y+s-1.4),width:s-2.8,height:s-2.8,color:red});
    recordTicked(label);
  }
  if(label&&!silent) text(page,label,x+s+4,y,8.5,font,ink);
}
// Match a selected value to a printed option. Keys beginning with ^ are
// anchored regexes; other keys match on word boundaries. The longest matched
// key wins, so "non conforme" beats "conforme" and "gii" beats "gi".
function matchesOption(value,key){
  if(value==null||value===''||key==='') return false;
  const s=String(value).toLowerCase().trim();
  const k=String(key);
  if(k.startsWith('^')){ try{ return new RegExp(k,'i').test(s); }catch(e){ return false; } }
  const esc=k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(s);
}
function selectionFor(items,selected){
  if(selected==null||selected==='') return [];
  const hits=items.filter(([,k])=>k!==''&&k!=='*'&&matchesOption(selected,k));
  if(!hits.length) return []; // never fall back to a generic "agréé" box
  const longest=Math.max(...hits.map(([,k])=>String(k).length));
  const chosen=hits.filter(([,k])=>String(k).length===longest).map(([,k])=>k);
  // '*' is a companion box (e.g. the generic "Technicien agréé" beside
  // L/GI/GII): tick it only when a specific accredited level matched.
  if(items.some(([,k])=>k==='*')) chosen.push('*');
  return chosen;
}
function options(page,title,y,items,selected,font,startX=M+110){
  text(page,title,M,y,8.5,font,soft);
  let x=startX;
  const chosen=selectionFor(items,selected);
  for(const [label,key,xw] of items){
    const hit=chosen.includes(key);
    box(page,x,y,hit,label,font);
    x+=xw;
  }
}
function verdict(page,x,y,value,font,label='global'){
  if(value==null||value==='') return; // empty row stays blank (as on the approved form)
  const v=String(value);
  recordPrinted(`verdict:${label}:${v||'non déterminé'}`);
  const ok=/^(ok|oui|conforme)$/i.test(v), bad=/^(non ok|non conforme|niet ok)$/i.test(v);
  if(!ok&&!bad){ text(page,'non déterminé',x,y,8,font,soft); return; }
  text(page,ok?'OK':'NON OK',x,y,8.5,font,ok?green:red);
}

export async function renderWallonia(data,fontBytes,audit){
  const doc=await PDFDocument.create();
  if(globalThis.window?.fontkit) doc.registerFontkit(globalThis.window.fontkit);
  const font=await doc.embedFont(fontBytes,{subset:true});
  fontRef.regular=font; fontRef.bold=font;
  A=audit||{printed:[],ticked:[],warnings:[],omitted:[],clipped:[]};
  const d=data;

  /* ---------------- page 1 ---------------- */
  let p=doc.addPage([W,H]);
  text(p,"ATTESTA — CONTRÔLE PÉRIODIQUE",M,26,9,font,red);
  text(p,"Attestation de contrôle d’un générateur de chaleur",M,42,15,font,ink);
  rule(p,M,48,RIGHT,ink,1);
  let y=64;
  field(p,'Date du contrôle',M,y,95,90,fmtDate(d.controlDate),font);
  field(p,'N° attestation',300,y,80,140,d.attestNumber||'',font); y+=18;

  band(p,'Technicien',y); y+=20;
  options(p,'Agrément',y,[['Technicien agréé','*',165],['L','l',45],['GI','gi',45],['GII','gii',45]],d.techCategory,font); y+=18;
  box(p,M,y,!!/solide/i.test(d.techCategory||''),'Technicien spécialisé en combustibles solides',font); y+=18;
  field(p,'Nom et prénom',M,y,90,170,d.techName,font);
  field(p,'N° d’agrément',300,y,85,130,d.techAgrement,font); y+=18;
  field(p,'Nom entreprise',M,y,90,170,d.company,font);
  field(p,'N° BCE',300,y,85,130,d.bce,font); y+=18;
  field(p,'Téléphone',M,y,90,170,d.techPhone,font);
  field(p,'Courriel',300,y,85,130,d.techEmail,font); y+=18;

  band(p,'Demandeur du contrôle',y); y+=20;
  options(p,'',y,[['Propriétaire','propriétaire',180],['Locataire','locataire',180],['Autre','autre',180]],d.requester,font); y+=18;
  field(p,'Nom et prénom',M,y,90,170,d.clientName,font);
  field(p,'Entreprise',300,y,85,130,d.clientCompany,font); y+=18;
  const [street,number]=streetParts(d);
  field(p,'Rue',M,y,40,140,street,font);
  field(p,'Numéro',235,y,50,60,number,font); y+=18;
  field(p,'Téléphone',M,y,90,170,d.clientPhone,font);
  field(p,'Courriel',300,y,85,130,d.clientEmail,font); y+=18;
  field(p,'Code postal / localité',300,y,110,105,d.clientCity,font); y+=18;
  field(p,'Localisation du générateur',M,y,150,360,d.applianceLocation,font); y+=20;

  band(p,'Combustibles',y); y+=20;
  options(p,'Solide',y,[['Pellets bois','pellets',80],['Bûches','bûches',70],['Plaquettes','plaquettes',85],['Céréales','céréales',75],['Charbon','charbon',70]],d.fuelDetail,font); y+=18;
  options(p,'Liquide',y,[['Gasoil','^gasoil$',85],['Gasoil extra','gasoil extra',110],['Fuel lourd','fuel lourd',100]],d.fuelDetail,font); y+=18;
  options(p,'Gazeux',y,[['Gaz G20','g20',80],['Gaz G25','g25',80],['Propane','propane',80],['Butane','butane',75],['Biogaz','biogaz',75]],d.fuelDetail,font); y+=20;

  band(p,'Générateur et brûleur',y); y+=20;
  field(p,'Nombre de générateurs',M,y,130,70,d.genCount,font);
  field(p,'Puissance utile (kW)',300,y,120,100,d.powerKw,font); y+=18;
  field(p,'Année de construction',M,y,130,70,d.year,font);
  field(p,'Type de raccordement',300,y,120,100,d.raccordement,font); y+=18;
  field(p,'Marque',M,y,130,70,d.make,font);
  field(p,'Type',300,y,120,100,d.model,font); y+=18;
  field(p,'N° de série',M,y,130,70,d.serial,font);
  field(p,'Fluide caloporteur',300,y,120,100,d.fluid,font); y+=18;
  options(p,'Condensation',y,[['oui','oui',90],['non','non',90]],d.condensation,font); y+=18;
  options(p,'Allures',y,[['1 allure','1 allure',110],['plusieurs','plusieurs',120],['modulant','modulant',120]],d.burnerType,font); y+=18;
  options(p,'Brûleur',y,[['unit','unit',100],['air pulsé','air pulsé',130]],d.unitOrPulsed,font); y+=18;
  options(p,'Prémixage',y,[['prémix','^prémix',110],['non-premix','non-premix',140]],d.premix,font); y+=18;
  field(p,'Production de chaleur',M,y,130,140,d.production,font); y+=20;

  band(p,'Local, amenée d’air, évacuation des gaz',y); y+=20;
  options(p,'Ventilation du local',y,[['OUI','oui',90],['NON','non',90]],d.ventLocal,font); y+=18;
  options(p,'Amenée d’air',y,[['OUI','oui',90],['NON','non',90]],d.airSupply,font); y+=18;
  options(p,'Évacuation des gaz',y,[['OUI','oui',90],['NON','non',90]],d.flue,font);
  field(p,'Permis d’urbanisme',300,y,110,160,d.permisDate,font); y+=18;
  options(p,'Orifices de mesure',y,[['Dispensé','dispens',70],['Présent et conforme','conforme',100],['Présent et non conforme','non conforme',115],['Absent / non réalisable','absent',110]],d.orifices,font); y+=20;
  field(p,'Causes / actions',M,y,100,RIGHT-142,d.defects,font); y+=20;
  field(p,'Première mise en service',M,y,150,120,fmtDate(d.commissioningDate),font); y+=18;
  field(p,'Entretien conseillé (mois)',300,y,160,100,d.maintenanceIntervalMonths,font);
  text(p,'1 / 4',RIGHT-28,H-24,8.5,font,soft);

  /* ---------------- page 2 ---------------- */
  p=doc.addPage([W,H]);
  text(p,'Respect des critères de bon fonctionnement',M,30,13,font,ink);
  text(p,`Catégorie : ${d.waCategory||'non déterminée'}`,M,46,9,font,soft);
  rule(p,M,54,RIGHT,ink,1);
  const evaluation=evaluateCriteria(d);
  const cols=[M,M+185,M+275,M+350];
  ['Paramètre','Exigence','Mesure','Verdict'].forEach((h,i)=>text(p,h,cols[i],62,8.5,font,soft));
  rule(p,M,68,RIGHT,line);
  const rows=[
    ['Indice de fumée','smoke',d.smoke],
    ['Température gaz','flueTemp',d.flueTemp],
    ['CO₂','co2',d.co2],
    ['O₂','o2',d.o2],
    ['CO (mg/kWh)','co',d.co],
    ['Rendement','efficiency',d.efficiency],
  ];
  let yy=82;
  for(const [label,key,val] of rows){
    const r=evaluation.results[key];
    const cmpKey=`cmp${key[0].toUpperCase()}${key.slice(1)}`;
    const shown=(d[cmpKey]==='OK'||d[cmpKey]==='non OK')?d[cmpKey]:r.verdict;
    text(p,label,cols[0],yy,9,font,ink);
    text(p,limitText(r.rule),cols[1],yy,8.5,font,soft);
    text(p,val??'',cols[2],yy,9,font,ink);
    verdict(p,cols[3],yy,shown,font,key);
    rule(p,M,yy+12,RIGHT,line);
    yy+=18;
  }
  for(const [label,key] of [['Allure 2','load2'],['Allure 3','load3']]){
    if(!d[key]) continue;
    const parsed=parseLoad(String(d[key]));
    // Category context from the appliance, values from this load only.
    const ctx={fuel:d.fuel,fuelDetail:d.fuelDetail,unitOrPulsed:d.unitOrPulsed,
      year:d.year,premix:d.premix,controlDate:d.controlDate};
    const ev=evaluateCriteria({...ctx,...parsed});
    text(p,label,cols[0],yy,9,font,ink);
    text(p,'selon catégorie',cols[1],yy,8,font,soft);
    const {lines,clipped}=wrapText(compactLoad(parsed),s=>font.widthOfTextAtSize(s,8),72,2);
    lines.forEach((line,i)=>text(p,line,cols[2],yy+i*10,8,font,ink));
    verdict(p,cols[3],yy,ev.globalResult,font,key);
    if(A&&clipped){ A.clipped.push(label); A.warnings.push(`${label}: load values clipped`); }
    rule(p,M,yy+20,RIGHT,line);
    yy+=26;
  }
  text(p,'Les tickets de mesure (date, heure, valeurs initiales et finales) doivent être joints.',M,yy+6,8.5,font,soft);
  yy+=24;
  band(p,'Informations complémentaires',yy); yy+=28;
  field(p,'Date de mesure',M,yy,100,110,d.measureDate,font);
  field(p,'Heure',300,yy,70,120,d.measureTime,font); yy+=18;
  field(p,'Analyseur',M,yy,100,110,d.analyzerMake,font);
  field(p,'N° série analyseur',300,yy,110,80,d.analyzerSerial,font); yy+=18;
  field(p,'Pression cheminée (Pa)',M,yy,140,90,d.chimneyPressure,font);
  field(p,'Pression pompe (bar)',300,yy,140,90,d.pumpPressure,font); yy+=18;
  field(p,"Température d'eau",M,yy,140,90,d.waterTemp,font); yy+=22;
  options(p,'Fumée (solide)',yy,[['OUI','oui',90],['NON','non',90]],d.solidSmoke,font); yy+=20;
  options(p,'Évacuation (solide)',yy,[['OUI','oui',90],['NON','non',90]],d.solidFlue,font); yy+=26;
  band(p,'Déclaration de conformité',yy); yy+=24;
  const declaration=/^non/i.test(d.conformity||'')?'NON':/^(conforme|ok)/i.test(d.conformity||'')?'OUI':d.conformity;
  options(p,'',yy,[['OUI','oui',100],['NON','non',100]],declaration,font); yy+=24;
  const solidSelected=/solide/i.test(d.fuel||'')||/pellets|bûches|plaquettes|céréales|charbon/i.test(d.fuelDetail||'');
  verdict(p,M,yy,solidSelected?(d.solidResult||evaluation.globalResult):evaluation.globalResult,font); yy+=20;
  field(p,'Causes et actions',M,yy,100,RIGHT-142,d.defects,font);
  text(p,'2 / 4',RIGHT-28,H-24,8.5,font,soft);

  /* ---------------- page 3 ---------------- */
  p=doc.addPage([W,H]);
  text(p,'Diagnostic approfondi (Pnom > 20 kW)',M,30,13,font,ink);
  rule(p,M,38,RIGHT,ink,1);
  if(!(Number(d.powerKw)>20)){
    text(p,'Non applicable — puissance nominale ≤ 20 kW',M,58,9,font,soft);
    text(p,'3 / 4',RIGHT-28,H-24,8.5,font,soft);
    // page 3 intentionally kept for stable numbering
  }else{
  const diag=[['A. Rapport de diagnostic présent ?','diagReport'],
    ['B. Modification depuis le dernier rapport ?','diagModified'],
    ['C. Modification après le 30/04/2015 ?','diagAfter2015'],
    ['D. Au moins 2 ans depuis la modification ?','diagTwoYears'],
    ['E. Diagnostic déjà reporté ?','diagDeferred']];
  yy=54;
  for(const [label,key] of diag){
    text(p,label,M,yy,9,font,ink);
    options(p,'',yy,[['OUI','oui',90],['NON','non',90]],d[key],font,M+230);
    rule(p,M,yy+20,RIGHT,line);
    yy+=26;
  }
  yy+=6;
  band(p,'Régulation et pompes de circulation',yy);
  const checks=[['Mode de régulation',d.regulationMode],['Thermostat',d.thermostat],
    ['Horloge',d.clock],['Programme nuit',d.night],['Indices dysfonctionnement pompe',d.pumpIssue]];
  for(const [label,val] of checks){
    text(p,label,M,yy+24,9,font,ink);
    options(p,'',yy+24,[['OUI','oui',90],['NON','non',90],['AUTO','auto',90],['MAN','man',90]],val,font,M+230);
    yy+=28;
  }
  text(p,'3 / 4',RIGHT-28,H-24,8.5,font,soft);
  }

  /* ---------------- page 4 ---------------- */
  p=doc.addPage([W,H]);
  text(p,'Prochaines interventions',M,30,13,font,ink);
  rule(p,M,38,RIGHT,ink,1);
  const follow=[['Inspection périodique','prochaine inspection',d.nextFrom,d.nextTo],
    ['Mise en conformité','mise en conformité',d.remedyDate,null],
    ['Remise en service','remise en service',null,null],
    ['Entretien conseillé','entretien',d.maintenanceDate,null],
    ['Diagnostic approfondi','diagnostic',d.diagnosticFrom,d.diagnosticTo]];
  yy=52;
  for(const [label,key,a,b] of follow){
    box(p,M,yy+4,matchesOption(d.followUp,key),label,font,true);
    text(p,label,M+16,yy,9,font,ink);
    text(p,a||'',300,yy,9,font,ink);
    if(b) text(p,`au ${b}`,400,yy,9,font,ink);
    rule(p,M,yy+16,RIGHT,line);
    yy+=24;
  }
  yy+=10;
  text(p,'Attestation établie par',M,yy,9,font,soft);
  text(p,d.techSignatureName||d.techName||'',M,yy+18,9,font,ink);
  rule(p,M,yy+22,280);
  text(p,'Signature du technicien',M,yy+30,8,font,soft);
  text(p,'Attestation reçue par',300,yy,9,font,soft);
  text(p,d.recipientName||d.clientName||'',300,yy+18,9,font,ink);
  rule(p,300,yy+22,RIGHT);
  text(p,d.recipientCapacity?`En qualité de ${d.recipientCapacity}`:'',300,yy+30,8,font,soft);
  yy+=58;
  // Mandatory danger notice and emergency contacts (AWAC model, page 9).
  const notice=[
    'ATTENTION : En cas de constatation d’un danger pour les utilisateurs du générateur',
    'contrôlé ou pour toute autre personne, le technicien agréé est tenu de prévenir',
    'l’utilisateur et le propriétaire du générateur ; soit, s’ils sont présents, par un',
    'écrit signé par les parties concernées, chacune en recevant une copie, soit, s’ils',
    'sont absents, par l’envoi d’un courrier recommandé avec accusé de réception',
    'avertissant du danger potentiel.'
  ];
  notice.forEach((line,i)=>text(p,line,M,yy+i*11,8.5,font,red));
  yy+=notice.length*11+10;
  text(p,'Secours d’urgence : 100 ou 112',M,yy,9,font,ink);
  text(p,'SOS odeurs de gaz :',M,yy+16,9,font,ink);
  text(p,'ORES : 0800 87 087   |   RESA / NETHYS : 04 362 98 38 (fr) – 087 74 20 18 (de)',M,yy+30,8.5,font,ink);
  text(p,'EANDIS / GASELWEST : 0800 65 0 65',M,yy+43,8.5,font,ink);
  text(p,'4 / 4',RIGHT-28,H-24,8.5,font,soft);

  if(audit){ audit.template={model:'wallonia-clean-4p',src:'generated'};
    audit.pages=4; }
  return doc.save();
}

export function parseLoad(s){
  const out={};
  const normalized=String(s).replace(/₂/g,'2').replace(/₁/g,'1');
  const pats={co2:/\bco2\s*[=:]?\s*([\d.,]+)/i,o2:/\bo2\s*[=:]?\s*([\d.,]+)/i,
    co:/\bco\b\s*[=:]?\s*([\d.,]+)/i,efficiency:/rendement\s*[=:]?\s*([\d.,]+)/i};
  for(const [key,re] of Object.entries(pats)){
    const m=re.exec(normalized);
    if(m) out[key]=m[1].replace(',','.');
  }
  return out;
}
function compactLoad(v){
  const parts=[];
  if(v.co2) parts.push(`CO₂ ${v.co2}`);
  if(v.o2) parts.push(`O₂ ${v.o2}`);
  if(v.co) parts.push(`CO ${v.co}`);
  if(v.efficiency) parts.push(`η ${v.efficiency}`);
  return parts.join(' · ');
}
// Split a legacy combined address into street + number so an old draft never
// loses its number when the user starts editing only the new street field.
function streetParts(d){
  const legacy=String(d.clientStreet||'').trim();
  if(d.clientStreetName){
    let num=String(d.clientStreetNumber||'').trim();
    if(!num && legacy){
      const m=/^(.*?)\s+(\S+)$/.exec(legacy);
      if(m) num=m[2];
    }
    return [String(d.clientStreetName),num];
  }
  const m=/^(.*?)\s+(\S+)$/.exec(legacy);
  return m?[m[1],m[2]]:[legacy,''];
}
function fmtDate(v){
  if(!v) return '';
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  return m?`${m[3]}/${m[2]}/${m[1]}`:String(v);
}
function limitText(rule){
  if(!rule) return '—';
  const parts=[];
  if(rule.min!=null) parts.push(`≥ ${rule.min}`);
  if(rule.max!=null) parts.push(`≤ ${rule.max}`);
  return parts.length?parts.join(' / '):'selon catégorie';
}
