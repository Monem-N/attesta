// Wallonia attestation — CALIBRATED ABSOLUTE-LAYOUT generator.
//
// Root cause of the previous "drift": the old Sheet was a flow/cursor engine —
// every element was placed at a running `this.y`, so geometry was content-relative
// and never aligned to the official grid. This version places every element at a
// FIXED absolute (x,y) calibrated to the published model (Zied reference), so the
// output is stable and matches the reference regardless of content length.
//
// Coordinates are glyph-top anchors in PDF points (origin top-left, A4 595x842),
// measured from the official form. Checkboxes are drawn at fixed positions and
// ticked with a red fill + check.
import {evaluateCriteria} from './wallonia-criteria.js';
import {parseNumber,scalarText} from '../input-validation.js';

const W=595.32,H=841.92,RIGHT=W-42;
// pdf-lib is loaded lazily (see app.js ensurePdfLibs), so colors and the
// PDFDocument class are resolved when generation starts, not at module load.
let INK,SOFT,RED,LINE,WHITE;
function initColors(){
  if(INK) return;
  const {rgb}=window.PDFLib;
  INK=rgb(0.086,0.094,0.114); SOFT=rgb(0.42,0.44,0.47); RED=rgb(0.698,0.227,0.169);
  LINE=rgb(0.55,0.56,0.55); WHITE=rgb(1,1,1);
}

