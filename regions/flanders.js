// Flanders — model-keuringsrapport / model-verbrandingsattest / model-reinigingsattest
// Bilingual wizard labels (nl/fr). Stored DATA VALUES stay canonical Dutch:
// the official Flemish PDFs and every rule below match those strings.
import {fmt} from './wallonia.js';
import {scalarText} from '../input-validation.js';

const B=(nl,fr)=>({nl,fr});
const O=(v,nl,fr=nl)=>({v,l:B(nl,fr)});
const F=(key,label,type='text',extra={})=>({key,label,type,...extra});
const req=f=>({...f,required:true});
const whenKeuring=d=>/Keuringsrapport/i.test(scalarText(d.document));
const whenNotKeuring=d=>!whenKeuring(d);
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

const yesNo=()=>[O('OK','OK'),O('Niet OK','Niet OK','Pas OK')];

export const flanders = {
  id: 'flanders',
  label: B('Vlaanderen','Flandre'),
  rule: '#b23a2b',
  lang: 'nl',
  output: 'pdf',
  documents: ['model-verbrandingsattest','model-reinigingsattest'],
  background: 'assets/fl-model-verbrandingsattest.pdf',
  recognition: [/^GV\d{5}$/i,/^TV\d{5}$/i,/^VA\+\d{5}$/i],

  rules: {
    nextDue(date,data){
      const d=new Date(date);
      const gas=/gas/i.test(scalarText(data.fuel));
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
    {title:B('Interventie','Intervention'),hint:B('Aard en datum van de keuring of het onderhoud.','Nature et date du contrôle ou de l’entretien.'),fields:[
      req(F('intervention',B('Type interventie','Type d’intervention'),'select',{options:[
        O('Periodiek onderhoud','Periodiek onderhoud','Entretien périodique'),
        O('Keuring eerste ingebruikname','Keuring eerste ingebruikname','Contrôle de première mise en service'),
        O('Controle na ingreep verbrandingsdeel','Controle na ingreep verbrandingsdeel','Contrôle après intervention sur le corps de combustion')]})),
      req(F('controlDate',B('Datum uitvoering','Date d’exécution'),'date')),
      F('attestNumber',B('Volgnummer attest (bedrijfsintern)','Numéro d’attestation (interne entreprise)')),
      req(F('document',B('Document','Document'),'select',{options:[
        O('Verbrandingsattest + reinigingsattest','Verbrandingsattest + reinigingsattest','Attestation de combustion + attestation de nettoyage'),
        O('Keuringsrapport + verbrandingsattest','Keuringsrapport + verbrandingsattest','Rapport de contrôle + attestation de combustion')]})),
    ]},
    {title:B('Technicus','Technicien'),hint:B('Erkende technicus — erkenningsnummer GV, TV of VA+.','Technicien agréé — numéro d’agrément GV, TV ou VA+.'),fields:[
      req(F('techCategory',B('Erkenning','Agrément'),'select',{options:[
        O('Erkend technicus gasvormige brandstof (GV)','Erkend technicus gasvormige brandstof (GV)','Technicien agréé combustible gazeux (GV)'),
        O('Erkend technicus vloeibare brandstof (TV)','Erkend technicus vloeibare brandstof (TV)','Technicien agréé combustible liquide (TV)'),
        O('Erkend verwarmingsaannemer (VA+)','Erkend verwarmingsaannemer (VA+)','Entreprise de chauffage agréée (VA+)'),
        O('Geschoold vakman (vaste brandstof)','Geschoold vakman (vaste brandstof)','Technicien qualifié (combustible solide)')]})),
      req(F('techName',B('Naam en voornaam','Nom et prénom'))),
      F('techAgrement',B('Erkenningsnummer (GV##### / TV##### / VA+#####)','Numéro d’agrément (GV##### / TV##### / VA+#####)')),
      req(F('company',B('Firma','Entreprise'))),
      req(F('bce',B('Ondernemingsnummer','Numéro d’entreprise'),'text',{format:'bce'})),
      F('techPhone',B('Telefoon / e-mail','Téléphone / e-mail')),
      F('workDuration',B('Arbeidsduur van — tot','Durée du travail de — à')),
    ]},
    {title:B('Klant','Client'),hint:B('Klant en adres van het stooktoestel indien verschillend.','Client et adresse du générateur si différente.'),fields:[
      req(F('clientName',B('Voornaam en achternaam','Prénom et nom'))),
      req(F('clientStreet',B('Straat en nummer','Rue et numéro'))),
      req(F('clientCity',B('Postnummer en gemeente','Code postal et localité'))),
      F('clientPhone',B('Telefoon / e-mail','Téléphone / e-mail')),
      F('applianceLocation',B('Adres stooktoestel indien verschillend','Adresse du générateur si différente')),
    ]},
    {title:B('Stooktoestel','Générateur'),hint:B('Kenmerken van het toestel.','Caractéristiques de l’appareil.'),fields:[
      req(F('fuel',B('Brandstof','Combustible'),'select',{options:[
        O('Gasvormig','Gasvormig','Gazeux'),
        O('Vloeibaar','Vloeibaar','Liquide'),
        O('Vast','Vast','Solide')]})),
      req(F('powerKw',B('Nominaal vermogen (kW)','Puissance nominale (kW)'),'number',{min:0.01})),
      F('central',B('Centraal toestel','Appareil central'),'select',{options:[O('Ja','Ja','Oui'),O('Nee','Nee','Non')]}),
      F('type',B('Type','Type'),'select',{options:[O('B','B'),O('C','C')]}),
      F('condensation',B('Condensatie','Condensation'),'select',{options:[O('Ja','Ja','Oui'),O('Nee','Nee','Non')]}),
      F('year',B('Bouwjaar','Année de construction'),'number',{min:1900,max:new Date().getFullYear()+1,step:1}),
      F('make',B('Merk','Marque')), F('model',B('Model','Modèle')), F('serial',B('Serienummer','Numéro de série')),
      F('unitOrPulsed',B('Brander','Brûleur'),'select',{options:[
        O('unit','unit'),O('unit premix','unit premix','unit prémélange'),O('unit non-premix','unit non-premix','unit non prémélangé'),O('air pulsed','air pulsed','air pulsé')]}),
    ]},
    {title:B('Metingen','Mesures'),hint:B('Proef I (initieel) en Proef II (eindmeting).','Essai I (initial) et essai II (mesure finale).'),measure:true,fields:[
      {key:'o2',label:B('Zuurstof (O₂)','Teneur en O₂'),type:'measure',unit:'%',max:4.4,lower:true,physicalMin:0,physicalMax:100,pair:true},
      {key:'co2',label:B('Koolstofdioxide (CO₂)','Teneur en CO₂'),type:'measure',unit:'%',min:12,physicalMin:0,physicalMax:100,pair:true},
      {key:'co',label:B('Koolstofmonoxide (CO)','Teneur en CO'),type:'measure',unit:'mg/kWh',max:150,lower:true,physicalMin:0,pair:true},
      {key:'flueTemp',label:B('Rookgastemperatuur','Température des gaz de combustion'),type:'measure',unit:'°C',max:200,lower:true,physicalMax:2000,pair:true},
      {key:'netTemp',label:B('Nettotemperatuur','Température nette'),type:'measure',unit:'°C',physicalMax:2000,pair:true},
      {key:'efficiency',label:B('Verbrandingsrendement (Hi)','Rendement de combustion (Hi)'),type:'measure',unit:'%',min:90,physicalMin:0,physicalMax:100,pair:true},
      F('smoke',B('Rookindex Bacharach (stookolie)','Indice de fumée Bacharach (mazout)'),'measure',{physicalMin:0,physicalMax:9}),
      F('draft',B('Druk rookgasafvoerkanaal (Pa)','Pression du conduit de fumée (Pa)'),'number'),
    ]},
    {title:B('Beoordeling','Évaluation'),hint:B('Conformiteit, gebreken en VEKA-registratie.','Conformité, défauts et enregistrement VEKA.'),fields:[
      req(F('conformity',B('Eindbeoordeling','Évaluation finale'),'select',{
        options:[
          O('Goed en veilig','Goed en veilig','Bon et sûr'),
          O('Niet goed','Niet goed','Pas bon'),
          O('Niet veilig','Niet veilig','Pas sûr')],when:whenNotKeuring})),
      ...['keuringInstructions','keuringBurner','keuringKetel','keuringVentilation',
        'keuringHydraulic','keuringElectrical'].map(key=>F(key,({
          keuringInstructions:B('Gebruikers- en onderhoudsinstructies','Instructions d’utilisation et d’entretien'),
          keuringBurner:B('Ingeregeld vermogen','Puissance réglée'),
          keuringKetel:B('Ketel — mantel','Chaudière — enveloppe'),
          keuringVentilation:B('Ventilatie stookplaats','Ventilation du local de chauffe'),
          keuringHydraulic:B('Hydraulische installatie — lekken','Installation hydraulique — fuites'),
          keuringElectrical:B('Elektrische installatie — zekering','Installation électrique — fusible'),
        })[key],'select',{options:yesNo(),when:whenKeuring})),
      ...['conformStooktoestel','conformRookgas','conformStookplaats','conformVerbranding'].map(key=>
        req(F(key,({
          conformStooktoestel:B('Stooktoestel conform','Générateur conforme'),
          conformRookgas:B('Rookgasafvoerkanaal conform','Conduit de fumée conforme'),
          conformStookplaats:B('Stookplaats conform','Local de chauffe conforme'),
          conformVerbranding:B('Verbrandingscontrole','Contrôle de la combustion'),
        })[key],'select',{options:yesNo(),when:whenKeuring}))),
      F('defects',B('Gebreken en maatregelen','Défauts et mesures'),'textarea'),
      F('remarks',B('Andere opmerkingen','Autres remarques'),'textarea'),
      req(F('vekaRef',B('VEKA registratiereferentie','Référence d’enregistrement VEKA'))),
      req(F('vekaDate',B('Datum registratie VEKA','Date d’enregistrement VEKA'),'date')),
      F('signature',B('Handtekening erkende technicus','Signature du technicien agréé'),'signature',
        {hint:B('Facultatief. Teken met muis, vinger of stylus, of onderteken door uw naam te typen.',
          'Facultatif. Tracez à la souris, au doigt ou au stylet, ou signez en tapant votre nom.')}),
    ]},
  ]
};

export {fmt, B, O, yesNo};
