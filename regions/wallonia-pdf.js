// Wallonia — calibrated page-by-page layout for assets/wa-attestation-bg.pdf.
// Page indices: 0..8; page 9 is the landscape category/performance table.
// Coordinates are glyph-top anchors measured from the official PDF.
import {wallonia, fmt} from './wallonia.js';
import {evaluateCriteria} from './wallonia-criteria.js';

export const WA_MAP={
  // page 1 — header, technician, demandeur, generator
  controlDate:[0,133,46], attestNumber:[0,467,46],
  techName:[0,122,104], techAgrement:[0,180,124], company:[0,122,138],
  techPhone:[0,65,151], bce:[0,145,172],
  clientName:[0,380,110], clientCompany:[0,401,128], clientStreet:[0,342,141],
  clientCity:[0,404,154], clientPhone:[0,350,180],
  applianceLocation:[0,487,192],
  fuelDetail:[0,430,233], genCount:[0,250,285],
  raccordement:[0,118,322], condensation:[0,122,343],
  year:[0,413,350], make:[0,341,338], model:[0,463,338], serial:[0,468,350],
  powerKw:[0,230,409], burnerType:[0,353,285], unitOrPulsed:[0,365,299], premix:[0,450,312],
  fluid:[0,470,384], production:[0,470,406],
  permisDate:[0,250,469], ventLocal:[0,275,491], airSupply:[0,292,504], flue:[0,336,518],
  orifices:[0,367,531], causes:[0,37,547], remarks:[0,197,647],
  intervention:[0,60,692], building:[0,310,692], techCategory:[0,60,708],
  requester:[0,310,708], fuel:[0,60,724],
  commissioningDate:[0,310,740], maintenanceIntervalMonths:[0,60,752],
  techEmail:[0,60,764], clientEmail:[0,310,764],
  // page 2 — measurement table, complementary data, declaration
  waterTemp:[1,137,72],
  smoke:[1,178,141], flueTemp:[1,226,141], co2:[1,274,141],
  o2:[1,315,141], co:[1,356,141], efficiency:[1,398,141],
  measureDate:[1,300,258], measureTime:[1,430,258],
  analyzerMake:[1,300,268], analyzerSerial:[1,430,268],
  load2:[1,60,700], load3:[1,300,700],
  cmpSmoke:[1,178.9,242.4], cmpFlueTemp:[1,226.5,242.4], cmpCo2:[1,277.2,242.4],
  cmpO2:[1,317.4,242.4], cmpCo:[1,358.9,242.4], cmpEfficiency:[1,399,242.4],
  globalResult:[1,461,501],
  chimneyPressure:[1,305,394], pumpPressure:[1,499,413],
  nozzleMake:[1,137,429], nozzleFlow:[1,386,429], nozzleAngle:[1,522,429],
  solidSmoke:[1,391,466], solidFlue:[1,391,486], solidResult:[1,300,515],
  conformity:[1,60,566], defects:[1,37,608],
  // page 3 — diagnostic tree and regulation
  diagReport:[2,500,56], diagModified:[2,500,131], diagAfter2015:[2,500,231],
  diagTwoYears:[2,500,296], diagDeferred:[2,500,426],
  regulationMode:[2,188,638], thermostat:[2,174.3,640.6], clock:[2,174.3,669.3],
  night:[2,174.3,698.6], pumpIssue:[2,174.3,724.1], regulationRemarks:[2,301,678],
  // page 4 — follow-up actions and signatures
  nextFrom:[3,160,61], nextTo:[3,300,61], remedyDate:[3,370,73],
  maintenanceDate:[3,380,111], diagnosticFrom:[3,160,137], diagnosticTo:[3,300,136],
  followUp:[3,43.5,54.1],
  techSignatureName:[3,37,162], recipientName:[3,305,162], recipientCapacity:[3,377,181],
};