function fmtDots(v){
  const s=scalarText(v);
  const iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if(iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  const slash=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if(slash) return `${slash[1]}.${slash[2]}.${slash[3]}`;
  return s;
}
function has(v,re){ return v!=null&&v!==''&&re.test(scalarText(v)); }

function page(doc,font){
  const p=doc.addPage([W,H]);
  const T=(s,x,y,size=9,color=INK,maxW)=>{
    if(s==null||s==='') return;
    const v=scalarText(s);
    if(!v) return;
    if(maxW&&font.widthOfTextAtSize(v,size)>maxW){
      // clip to the cell: wrap to at most 2 lines, never push other elements
      const words=v.split(/\s+/); let line='',lines=[];
      for(const w of words){ const nx=line?line+' '+w:w;
        if(font.widthOfTextAtSize(nx,size)<=maxW||!line) line=nx; else{ lines.push(line); line=w; } }
      if(line) lines.push(line);
      lines.slice(0,2).forEach((ln,i)=>p.drawText(ln,{x,y:H-y-size*0.9+i*(size+2),size,font,color}));
      return;
    }
    p.drawText(v,{x,y:H-y-size*0.9,size,font,color});
  };
  const line=(x1,y,x2,color=LINE,t=0.6)=>p.drawRectangle({x:x1,y:H-y,width:x2-x1,height:t,color});
  const box=(x,y,checked,size=8)=>{
    p.drawRectangle({x,y:H-y-size,width:size,height:size,borderColor:INK,borderWidth:0.7,color:WHITE});
    if(checked){ p.drawRectangle({x:x+1.3,y:H-y-size+1.3,width:size-2.6,height:size-2.6,color:RED});
      p.drawText('\u2713',{x:x-1,y:H-y-size*0.55,size:size-1,font,color:RED}); }
  };
  const opt=(x,y,label,checked,size=8)=>box(x,y,checked,size);
  const field=(y,label,value,valX,valW,labelX=60,size=9)=>{
    T(label,labelX,y,size,SOFT,valX-labelX-4);
    line(valX,y+2.5,valX+valW);
    if(value!=null&&value!=='') T(value,valX+2,y,size,INK,valW-4);
  };
  return {p,T,line,box,opt,field};
}

// option row: label at labelX, then (box,label) pairs starting at startX
function optRow(P,label,y,items,selected,labelX=60,startX=120){
  P.T(label,labelX,y,8.5,SOFT,startX-labelX-4);
  let x=startX;
  for(const [text,re] of items){
    const hit=has(selected,re);
    P.opt(x,y-1,text,hit);
    x+= (P.p, 0); // advance handled by caller widths
    break; // items carry explicit x below
  }
}
// explicit option list: each item has its own box x
function opts(P,y,items,selected){
  for(const [text,re,bx,labelDx] of items){
    const hit=has(selected,re);
    P.box(bx,y-1,hit);
    P.T(text,bx+ (labelDx||12),y,8.5,INK);
  }
}

async function masthead(doc,P,logos){
  const LAYOUT={ 'wallonie.jpg':{x:42,y:6,h:74}, 'dgo4.png':{x:255,y:14,h:50}, 'air-climat.jpg':{x:382,y:18,h:61} };
  for(const b of logos){
    const pos=LAYOUT[b.name]; if(!pos) continue;
    const img=/\.png$/i.test(b.name)?await doc.embedPng(b.bytes):await doc.embedJpg(b.bytes);
    const h=pos.h,w=img.width*h/(img.height||1);
    P.p.drawImage(img,{x:pos.x,y:H-pos.y-h,width:w,height:h});
  }
  P.T('Attestation de contrôle d’un générateur de chaleur',60,108,15,INK,480);
  P.line(60,120,535,INK,1);
}

export async function generateWallonia(data,fontBytes,logoBytes,audit){
  initColors();
  const doc=await window.PDFLib.PDFDocument.create();
  if(globalThis.window?.fontkit) doc.registerFontkit(globalThis.window.fontkit);
  const font=await doc.embedFont(fontBytes,{subset:true});
  const d=data;
  const ev=evaluateCriteria(d);
  const cmp=k=>{ const ck='cmp'+k[0].toUpperCase()+k.slice(1); return (d[ck]==='OK'||d[ck]==='non OK')?d[ck]:ev.results[k].verdict; };

  /* ===================== PAGE 1 ===================== */
  let P=page(doc,font); await masthead(doc,P,logoBytes);
  // header row
  P.field(124,'Date du contrôle :',fmtDots(d.controlDate),127,90,60);
  P.T('N° attestation(1) :',298,124,9,SOFT,80); P.line(365,126.5,455); P.T(d.attestNumber||'',367,124,9,INK,80);
  // technicien / demandeur headers
  P.T('Technicien(2)',60,144,9,SOFT); P.T('Le demandeur du contrôle',301,144,9,SOFT);
  P.T('Technicien agréé',73,158,8.5,INK);
  opts(P,158,[['L',/\bl\b|^l$/i,144],['GI',/\bgi\b/i,171],['GII',/\bgii\b/i,200]],d.techCategory);
  P.box(65,168,has(d.techCategory,/solide/i)); P.T('Technicien spécialisé en combustibles solides',77,169,8.5,INK);
  opts(P,158,[['Propriétaire de l’installation de chauffage central.',/propri/i,306,10]],d.requester);
  P.box(306,168,has(d.requester,/locair/i)); P.T('Locataire du bâtiment contenant l’installation de cc.',318,169,8.5,INK);
  P.box(306,178,has(d.requester,/autre/i)); P.T('Autre (préciser)',318,179,8.5,INK);
  // tech identity
  P.field(190,'Nom et prénom :',d.techName,149,150,60);
  P.T('Nom et prénom :',301,190,9,SOFT,90); P.line(391,192.5,500); P.T(d.clientName||'',393,190,9,INK,105);
  P.field(201,'N° d’agrément (si CL ou CG) :',d.techAgrement,163,120,60);
  P.T('Entreprise (si pertinent) :',301,201,9,SOFT,90);
  P.field(212,'Nom entreprise :',d.company,149,150,60);
  P.T('Rue :',301,212,9,SOFT,40); P.line(391,214.5,470); P.T(d.clientStreetName||d.clientStreet||'',393,211,9,INK,75);
  P.T('N° :',496,212,9,SOFT,20); P.line(510,214.5,560); P.T(d.clientStreetNumber||'',512,211,9,INK,45);
  P.field(223,'Tél :',d.techPhone,91,60,60);
  P.T('Fax ou courriel :',165,223,9,SOFT,55); P.line(222,225.5,290); P.T(d.techEmail||'',224,223,9,INK,64);
  P.T('Code postal & localité :',301,223,9,SOFT,88); P.line(391,225.5,500); P.T(d.clientCity||'',393,222,9,INK,105);
  P.T('Tél :',301,233,9,SOFT,40);
  P.field(233,'N° Entreprise (BCE) :',d.bce,149,150,60);
  P.T('Fax ou courriel :',301,233,9,SOFT,55);
  P.T('Localisation du générateur si différente :',301,248,9,SOFT,200); P.T(d.applianceLocation||'',301,260,9,INK,230);
  // combustibles
  P.T('Combustibles',60,276,10,RED); P.line(60,286,535,RED,1);
  P.T('(si multicombustible, mentionner les différents combustibles)',129,276,7.5,SOFT,300);
  P.T('Solide',60,295,8.5,SOFT);
  opts(P,295,[['Pellets bois',/pellets/i,120],['Bûches',/b[uû]ches/i,183],['Plaquettes',/plaquettes/i,246],['Céréales',/c[eé]r[eé]ales/i,309],['Charbon',/charbon/i,372]],d.fuelDetail);
  P.T('Liquide',60,306,8.5,SOFT);
  opts(P,306,[['Gasoil',/(^| )gasoil$/i,120],['Gasoil extra',/gasoil extra/i,183],['Fuel lourd',/fuel lourd/i,246]],d.fuelDetail);
  P.T('Gazeux',60,317,8.5,SOFT);
  opts(P,317,[['Gaz nat. G20',/g20/i,120],['Gaz nat.G25',/g25/i,183],['Propane',/propane/i,246],['Butane',/butane/i,309],['Biogaz',/biogaz/i,372]],d.fuelDetail);
  // generateur / bruleur
  P.T('Générateur de chaleur',60,333,10,RED); P.T('Brûleur',301,333,10,RED); P.line(60,343,535,RED,1);
  P.field(353,'Nb de générateurs dans le local de chauffe :',d.genCount,215,40,60);
  opts(P,353,[['1 allure',/1 allure/i,305],['plusieurs allures nombre :',/plusieurs/i,350],['modulant',/modulant/i,489]],d.burnerType);
  P.box(433,358,has(d.unitOrPulsed,/air.?puls/i)); P.T('air pulsé (séparable)',445,359,8.5,INK);
  P.T('Identification du générateur (si plusieurs) :',60,363,8.5,SOFT,220);
  P.T('si gaz :',301,363,8.5,SOFT,40); P.box(350,362,has(d.unitOrPulsed,/^unit/i)); P.T('unit',362,363,8.5,INK);
  P.box(433,368,has(d.premix,/^pr[eé]mix/i)); P.T('prémix(5)',445,369,8.5,INK);
  P.box(481,369,has(d.premix,/non.?premix/i)); P.T('non-premix',493,370,8.5,INK);
  // raccordement + condensation
  P.T('Raccordement : B',60,385,8.5,INK); P.box(110,384,has(d.raccordement,/^b/i));
  P.T('(3), C',154,385,8.5,INK); P.box(183,384,has(d.raccordement,/^c/i)); P.T('(3)',206,385,8.5,INK);
  P.T('A condensation :',60,396,8.5,INK);
  P.box(138,395,has(d.condensation,/^oui/i)); P.T('oui',150,396,8.5,INK);
  P.box(188,395,has(d.condensation,/^non/i)); P.T('non',200,396,8.5,INK);
  P.T('Plaque signalétique :',59,407,8.5,INK);
  P.box(140,406,has(d.plaque,/absente/i)); P.T('Absente',152,407,8.5,INK);
  P.box(188,406,has(d.plaque,/pr[eé]sente/i)); P.T('Présente',200,407,8.5,INK);
  // nameplate — short labels + generous row spacing prevent wrap collisions
  P.field(415,'Année constr.(4) :',d.year,160,60,62);
  P.field(430,'Marque :',d.make,120,80,62);
  P.T('Type :',195,430,8,SOFT,22); P.line(218,432.5,292); P.T(d.model||d.burnerModel||'',220,430,8,INK,70);
  P.field(445,'N° série :',d.serial,120,170,62);
  P.field(460,'Puiss. utile :',d.powerKw,135,55,62); P.T('kW',196,462,8,SOFT,18);
  // fluide / production (right col)
  P.T('Fluide caloporteur',301,437,8,SOFT,80);
  opts(P,437,[['Eau',/eau/i,372],['Vapeur basse pression',/vapeur/i,426],['Huile thermique',/huile/i,372]],d.fluid);
  P.T('Production de chaleur',301,459,8,SOFT,80);
  opts(P,459,[['Chauffage',/^chauffage/i,372],['ECS',/^ecs/i,426],['Chauff. + ECS',/chauff.*ecs|ecs.*chauff/i,472]],d.production);
  // ventilation
  P.T('Ventilation local de chauffe – Amenée d’air comburant – Evacuation des gaz de combustion',60,480,9,RED,480); P.line(60,490,535,RED,1);
  P.T('Introduction de la demande initiale de permis d’urbanisme du bâtiment contenant le local de chauffe(6) :',60,500,8.5,INK,480);
  P.box(66,514,has(d.permisDate,/avant/i)); P.T('Avant le 29/05/2009(7)',78,515,8.5,INK);
  P.box(66,535,has(d.permisDate,/apr[eè]s/i)); P.T('Après le 29/05/2009',78,536,8.5,INK);
  const yn=(label,y,val)=>{ P.T(label,60,y,8.5,INK,340); P.box(402,y-1,has(val,/oui/i)); P.T('OUI',414,y,8.5,INK); P.box(453,y-1,has(val,/non/i)); P.T('NON',465,y,8.5,INK); };
  yn('Conformité de la ventilation du local de chauffe :',558,d.ventLocal);
  yn('Conformité du dispositif d’amenée d’air comburant :',569,d.airSupply);
  yn('Conformité du dispositif d’évacuation des gaz de combustion :',579,d.flue);
  P.T('En cas de non-conformité -> Causes de non-conformité et actions à entreprendre :',60,601,8.5,INK,480); P.T(d.defects||'',60,614,8.5,INK,470);
  P.T('Orifices de mesure (générateurs combustibles liquides et gazeux)',60,630,9,RED,480);
  P.T('Le générateur est-il dispensé de l’obligation d’être équipé d’orifices de mesure(8) ?',60,650,8.5,INK,400);
  P.box(400,651,false); P.T('OUI',412,652,8.5,INK); P.box(451,651,has(d.orifices,/dispens/i)); P.T('NON',463,652,8.5,INK);
  P.box(66,674,has(d.orifices,/pr[eé]sent et conforme/i)); P.T('Présent et conforme',78,675,8.5,INK);
  P.box(66,685,has(d.orifices,/pr[eé]sent et non conforme/i)); P.T('Présent et non conforme',78,686,8.5,INK);
  P.box(66,695,has(d.orifices,/absent/i)); P.T('Absent et techniquement non réalisable',78,696,8.5,INK);

  /* ===================== PAGE 2 ===================== */
  P=page(doc,font); await masthead(doc,P,logoBytes);
  P.T('Respect des critères de bon fonctionnement',60,109,13,INK,480);
  P.T('(installations alimentées en combustibles liquides ou gazeux)',60,124,9,SOFT,480);
  P.line(60,134,535,INK,1);
  const cols=[60,211,269,323,376,437,496];
  const headers=['Température d’eau (°C)(9)','Indice de fumée Max. (Bacharach)','t°nette gaz Max.(°C)','Teneur CO2 Min. (%)','Teneur en O2 Max. (%)','Teneur CO Max.(mg/kWh)','Rend. de combustion Min. (%)'];
  headers.forEach((h,i)=>P.T(h,cols[i],150,7,SOFT,cols[i+1]?cols[i+1]-cols[i]-3:40));
  P.line(60,168,535,INK,0.9);
  const lim=key=>{ const r=ev.results[key].rule; if(!r) return '—'; const a=[]; if(r.min!=null)a.push('≥'+r.min); if(r.max!=null)a.push('≤'+r.max); return a.join(' ')||'—'; };
  // Performances minimales
  P.T('Performances minimales (10)',60,185,8.5,INK,140);
  [lim('smoke'),lim('flueTemp'),lim('co2'),lim('o2'),lim('co'),lim('efficiency')].forEach((v,i)=>P.T(v,cols[i+1],185,8,INK,55));
  P.line(60,195,535,LINE,0.5);
  // Valeurs mesurées
  P.T('Valeurs mesurées',60,210,8.5,INK,140);
  [d.smoke,d.flueTemp,d.co2,d.o2,d.co,d.efficiency].forEach((v,i)=>P.T(v??'',cols[i+1],210,8.5,INK,55));
  P.T('Appareil :',294,210,8.5,SOFT,36); P.T(d.analyzerMake||'',330,210,8.5,INK,100);
  P.T('S/N :',435,210,8.5,SOFT,25); P.T(d.analyzerSerial||'',460,210,8.5,INK,70);
  P.line(60,220,535,LINE,0.5);
  // per-allure rows (fixed): Puissance max, Allure1..4
  const allureRows=[['Puissance maximale',d.loadMax],['Allure 1 / Pmin',d.load1],['Allure 2 (25 %)',d.load2],['Allure 3 (50 %)',d.load3],['Allure 4 (75 %)',d.load4]];
  let ay=235;
  for(const [label,val] of allureRows){ P.T(label,60,ay,8.5,INK,140); P.T(val||'',cols[1],ay,8.5,INK,55); P.line(60,ay+8,535,LINE,0.4); ay+=18; }
  // Comparaison
  P.T('Comparaison',60,ay+4,8.5,INK,140);
  const cmpCols=[211,269,323,376,437,496];
  ['smoke','flueTemp','co2','o2','co','efficiency'].forEach((k,i)=>{ const v=cmp(k); P.T(v||'',cmpCols[i],ay+4,8.5,(v==='non OK')?RED:INK,50); });
  P.line(60,ay+14,535,INK,0.9);
  P.T('Résultat global',60,ay+30,8.5,INK,140);
  const g= cmp('co')==='non OK'||cmp('co2')==='non OK'||cmp('efficiency')==='non OK'||cmp('flueTemp')==='non OK'?'non OK':(d.globalResult||'OK');
  P.T(g,cmpCols[0],ay+30,8.5,g==='non OK'?RED:INK,60);
  // tickets + complementary
  P.T('ATTENTION : les tickets sur lesquels figurent les résultats des mesures, mentionnant l’heure et la date, doivent être agrafés.',60,ay+52,8,SOFT,480);
  P.T('Dérogation : transmission électronique via un protocole fermé non modifiable par l’opérateur.',60,ay+64,8,SOFT,480);
  P.T('Informations techniques complémentaires',60,ay+90,10,RED); P.line(60,ay+100,535,RED,1);
  P.field(ay+118,'Date – heure mesure',`${fmtDots(d.measureDate)} ${scalarText(d.measureTime)}`,160,120,60);
  P.field(ay+136,'Pression cheminée (Pa)',d.chimneyPressure,430,80,60);
  P.field(ay+154,'Pression pompe (bar)',d.pumpPressure,470,60,60);
  P.T('Gicleur :',60,ay+176,8.5,INK); P.T('Marque & type :',95,ay+176,8.5,SOFT,60); P.T(d.nozzleMake||'',150,ay+176,8.5,INK,110);
  P.T('Débit (gal/h) :',273,ay+176,8.5,SOFT,50); P.T(d.nozzleFlow||'',340,ay+176,8.5,INK,50);
  P.T('Angle :',401,ay+176,8.5,SOFT,30); P.T(d.nozzleAngle||'',470,ay+176,8.5,INK,40);
  // solid + declaration
  P.T('Respect des critères (combustibles solides)',60,ay+206,10,RED); P.line(60,ay+216,535,RED,1);
  P.T('L’installation n’émet-elle que très brièvement de la fumée ?',60,ay+234,8.5,INK,290); P.box(348,ay+233,has(d.solidSmoke,/oui/i)); P.T('OUI',360,ay+234,8.5,INK); P.box(399,ay+233,has(d.solidSmoke,/non/i)); P.T('NON',411,ay+234,8.5,INK);
  P.T('L’évacuation des gaz s’effectue-t-elle correctement ?',60,ay+252,8.5,INK,290); P.box(348,ay+251,has(d.solidFlue,/oui/i)); P.T('OUI',360,ay+252,8.5,INK); P.box(399,ay+251,has(d.solidFlue,/non/i)); P.T('NON',411,ay+252,8.5,INK);
  P.T('Déclaration de conformité vis-à-vis de l’acte de contrôle',60,ay+282,9,RED,480);
  P.box(65,ay+300,/^oui|conforme/i.test(scalarText(d.conformity))); P.T('OUI',77,ay+300,8.5,INK); P.box(116,ay+300,/^non/i.test(scalarText(d.conformity))); P.T('NON',128,ay+300,8.5,INK);
  P.T('En cas de non conformité -> Causes et actions :',60,ay+322,8.5,INK,300); P.T(d.defects||'',200,ay+322,8.5,INK,330);

  /* ===================== PAGE 3 ===================== */
  P=page(doc,font); await masthead(doc,P,logoBytes);
  P.T('Réalisation d’un diagnostic approfondi (si Pnom > 20 kW)',60,109,12,INK,480); P.line(60,122,535,INK,1);
  if((parseNumber(d.powerKw)??0)>20){
    const diag=[
      ['A. Un rapport de diagnostic approfondi est-il présent ?','diagReport','Si OUI → Passer au point B.  Si NON → Passer au point C.'],
      ['B. Modification du système ou des exigences depuis le rapport ?','diagModified','Si OUI → Passer au point D.  Si NON → Installation en ordre jusqu’au prochain contrôle. Sortie du tableau.'],
      ['C. Modification après le 30/04/2015 ?','diagAfter2015','Si OUI → Passer au point D.  Si NON → Passer au point E.'],
      ['D. Au moins 2 ans depuis la modification ?','diagTwoYears','Si OUI → Effectuer un diagnostic ; installation en ordre. Sortie du tableau.  Si NON → Attendre le 1er contrôle après 2 ans.'],
      ['E. Le diagnostic a-t-il déjà été reporté ?','diagDeferred','Si OUI → Effectuer le diagnostic.  Si NON → Effectuer un diagnostic ; report toléré une seule fois.'],
    ];
    let dy=140;
    for(const [label,key,route] of diag){
      P.T(label,60,dy,9,INK,380);
      P.box(459,dy-1,has(d[key],/^oui/i)); P.T('OUI',471,dy,8.5,INK);
      P.box(504,dy-1,has(d[key],/^non/i)); P.T('NON',516,dy,8.5,INK);
      P.line(60,dy+12,535,LINE,0.5);
      P.T(route,70,dy+26,7.5,SOFT,460);
      dy+=58;
    }
    P.T('Inspection périodique du système de régulation et des pompes de circulation (13)',60,dy+6,10,RED,480); P.line(60,dy+16,535,RED,1);
    const reg=[
      ['La régulation fonctionne-t-elle en mode automatique ou manuel ?','regulationMode',[['AUTO',/auto/i,200],['MAN',/man/i,249]]],
      ['Le thermostat d’ambiance fonctionne-t-il ?','thermostat',[['OUI',/^oui/i,200],['NON',/^non/i,249]]],
      ['L’horloge est-elle correctement réglée ?','clock',[['OUI',/^oui/i,200],['NON',/^non/i,249]]],
      ['Chauffage programmé en mode réduit la nuit ?','night',[['OUI',/^oui/i,200],['NON',/^non/i,249]]],
      ['Indices de dysfonctionnement de la pompe ?','pumpIssue',[['OUI',/^oui/i,447],['NON',/^non/i,495]]],
    ];
    let ry=dy+34;
    for(const [label,key,items] of reg){
      P.T(label,60,ry,8.5,INK,380);
      for(const [text,re,bx] of items){ P.box(bx,ry-1,has(d[key],re)); P.T(text,bx+12,ry,8.5,INK); }
      P.line(60,ry+12,535,LINE,0.4); ry+=26;
    }
    P.T('(a) Si dérogation manuelle, inciter l’utilisateur à passer en mode automatique.',60,ry+4,7.5,SOFT,480);
    P.T('(b) Proposer de réduire la consigne de température nocturne.',60,ry+16,7.5,SOFT,480);
    P.T('(c) Inviter le client à faire diagnostiquer la pompe (bruit anormal).',60,ry+28,7.5,SOFT,480);
  } else P.T('Non applicable — puissance nominale ≤ 20 kW.',60,150,9,SOFT,480);

  /* ===================== PAGE 4 ===================== */
  P=page(doc,font); await masthead(doc,P,logoBytes);
  P.T('Prochaines interventions',60,109,13,INK,480); P.line(60,122,535,INK,1);
  const fu=d.followUp||'';
  const row=(y,label,re,a,b)=>{
    P.box(63,y-1,has(fu,re)); P.T(label,79,y,9,INK,200);
    if(a) P.T(fmtDots(a),300,y,9,INK,90);
    if(b) P.T(`entre le ${fmtDots(a)} et le ${fmtDots(b)}`,330,y,9,INK,200);
    P.line(60,y+12,535,LINE,0.4);
  };
  row(140,'En cas de conformité — prochaine inspection périodique',/prochaine inspection/i,d.nextFrom,d.nextTo);
  row(166,'En cas de non-conformité — mise en conformité',/mise en conformit/i,d.remedyDate,null);
  row(192,'Remise en service après mise à l’arrêt',/remise en service/i,null,null);
  row(218,'Entretien conseillé par le constructeur',/entretien/i,d.maintenanceDate,null);
  row(244,'Diagnostic approfondi',/diagnostic/i,d.diagnosticFrom,d.diagnosticTo);
  P.T('Attestation de contrôle établie',60,300,9,SOFT);
  P.T(d.techSignatureName||d.techName||'',60,322,9,INK,220); P.line(60,326,280);
  P.T('(signature du technicien)',60,340,8,SOFT);
  P.T('Attestation reçue par',301,300,9,SOFT);
  P.T(d.recipientName||d.clientName||'',301,322,9,INK,220); P.line(301,326,535);
  P.T(d.recipientCapacity?`en qualité de ${scalarText(d.recipientCapacity)}`:'',301,340,8,SOFT,220);
  const notice=[
    'ATTENTION : En cas de constatation d’un danger pour les utilisateurs du générateur contrôlé ou pour toute autre',
    'personne, le technicien agréé est tenu de prévenir l’utilisateur et le propriétaire ; écrit signé si présents,',
    'courrier recommandé avec accusé de réception avertissant du danger potentiel si absents.',
    'Secours d’urgence : 100 ou 112.  SOS odeurs de gaz : ORES 0800 87 087 ; RESA/NETHYS 04 362 98 38 / 087 74 20 18 ;',
    'EANDIS/GASELWEST 0800 65 0 65.',
  ];
  const notice2=[
    'ATTENTION : En cas de constatation d’un danger pour les utilisateurs du générateur contrôlé ou pour toute autre',
    'personne, le technicien agréé est tenu de prévenir l’utilisateur et le propriétaire ; soit, s’ils sont présents,',
    'par un écrit signé par les parties concernées, chacune en recevant une copie, soit, s’ils sont absents, par',
    'l’envoi d’un courrier recommandé avec accusé de réception avertissant du danger potentiel.'
  ];
  notice2.forEach((l,i)=>P.T(l,60,376+i*12,8.2,RED,480));
  ['Secours d’urgence : 100 ou 112.',
   'SOS odeurs de gaz : clients ORES : 0800 87 087 ; clients RESA / NETHYS : 04 362 98 38 (français) – 087 74 20 18 (allemand) ;',
   'clients EANDIS / GASELWEST : 0800 65 0 65.'
  ].forEach((l,i)=>P.T(l,60,430+i*12,8.2,RED,480));

  /* ============ PAGES 5–9 : real vector reference pages ============ */
  try{
    const r=await fetch('assets/wa-attestation-blank.pdf');
    if(r&&r.ok){
      const src=await window.PDFLib.PDFDocument.load(await r.arrayBuffer());
      const copied=await doc.copyPages(src,[4,5,6,7,8]);
      copied.forEach(p=>doc.addPage(p));
    }
  }catch(e){ /* reference pages optional */ }

  // Page-number footers on every generated page (1/9 … 9/9).
  const total=doc.getPageCount();
  for(let i=0;i<total;i++){
    doc.getPages()[i].drawText(`${i+1} / ${total}`,{x:535-42,y:22,size:8,font,color:INK});
  }
  if(audit){ audit.template={model:'wallonia-calibrated',src:'declarative-absolute'}; audit.pages=total;
    audit.printed.push('page-numbers',fmtDots(d.controlDate)); }
  return doc.save();
}