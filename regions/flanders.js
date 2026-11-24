// Flanders — model-keuringsrapport / model-verbrandingsattest / model-reinigingsattest (Dutch)
import {fmt} from './wallonia.js';
const F = (key,label,type='text',extra={}) => ({key,label,type,...extra});
const req = f => ({...f,required:true});
const whenKeuring = d => /Keuringsrapport/i.test(d.document||'');
const whenNotKeuring = d => !whenKeuring(d);
const addMonths=(date,months)=>{
  const d=new Date(date); const day=d.getDate();
  d.setDate(1); d.setMonth(d.getMonth()+months);
  d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));
  return d;
};
const addYears=(date,years)=>{
  const d=new Date(date); const month=d.getMonth(); const day=d.getDate();
  d.setMonth(0); d.setDate(1); d.setFullYear(d.getFullYear()+years); d.setMonth(month);
  d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));
  return d;
};

export const flanders = {
  id: 'flanders',
  label: 'Vlaanderen',
  rule: '#b23a2b',
  lang: 'nl',
  output: 'pdf',
  documents: ['model-verbrandingsattest','model-reinigingsattest'],
  background: 'assets/fl-model-verbrandingsattest.pdf',
  recognition: [/^GV\d{5}$/i,/^TV\d{5}$/i,/^VA\+\d{5}$/i],

  rules: {
    nextDue(date,data){
      const d=new Date(date); const kw=Number(data.powerKw)||0;
      const gas=/gas/i.test(data.fuel||'');
      const due=addYears(d,gas?2:1);
      return {date:due, from:due, to:due, years:gas?2:1, note:gas?'2-jaarlijks':'Jaarlijks', conflict:false};
    },
    // Flanders: 3 months to remedy combustion-value defects with a new attestation
    remedy(date){ return addMonths(date,3); },
    // Eerstvolgende reiniging: annual (periodic maintenance of the appliance).
    nextCleaning(date,data){ const d=new Date(date); return addYears(d,1); },
    registrationDeadline(date){ return addMonths(date,1); }
  },

  steps: [
    {title:'Interventie',hint:'Aard en datum van de keuring of het onderhoud.',fields:[
      req(F('intervention','Type interventie','select',{options:['Periodiek onderhoud','Keuring eerste ingebruikname','Controle na ingreep verbrandingsdeel']})),
      req(F('controlDate','Datum uitvoering','date')),
      F('attestNumber','Volgnummer attest (bedrijfsintern)'),
      req(F('document','Document','select',{options:['Verbrandingsattest + reinigingsattest','Keuringsrapport + verbrandingsattest']})),
    ]},
    {title:'Technicus',hint:'Erkende technicus — erkenningsnummer GV, TV of VA+.',fields:[
      req(F('techCategory','Erkenning','select',{options:[
        'Erkend technicus gasvormige brandstof (GV)',
        'Erkend technicus vloeibare brandstof (TV)',
        'Erkend verwarmingsaannemer (VA+)',
        'Geschoold vakman (vaste brandstof)']})),
      req(F('techName','Naam en voornaam')),
      F('techAgrement','Erkenningsnummer (GV##### / TV##### / VA+#####)'),
      req(F('company','Firma')),
      req(F('bce','Ondernemingsnummer')),
      F('techPhone','E-mail'),
      F('workDuration','Arbeidsduur van — tot'),
    ]},
    {title:'Klant',hint:'Klant en adres van het stooktoestel indien verschillend.',fields:[
      req(F('clientName','Voornaam en achternaam')),
      req(F('clientStreet','Straat en nummer')),
      req(F('clientCity','Postnummer en gemeente')),
      F('clientPhone','Telefoon / e-mail'),
      F('applianceLocation','Adres stooktoestel indien verschillend'),
    ]},
    {title:'Stooktoestel',hint:'Kenmerken van het toestel.',fields:[
      req(F('fuel','Brandstof','select',{options:['Gasvormig','Vloeibaar','Vast']})),
      req(F('powerKw','Nominaal vermogen (kW)','number')),
      F('central','Centraal toestel','select',{options:['Ja','Nee']}),
      F('type','Type','select',{options:['B','C']}),
      F('condensation','Condensatie','select',{options:['Ja','Nee']}),
      F('year','Bouwjaar','number'),
      F('make','Merk'), F('model','Model'), F('serial','Serienummer'),
      F('unitOrPulsed','Brander','select',{options:['unit','air pulsed']}),
    ]},
    {title:'Metingen',hint:'Proef I (initieel) en Proef II (eindmeting).',measure:true,fields:[
      {key:'o2',label:'Zuurstof (O₂)',type:'measure',unit:'%',max:4.4,lower:true,pair:true},
      {key:'co2',label:'Koolstofdioxide (CO₂)',type:'measure',unit:'%',min:12,pair:true},
      {key:'co',label:'Koolstofmonoxide (CO)',type:'measure',unit:'mg/kWh',max:150,lower:true,pair:true},
      {key:'flueTemp',label:'Rookgastemperatuur',type:'measure',unit:'°C',max:200,lower:true,pair:true},
      {key:'netTemp',label:'Nettotemperatuur',type:'measure',unit:'°C',pair:true},
      {key:'efficiency',label:'Verbrandingsrendement (Hi)',type:'measure',unit:'%',min:90,pair:true},
      F('smoke','Rookindex Bacharach (stookolie)','number'),
      F('draft','Druk rookgasafvoerkanaal (Pa)','number'),
    ]},
    {title:'Beoordeling',hint:'Conformiteit, gebreken en VEKA-registratie.',fields:[
      req(F('conformity','Eindbeoordeling','select',{
        options:['Goed en veilig','Niet goed','Niet veilig'],when:whenNotKeuring})),
      ...['keuringInstructions','keuringBurner','keuringKetel','keuringVentilation',
        'keuringHydraulic','keuringElectrical'].map(key=>F(key,({
          keuringInstructions:'Gebruikers- en onderhoudsinstructies',
          keuringBurner:'Ingeregeld vermogen',
          keuringKetel:'Ketel — mantel',
          keuringVentilation:'Ventilatie stookplaats',
          keuringHydraulic:'Hydraulische installatie — lekken',
          keuringElectrical:'Elektrische installatie — zekering',
        })[key],'select',{options:['OK','Niet OK'],when:whenKeuring})),
      ...['conformStooktoestel','conformRookgas','conformStookplaats','conformVerbranding'].map(key=>
        req(F(key,({
          conformStooktoestel:'Stooktoestel conform',
          conformRookgas:'Rookgasafvoerkanaal conform',
          conformStookplaats:'Stookplaats conform',
          conformVerbranding:'Verbrandingscontrole',
        })[key],'select',{options:['OK','Niet OK'],when:whenKeuring}))),
      F('defects','Gebreken en maatregelen','textarea'),
      F('remarks','Andere opmerkingen','textarea'),
      req(F('vekaRef','VEKA registratiereferentie')),
      req(F('vekaDate','Datum registratie VEKA','date')),
    ]},
  ]
};

export {fmt};