// Comparison row: a printed OK / non OK pair for each measurement column.
export const WA_CHECKBOXES={
  cmpSmoke:{ok:[[178.9,242.4]],'non ok':[[178.9,252.1]]},
  cmpFlueTemp:{ok:[[226.5,242.4]],'non ok':[[226.5,252.1]]},
  cmpCo2:{ok:[[277.2,242.4]],'non ok':[[277.2,252.1]]},
  cmpO2:{ok:[[317.4,242.4]],'non ok':[[317.4,252.1]]},
  cmpCo:{ok:[[358.9,242.4]],'non ok':[[358.9,252.1]]},
  cmpEfficiency:{ok:[[399,242.4]],'non ok':[[399,252.1]]},
  followUp:{
    'prochaine inspection périodique':[[43.5,54.1]],
    'contrôle de mise en conformité':[[43.5,79.4]],
    'remise en service':[[43.5,92.2]],
    'entretien conseillé':[[43.5,117.5]],
    'diagnostic approfondi':[[43.5,130.1]],
  },
  solidSmoke:{oui:[[394.6,473.2]],non:[[436.1,473.2]]},
  solidFlue:{oui:[[394.6,492.6]],non:[[436.1,492.6]]},
  globalResult:{ok:[[394.6,506.2]],'non ok':[[436,506.2]]},
  conformity:{oui:[[40.5,566]],non:[[40.5,579.4]]},
  ventLocal:{oui:[[471.5,496.2]],non:[[506.9,496.2]]},
  airSupply:{oui:[[471.5,509.6]],non:[[506.9,509.6]]},
  flue:{oui:[[471.5,523.2]],non:[[506.9,523.2]]},
  orificesExempt:{oui:[[460.2,582.5]],non:[[500.8,582.5]]},
  condensationValue:{oui:[[122,342]],non:[[150,342]]},
  plaque:{absente:[[143,355]],présente:[[196,355]]},
  // Printed options on page 1 — selections are ticked, not written as extra text.
  techCategory:{
    'technicien agréé l':[[43.5,78.4],[145.4,78]],
    'technicien agréé gi':[[43.5,78.4],[180.9,78]],
    'technicien agréé gii':[[43.5,78.4],[217.6,78]],
    'technicien spécialisé en combustibles solides':[[43.5,91.2]],
    'technicien spécialisé combustibles solides':[[43.5,91.2]],
  },
  requester:{
    propriétaire:[[300.9,77.8]], locataire:[[300.9,90.3]], autre:[[300.9,102.9]],
  },
  fuelDetail:{
    // Solid fuels (row y 236.8)
    'pellets bois':[[102.9,236.8]], bûches:[[173.7,236.8]], plaquettes:[[237.6,236.8]],
    céréales:[[294.4,236.8]], charbon:[[344,236.8]],
    // Liquid fuels (row y 250.3)
    gasoil:[[102.9,250.3]], 'gasoil extra':[[173.7,250.3]], 'fuel lourd':[[237.6,250.3]],
    // Gaseous fuels (row y 263.8)
    'gaz nat. g20':[[102.9,263.8]], 'gaz nat. g25':[[173.7,263.8]],
    propane:[[237.6,263.8]], butane:[[294.4,263.8]], biogaz:[[344,263.8]],
  },
  burnerType:{
    '1 allure':[[298,290.9]], 'plusieurs allures':[[347,290.9]], modulant:[[506.7,290.9]],
  },
  unitOrPulsed:{unit:[[358.1,304.4]], 'air pulsé':[[443.2,304.4]]},
  premix:{prémix:[[443.2,317.9]], 'non-premix':[[506.9,317.9]]},
};

const addMonths=(iso,months)=>{
  const d=new Date(iso), day=d.getDate();
  d.setDate(1); d.setMonth(d.getMonth()+months);
  const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  d.setDate(Math.min(day,last));
  return d;
};

