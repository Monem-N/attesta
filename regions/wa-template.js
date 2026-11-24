// Declarative A4 generator for the Wallonia attestation.
// The official form is described once as reusable components. A flow cursor
// places them on pages; no field has a hardcoded absolute coordinate.
// Data fills components; the layout engine owns geometry.
import {evaluateCriteria} from './wallonia-criteria.js';

const {PDFDocument,rgb}=globalThis.window?.PDFLib||{};
const W=595.32,H=841.92,M=42,RIGHT=W-M;
const INK=rgb(0.086,0.094,0.114),SOFT=rgb(0.42,0.44,0.47),RED=rgb(0.698,0.227,0.169),
      RULE=rgb(0.72,0.73,0.70),WHITE=rgb(1,1,1);

// ---------- flow engine ----------
class Sheet{
  constructor(doc,font){ this.doc=doc; this.font=font; this.pages=[]; this.page=null; this.y=0; }
  newPage(){
    this.page=this.doc.addPage([W,H]); this.pages.push(this.page);
    this.y=M; return this.page;
  }
  need(h){ if(!this.page||this.y+h>H-M) this.newPage(); }
  text(s,x,y,size=9,color=INK,maxW){
    if(s==null||s==='') return;
    const v=String(s);
    if(maxW&&this.font.widthOfTextAtSize(v,size)>maxW){
      // wrap at word boundaries, never silently truncate
      const words=v.split(/\s+/); let line=''; let ly=y;
      for(const word of words){
        const next=line?`${line} ${word}`:word;
        if(this.font.widthOfTextAtSize(next,size)<=maxW||!line) line=next;
        else{ this.page.drawText(line,{x,y:H-ly-size*0.9,size,font:this.font,color}); line=word; ly+=size+3; }
      }
      if(line) this.page.drawText(line,{x,y:H-ly-size*0.9,size,font:this.font,color});
      return;
    }
    this.page.drawText(v,{x,y:H-y-size*0.9,size,font:this.font,color});
  }
  rule(x1,y,x2,color=RULE,t=0.6){ this.page.drawRectangle({x:x1,y:H-y,width:x2-x1,height:t,color}); }
  box(x,y,checked,label,size=8.5){
    const s=8;
    this.page.drawRectangle({x,y:H-y-s,width:s,height:s,borderColor:INK,borderWidth:0.7,color:WHITE});
    if(checked) this.page.drawRectangle({x:x+1.3,y:H-y-s+1.3,width:s-2.6,height:s-2.6,color:RED});
    if(label) this.text(label,x+s+4,y,size,INK);
  }
  // components advance the cursor
  title(s){
    this.need(24); this.text(s,M,this.y,15,INK); this.rule(M,this.y+8,RIGHT,INK,1);
    this.y+=26;
  }
  section(label){
    this.need(20); this.rule(M,this.y,RIGHT,RED,1.1);
    this.text(label,M,this.y+4,10,RED); this.y+=20;
  }
  note(s){ this.need(12); this.text(s,M,this.y,8,SOFT,RIGHT-M); this.y+=12; }
  fields(rows){
    for(const r of rows){
      this.need(17);
      const [label,value,x2,label2,value2]=r;
      this.text(label,M,this.y,9,SOFT,118);
      const vx=M+122; this.rule(vx,this.y+2,vx+120);
      if(value!=''&&value!=null) this.text(value,vx+2,this.y,9,INK,118);
      if(x2!=null){
        this.text(label2,x2,this.y,9,SOFT,x2-300+118||118);
        const vx2=x2+122; this.rule(vx2,this.y+2,Math.min(vx2+120,RIGHT));
        if(value2!=''&&value2!=null) this.text(value2,vx2+2,this.y,9,INK,Math.min(118,RIGHT-vx2-4));
      }
      this.y+=17;
    }
  }
  optionRow(label,items,selected){
    this.need(18);
    this.text(label,M,this.y,8.5,SOFT,100);
    let x=M+110;
    const s=String(selected||'').toLowerCase().trim();
    for(const [text,key,w] of items){
      const hit=!!s&&s.includes(String(key).toLowerCase());
      const width=Math.min(w,RIGHT-x-2);
      this.box(x,this.y-1,hit,text,8);
      x+=width;
    }
    this.y+=18;
  }
  table(headers,rows,widths){
    this.need(20+rows.length*16);
    let x=M;
    headers.forEach((h,i)=>{ this.text(h,x,this.y,8,SOFT,widths[i]-4); x+=widths[i]; });
    this.y+=6; this.rule(M,this.y,RIGHT,INK,0.9);
    for(const row of rows){
      let rx=M;
      row.forEach((cell,i)=>{
        if(cell&&cell.box){ this.box(rx,this.y,true,'',8); }
        else this.text(cell,rx,this.y,8.5,INK,widths[i]-6);
        rx+=widths[i];
      });
      this.y+=16; this.rule(M,this.y,RIGHT,RULE,0.5);
    }
    this.y+=8;
  }
  paragraph(lines,color=INK,size=8.5){
    for(const l of lines){ this.need(size+4); this.text(l,M,this.y,size,color,RIGHT-M); this.y+=size+4; }
  }
}

