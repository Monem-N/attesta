// Brussels — attestation de contrôle périodique PEB (data prep; no self-generated PDF except solid fuel)
import {fmt} from './wallonia.js';
import {isValidDate,scalarText} from '../input-validation.js';
const F = (key,label,type='text',extra={}) => ({key,label,type,...extra});
const req = f => ({...f,required:true});
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

export const brussels = {
  id: 'brussels',
  label: 'Bruxelles',
  rule: '#b23a2b',
  lang: 'fr',
  output: 'json',
  background: 'assets/br-solid-fuel-model.pdf',
  encoder: 'https://peb-epb.brussels/att-frontoffice/pwa/index.html',
  recognition: [/^GI$/i,/^GII$/i,/^L$/i,/^RESCERT/i],

  rules: {
    nextDue(date,data){
      const d=new Date(date); const gas=/gaz/i.test(scalarText(data.fuel));
      const due=addYears(d,gas?2:1);
      return {date:due,from:due,to:due,years:gas?2:1,note:gas?'2 ans':'1 an',conflict:false};
    },
    nonConformity(date){ return addMonths(date,5); }
  },

  steps: [
    {title:'Acte',hint:'Type de contrôle et motif.',fields:[
      req(F('intervention','Type d’acte','select',{options:['Contrôle périodique PEB','1er contrôle périodique (chauffe-eau gaz)','Mise en conformité']})),
      req(F('controlDate','Date de l’acte','date')),
      req(F('motif','Motif du contrôle','select',{options:['(rem)placement','Mise en conformité','Autre raison','Délai max entre 2 CP atteint','Intervention partie combustion']})),
      F('attestNumber','Numéro d’attestation (interne)'),
    ]},
    {title:'Professionnel',hint:'Technicien agréé et entreprise.',fields:[
      req(F('techCategory','Agrément','select',{options:['Technicien chaudière PEB GI','Technicien chaudière PEB GII','Technicien chaudière PEB L','RESCERT biomasse']})),
      req(F('techName','Nom et prénom')),
      F('techAgrement','N° d’agrément'),
      req(F('company','Nom d’entreprise')),
      req(F('bce','N° d’entreprise (BCE)','text',{format:'bce'})),
      F('techPhone','Tél / e-mail'),
    ]},
    {title:'Parties',hint:'Propriétaire, personne de contact et unité PEB.',fields:[
      req(F('ownerType','Type','select',{options:['Particulier','Copropriété','Entreprise']})),
      req(F('clientName','Propriétaire / titulaire — nom')),
      req(F('clientStreet','Rue / n° / boîte')),
      req(F('clientCity','CP / commune')),
      F('contactName','Personne de contact'),
      F('contactPhone','Tél / e-mail contact'),
      F('pebUnitRef','Référence unité PEB'),
      F('floor','N° étage'),
      F('buildingName','Nom du bâtiment'),
      F('applianceLocation','Adresse de l’unité PEB'),
    ]},
    {title:'Système & appareil',hint:'Type de système et identification du générateur.',fields:[
      req(F('systemType','Type de système','select',{options:['Type 1 (1 chaudière ≤ 100 kW)','Type 2 (> 100 kW ou plusieurs chaudières)']})),
      F('collective','Individuel / collectif','select',{options:['Individuel (1 unité PEB)','Collectif (plusieurs unités PEB)']}),
      F('boilerCount','Nombre de chaudières','number',{min:1,step:1}),
      req(F('fuel','Combustible','select',{options:['Gazeux','Liquide (mazout)','Solide']})),
      req(F('powerKw','Puissance nominale utile (kW)','number',{min:0.01})),
      F('condensation','Condensation','select',{options:['À condensation','PAS à condensation']}),
      F('usage','Utilisation','select',{options:['Chauffage des locaux','Eau chaude sanitaire','Chauffage + ECS','Secours']}),
      F('connection','Montage','select',{options:['Type A','Type B','Type C','B22p / B23p']}),
      F('make','Marque'), F('model','Modèle'), F('serial','N° de série'),
      F('year','Année de fabrication','number',{min:1900,max:new Date().getFullYear()+1,step:1}),
      F('en437','Catégorie EN 437'),
      F('gasConversion','Conversion gaz','select',{options:['I2E+','I2N','I2E(S)','I2E(R)','Inconnue']}),
    ]},
    {title:'Exigences & mesures',hint:'Huit exigences de bon fonctionnement et mesures.',measure:true,fields:[
      req(F('coAmbient','CO dans l’air ambiant (ppm)','number',{min:0})),
      req({key:'o2',label:'O₂',type:'measure',unit:'%',max:4.4,lower:true,physicalMin:0,physicalMax:100}),
      req({key:'co2',label:'CO₂',type:'measure',unit:'%',min:8.5,physicalMin:0,physicalMax:100}),
      req({key:'co',label:'CO',type:'measure',unit:'mg CO/m³ à 13% O₂',max:150,lower:true,physicalMin:0}),
      req({key:'flueTemp',label:'Température gaz',type:'measure',unit:'°C',max:200,lower:true}),
      req(F('safety','Dispositifs de sécurité','select',{options:['OUI','NON']})),
      req(F('flueState','État des conduits','select',{options:['OUI','NON']})),
      req(F('orifices','Orifices de mesure','select',{options:['OUI','NON']})),
      req(F('ventilation','Ventilation du local','select',{options:['OUI','NON']})),
      req(F('draught','Exigence relative à la dépression','select',{options:['OUI','NON']})),
      req(F('draughtPa','Dépression mesurée (Pa)','number')),
      req(F('emissions','Émissions','select',{options:['OUI','NON']})),
      req(F('collectiveFlue','Cheminée collective B1','select',{options:['OUI','NON']})),
      F('annualConsumption','Consommation annuelle','number',{min:0}),
      F('operatingHours','Temps de fonctionnement (h/an)','number',{min:0}),
    ]},
    {title:'Déclaration',hint:'Conformité, dérogation et annexes.',fields:[
      req(F('conformity','Déclaration de conformité','select',{options:['CONFORME','NON CONFORME']})),
      F('derogation','Dérogation accordée','select',{options:['OUI','NON']}),
      F('stopProtocol','Protocole d’injonction d’arrêt','select',{options:['OUI','NON']}),
      F('defects','Causes / recommandations','textarea'),
      req(F('tickets','Tickets mesures initiales et finales','file')),
      F('annex1mw','Annexe ≥ 1000 kW','checkbox'),
      F('logbook','Carnet de bord (5 ans)','checkbox'),
      F('signature','Signature du professionnel','signature',
        {hint:'Facultatif. Tracez à la souris, au doigt ou au stylet, ou signez en tapant votre nom.'}),
    ]},
  ]
};

export function nextControlDate(data){
  if(!isValidDate(data?.controlDate)) return null;
  const rule=data?.conformity==='NON CONFORME' ? brussels.rules.nonConformity : brussels.rules.nextDue;
  const result=rule(data.controlDate,data);
  return result instanceof Date ? result : result.date;
}

export {fmt};