// Values the renderer derives rather than collects in the wizard.
export const WA_ALIASES={
  ventLocal:'ventLocal', airSupply:'airSupply', flue:'flue',
  orifices:'orifices', condensation:'condensation',
  solidSmoke:'solidSmoke', solidFlue:'solidFlue', globalResult:'globalResult',
  conformity:'conformity', followUp:'followUp',
  // These are printed as ticked options; suppress their duplicate text lines.
  techCategory:'techCategory', requester:'requester', fuelDetail:'fuelDetail',
  burnerType:'burnerType', unitOrPulsed:'unitOrPulsed', premix:'premix',
  fuel:'fuelDetail',
};
// Map-only keys: either derived values or aliases for fields that are printed
// as a ticked option instead of text.
export const WA_MAP_ONLY=new Set(['causes','remarks','flueTemp']);

// Per-field widths (pt) measured from the printed column boundaries. The
// generic renderer only knows the page edge, which let values cross the
// centre divider or run into the adjacent field on page 1.
export const WA_WIDTHS={
  controlDate:95, attestNumber:90,
  techName:165, techAgrement:100, company:165,
  techPhone:60, techEmail:230, bce:135,
  clientName:175, clientCompany:150, clientStreet:205, clientCity:145,
  clientPhone:60, clientEmail:230, applianceLocation:250,
  fuelDetail:120, genCount:40, powerKw:60, year:45,
  make:110, model:110, serial:120, raccordement:55,
  burnerType:90, unitOrPulsed:75, premix:75,
  fluid:90, production:90,
  intervention:230, building:230, techCategory:230, requester:230,
  fuel:230, commissioningDate:230, maintenanceIntervalMonths:230,
};

// Fields that must stay on one short line in a narrow printed slot.
export const WA_STYLES={
  techPhone:{size:7,maxLines:1}, clientPhone:{size:7,maxLines:1},
};
export const WA_COMPUTED_KEYS=new Set([
  'cmpSmoke','cmpFlueTemp','cmpCo2','cmpO2','cmpCo','cmpEfficiency','globalResult',
  'nextFrom','nextTo','remedyDate','maintenanceDate','diagnosticFrom','diagnosticTo',
]);

export function walloniaComputed(data){
  const out={...data};
  // Category-aware criteria from the official 2015-10-29 model, page 8. A field
  // with no printed rule for this category gets no tick and no OK text.
  const evaluation=evaluateCriteria(data);
  for(const [key,result] of Object.entries(evaluation.results)){
    if(result.verdict) out[`cmp${key[0].toUpperCase()}${key.slice(1)}`]=result.verdict;
  }
  if(evaluation.globalResult) out.globalResult=evaluation.globalResult;
  else delete out.globalResult;
  if(evaluation.category) out.waCategory=evaluation.category.code;
  // Never carry a stale computed date from a reloaded draft.
  for(const k of ['nextFrom','nextTo','diagnosticFrom','diagnosticTo','remedyDate','maintenanceDate']) delete out[k];
  const date=data.controlDate;
  if(date){
    try{
      // Conditional dates only. A date we cannot derive from collected facts
      // stays blank on the printed attestation instead of being guessed.
      const anchored=!!(data.commissioningDate || /première mise en service/i.test(data.intervention||''));
      if(anchored){
        const due=wallonia.rules.nextDue(date,data);
        out.nextFrom=fmt(due.from); out.nextTo=fmt(due.to);
        out.diagnosticFrom=out.nextFrom; out.diagnosticTo=out.nextTo;
      }
      if(/non conforme/i.test(data.conformity||''))
        out.remedyDate=fmt(wallonia.rules.nonConformity(date));
      const interval=Number(data.maintenanceIntervalMonths);
      if(Number.isFinite(interval)&&interval>0)
        out.maintenanceDate=fmt(addMonths(date,interval));
    }catch(e){ /* invalid date: leave the printed lines blank */ }
  }
  return out;
}