// ---------- logo masthead ----------
async function masthead(doc,sheet,logoBytes){
  const LAYOUT={
    'wallonie.jpg':{x:M,y:2,h:24},
    'dgo4.png':{x:250,y:2,h:24},
    'air-climat.jpg':{x:385,y:4,h:22},
  };
  for(const b of logoBytes){
    const pos=LAYOUT[b.name]; if(!pos) continue;
    const img=/\.png$/i.test(b.name)?await doc.embedPng(b.bytes):await doc.embedJpg(b.bytes);
    const h=pos.h, w=img.width*h/(img.height||1);
    sheet.page.drawImage(img,{x:pos.x,y:H-pos.y-h,width:w,height:h});
  }
  sheet.y=112; // content starts below the masthead, as in the reference
}

// ---------- document ----------
export async function generateWallonia(data,fontBytes,logoBytes,audit){
  const doc=await PDFDocument.create();
  if(globalThis.window?.fontkit) doc.registerFontkit(globalThis.window.fontkit);
  const font=await doc.embedFont(fontBytes,{subset:true});
  const sheet=new Sheet(doc,font); const d=data;
  const ev=evaluateCriteria(d);
  const cmp=key=>{
    const k=`cmp${key[0].toUpperCase()}${key.slice(1)}`;
    return d[k]==='OK'||d[k]==='non OK'?d[k]:ev.results[key].verdict;
  };
  const fmt=v=>{ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v||'')); return m?`${m[3]}.${m[2]}.${m[1]}`:String(v||''); };

  // page 1
  sheet.newPage(); await masthead(doc,sheet,logoBytes);
  sheet.title('Attestation de contrôle d’un générateur de chaleur');
  sheet.fields([
    ['Date du contrôle',fmt(d.controlDate),300,'N° attestation',d.attestNumber],
    ['Technicien',d.techName,300,'N° d’agrément',d.techAgrement],
    ['Entreprise',d.company,300,'N° BCE',d.bce],
    ['Téléphone',d.techPhone,300,'Courriel',d.techEmail],
    ['Demandeur',d.clientName,300,'Entreprise',d.clientCompany],
    ['Rue',d.clientStreetName||d.clientStreet,300,'Numéro',d.clientStreetNumber],
    ['Code postal / localité',d.clientCity,300,'Téléphone',d.clientPhone],
    ['Localisation',d.applianceLocation],
  ]);
  sheet.section('Combustibles');
  sheet.optionRow('Solide',[['Pellets bois','pellets',80],['Bûches','bûches',70],['Plaquettes','plaquettes',85],['Céréales','céréales',75],['Charbon','charbon',70]],d.fuelDetail);
  sheet.optionRow('Liquide',[['Gasoil','^gasoil$',85],['Gasoil extra','gasoil extra',110],['Fuel lourd','fuel lourd',100]],d.fuelDetail);
  sheet.optionRow('Gazeux',[['Gaz G20','g20',80],['Gaz G25','g25',80],['Propane','propane',80],['Butane','butane',75],['Biogaz','biogaz',75]],d.fuelDetail);
  sheet.section('Générateur et brûleur');
  sheet.fields([
    ['Nombre de générateurs',d.genCount,300,'Puissance utile (kW)',d.powerKw],
    ['Année de construction',d.year,300,'Raccordement',d.raccordement],
    ['Marque',d.make,300,'Type',d.model||d.burnerModel],
    ['N° de série',d.serial,300,'Fluide caloporteur',d.fluid],
  ]);
  sheet.optionRow('Condensation',[['oui','oui',90],['non','non',90]],d.condensation);
  sheet.optionRow('Allures',[['1 allure','1 allure',110],['plusieurs','plusieurs',120],['modulant','modulant',120]],d.burnerType);
  sheet.optionRow('Brûleur',[['unit','unit',100],['air pulsé','air pulsé',130]],d.unitOrPulsed);
  sheet.optionRow('Prémixage',[['prémix','^prémix',110],['non-premix','non-premix',140]],d.premix);
  sheet.optionRow('Plaque signalétique',[['Absente','absente',100],['Présente','présente',110]],d.plaque);
  sheet.section('Ventilation, amenée d’air, évacuation des gaz');
  sheet.optionRow('Ventilation du local',[['OUI','oui',90],['NON','non',90]],d.ventLocal);
  sheet.optionRow('Amenée d’air',[['OUI','oui',90],['NON','non',90]],d.airSupply);
  sheet.optionRow('Évacuation des gaz',[['OUI','oui',90],['NON','non',90]],d.flue);
  sheet.fields([['Permis d’urbanisme',d.permisDate],['Local',d.applianceLocation]]);
  sheet.optionRow('Orifices de mesure',[['Dispensé','dispens',80],['Présent et conforme','présent et conforme',120],['Présent et non conforme','non conforme',140],['Absent / non réalisable','absent',150]],d.orifices);
  sheet.fields([['Causes / actions',d.defects]]);

  // page 2 — measurements
  sheet.newPage(); await masthead(doc,sheet,logoBytes);
  sheet.title('Respect des critères de bon fonctionnement');
  sheet.table(['Paramètre','Exigence','Mesure','Verdict'],[
    ['Indice de fumée',ev.results.smoke.rule?'selon catégorie':'—',d.smoke,{box:cmp('smoke')==='OK'}],
    ['Température gaz',ev.results.flueTemp.rule?'selon catégorie':'—',d.flueTemp,{box:cmp('flueTemp')==='OK'}],
    ['CO₂',ev.results.co2.rule?'selon catégorie':'—',d.co2,{box:cmp('co2')==='OK'}],
    ['O₂',ev.results.o2.rule?'selon catégorie':'—',d.o2,{box:cmp('o2')==='OK'}],
    ['CO (mg/kWh)',ev.results.co.rule?'selon catégorie':'—',d.co,{box:cmp('co')==='OK'}],
    ['Rendement',ev.results.efficiency.rule?'selon catégorie':'—',d.efficiency,{box:cmp('efficiency')==='OK'}],
  ],[150,120,120,100]);
  sheet.paragraph([
    'ATTENTION : les tickets sur lesquels figurent les résultats des mesures, mentionnant l’heure et la date,',
    'doivent être agrafés sur cette attestation.',
    'Dérogation : transmission électronique via un protocole fermé sur lequel l’opérateur ne peut modifier les valeurs.'
  ],SOFT,8);
  sheet.section('Informations techniques complémentaires');
  sheet.fields([
    ['Date de mesure',fmt(d.measureDate),300,'Heure',d.measureTime],
    ['Analyseur',d.analyzerMake,300,'N° série analyseur',d.analyzerSerial],
    ['Pression cheminée (Pa)',d.chimneyPressure,300,'Pression pompe (bar)',d.pumpPressure],
    ['Température d’eau',d.waterTemp,300,'Gicleur — marque',d.nozzleMake],
    ['Gicleur — débit (gal/h)',d.nozzleFlow,300,'Gicleur — angle (°)',d.nozzleAngle],
  ]);
  sheet.optionRow('Fumée (solide)',[['OUI','oui',90],['NON','non',90]],d.solidSmoke);
  sheet.optionRow('Évacuation (solide)',[['OUI','oui',90],['NON','non',90]],d.solidFlue);
  sheet.section('Déclaration de conformité');
  sheet.optionRow('',[['OUI','oui',100],['NON','non',100]],/^oui|conforme/i.test(d.conformity||'')?'oui':'non');
  sheet.fields([['Causes et actions',d.defects]]);

  // page 3 — diagnostic
  sheet.newPage(); await masthead(doc,sheet,logoBytes);
  sheet.title('Diagnostic approfondi (Pnom > 20 kW)');
  if(Number(d.powerKw)>20){
    const diag=[
      ['A. Un rapport de diagnostic approfondi est-il présent ?','diagReport','Si OUI → Passer au point B. Si NON → Passer au point C.'],
      ['B. Modification du système ou des exigences depuis le rapport ?','diagModified','Si OUI → Passer au point D. Sinon → Sortie du tableau.'],
      ['C. Modification après le 30/04/2015 ?','diagAfter2015','Si OUI → Passer au point D. Si NON → Passer au point E.'],
      ['D. Au moins 2 ans depuis la modification ?','diagTwoYears','Si OUI → Effectuer le diagnostic. Sinon → Attendre le 1er contrôle après 2 ans.'],
      ['E. Le diagnostic a-t-il déjà été reporté ?','diagDeferred','Un seul report est admis.'],
    ];
    for(const [label,key,route] of diag){
      sheet.optionRow(label,[['OUI','oui',90],['NON','non',90]],d[key]);
      sheet.note(route);
    }
    sheet.section('Régulation et pompes de circulation');
    sheet.optionRow('Mode de régulation',[['AUTO','auto',90],['MAN','man',90]],d.regulationMode);
    sheet.optionRow('Thermostat d’ambiance',[['OUI','oui',90],['NON','non',90]],d.thermostat);
    sheet.optionRow('Horloge correctement réglée',[['OUI','oui',90],['NON','non',90]],d.clock);
    sheet.optionRow('Programme réduit la nuit',[['OUI','oui',90],['NON','non',90]],d.night);
    sheet.optionRow('Indices dysfonctionnement pompe',[['OUI','oui',90],['NON','non',90]],d.pumpIssue);
    sheet.paragraph(['(a) Si dérogation manuelle, inciter l’utilisateur à passer en mode automatique.',
      '(b) Proposer de réduire la consigne de température nocturne.',
      '(c) Inviter le client à faire diagnostiquer la pompe (bruit anormal).'],SOFT,7.5);
  } else sheet.note('Non applicable — puissance nominale ≤ 20 kW.');

  // page 4 — interventions & sign-off
  sheet.newPage(); await masthead(doc,sheet,logoBytes);
  sheet.title('Prochaines interventions');
  sheet.optionRow('En cas de conformité',[['Inspection périodique','prochaine inspection',180]],d.followUp);
  sheet.fields([['Période',`${d.nextFrom||''} – ${d.nextTo||''}`]]);
  sheet.optionRow('En cas de non-conformité',[['Mise en conformité','mise en conformité',180]],d.followUp);
  sheet.fields([['Au plus tard',d.remedyDate]]);
  sheet.optionRow('Remise en service',[['Contrôle après mise à l’arrêt','remise en service',220]],d.followUp);
  sheet.optionRow('Entretien conseillé',[['Selon constructeur','entretien',180]],d.followUp);
  sheet.fields([['Au plus tard',d.maintenanceDate]]);
  sheet.optionRow('Diagnostic approfondi',[['Dans le cadre de l’inspection','diagnostic',220]],d.followUp);
  sheet.fields([['Période',`${d.diagnosticFrom||''} – ${d.diagnosticTo||''}`]]);
  sheet.section('Signatures');
  sheet.fields([['Attestation établie par',d.techSignatureName||d.techName,300,'Reçue par',d.recipientName||d.clientName]]);
  sheet.fields([['En qualité de',d.recipientCapacity]]);
  sheet.paragraph([
    'ATTENTION : En cas de constatation d’un danger pour les utilisateurs du générateur contrôlé ou pour toute autre',
    'personne, le technicien agréé est tenu de prévenir l’utilisateur et le propriétaire ; écrit signé si présents,',
    'courrier recommandé avec accusé de réception avertissant du danger potentiel si absents.',
    'Secours d’urgence : 100 ou 112. SOS odeurs de gaz : ORES 0800 87 087 ; RESA/NETHYS 04 362 98 38 / 087 74 20 18 ;',
    'EANDIS/GASELWEST 0800 65 0 65.'
  ],RED,8);

  // pages 5–6 — footnotes and decision logigrams are official reference pages.
  // They are carried as page images from the approved blank (no data fields).
  // Official reference pages: footnotes (1)-(17) and the two decision
  // logigrammes plus the category/performance table are carried from the
  // published model as page images — they contain no applicant data.
  const appendixPaths=[
    'assets/wa-reference-p5.png','assets/wa-reference-p6.png',
    'assets/wa-reference-p7.png','assets/wa-reference-p8.png',
    'assets/wa-reference-p9.png',
  ];
  for(const path of appendixPaths){
    let r; try{ r=await fetch(path); }catch(e){ continue; }
    if(!r.ok) continue;
    const bytes=new Uint8Array(await r.arrayBuffer());
    const img=await doc.embedPng(bytes);
    const p=doc.addPage([W,H]);
    p.drawImage(img,{x:0,y:0,width:W,height:H});
  }

  if(audit){ audit.template={model:'wallonia-generated',src:'declarative-template'}; audit.pages=doc.getPageCount(); }
  return doc.save();
}
