// Wallonia — Attestation de contrôle d'un générateur de chaleur (AWAC model)
const F = (key, label, type='text', extra={}) => ({key,label,type,...extra});
const req = f => ({...f,required:true});
const addMonths=(date,months)=>{
  const d=new Date(date); const day=d.getDate();
  d.setDate(1); d.setMonth(d.getMonth()+months);
  const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  d.setDate(Math.min(day,last));
  return d;
};
const addYears=(date,years)=>{
  const d=new Date(date); const month=d.getMonth(); const day=d.getDate();
  d.setMonth(0); d.setDate(1); d.setFullYear(d.getFullYear()+years);
  d.setMonth(month);
  const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  d.setDate(Math.min(day,last));
  return d;
};

export const wallonia = {
  id: 'wallonia',
  label: 'Wallonie',
  rule: '#b23a2b',
  lang: 'fr',
  output: 'pdf',
  background: 'assets/wa-attestation-bg.pdf',
  recognition: [/^L\d*$/i,/^GI\d*$/i,/^GII\d*$/i],

  rules: {
    nextDue(date, data) {
      const kw = Number(data.powerKw) || 0;
      const gas = /gaz/i.test(data.fuel||'');
      let years = 1;
      if (gas && kw <= 100) years = 3;      // AGW art.13 (law governs at exactly 100 kW)
      else if (gas && kw > 100) years = 2;
      // Art. 13 §2: the cycle is anchored to the generator's first commissioning,
      // with a three-month window after the anniversary — not to the last control.
      const anchorSource = data.commissioningDate
        || (/première mise en service/i.test(data.intervention||'') ? date : null);
      const anchor = new Date(anchorSource || date);
      const control = new Date(date);
      if (Number.isNaN(anchor.getTime()) || Number.isNaN(control.getTime()))
        throw new Error('invalid commissioning date');
      // Art. 13 §2: find the first anniversary STRICTLY AFTER the completed
      // control, not the anniversary that the control itself falls on.
      // Compute the number of whole cycles elapsed directly so very old
      // installations (e.g. 1970) never hit an iteration cap and stop early.
      const elapsedYears=(control-anchor)/(365.25*24*3600*1000)/years;
      let cycles=Math.max(1,Math.floor(elapsedYears)+1);
      let due=addYears(anchor,cycles*years);
      // Correct in both directions: month/day ordering can put the estimated
      // anniversary on either side of the control date.
      while(due>control && cycles>1) due=addYears(anchor,--cycles*years);
      while(due<=control) due=addYears(anchor,++cycles*years);
      const from=due;
      const to=addMonths(due,3);
      const caveat = anchorSource ? ''
        : " (à défaut de date de mise en service — vérifiez l'échéance)";
      return { date: due, from, to, years, anchor, anchoredTo: anchorSource||date,
        conflict: gas && kw === 100,
        note: `Contrôle à réaliser entre le ${fmt(from)} et le ${fmt(to)}${caveat}` };
    },
    nonConformity(date){ return addMonths(date,5); },
    residentialException(data){ return /habitation|résidentiel/i.test(data.building||''); }
  },

  steps: [
    { title:'Intervention', hint:'Nature et date du contrôle.', fields:[
      req(F('intervention','Type d’intervention','select',{options:['Contrôle périodique','Contrôle après intervention combustion','Mise en conformité','Première mise en service']})),
      req(F('controlDate','Date du contrôle','date')),
      F('commissioningDate','Date de première mise en service du générateur','date',
        {hint:'Art. 13 §2 : l’échéance se calcule depuis cette date, pas depuis le dernier contrôle.'}),
      F('attestNumber','N° attestation (facultatif)'),
      F('building','Type de bâtiment','select',{options:['Habitation','Collectif / autre']}),
      F('maintenanceIntervalMonths','Intervalle d’entretien conseillé (mois)','number',
        {hint:'Facultatif. Sans intervalle, aucune date d’entretien n’est imprimée.'}),
      F('measureDate','Date de la mesure','date'),
      F('measureTime','Heure de la mesure'),
      F('analyzerMake','Appareil de mesure — marque / modèle'),
      F('analyzerSerial','Appareil de mesure — n° de série'),
    ]},
    { title:'Technicien', hint:'Qui a réalisé le contrôle ?', fields:[
      req(F('techCategory','Agrément','select',{options:['Technicien agréé L','Technicien agréé GI','Technicien agréé GII','Technicien spécialisé combustibles solides']})),
      req(F('techName','Nom et prénom')),
      F('techAgrement','N° d’agrément'),
      req(F('company','Nom entreprise')),
      req(F('bce','N° entreprise (BCE)')),
      F('techPhone','Téléphone'),
      F('techEmail','Courriel'),
    ]},
    { title:'Demandeur', hint:'Le demandeur et le lieu du générateur.', fields:[
      req(F('requester','Demandeur','select',{options:['Propriétaire','Locataire','Autre']})),
      req(F('clientName','Nom et prénom')),
      F('clientCompany','Entreprise (si pertinent)'),
      // New split fields; `clientStreet` is kept as a legacy combined value so
      // earlier drafts still render (see renderer fallback).
      F('clientStreetName','Rue'),
      F('clientStreetNumber','Numéro'),
      F('clientStreet','Rue et numéro (ancien format)'),
      req(F('clientCity','Code postal et localité')),
      F('clientPhone','Téléphone'),
      F('clientEmail','Courriel'),
      F('applianceLocation','Localisation du générateur si différente'),
    ]},
    { title:'Générateur', hint:'Identification de l’appareil et du brûleur.', fields:[
      req(F('fuel','Combustible','select',{options:['Liquide','Gazeux','Solide']})),
      F('fuelDetail','Détail combustible','select',{options:['Gasoil','Gasoil extra','Fuel lourd','Gaz nat. G20','Gaz nat. G25','Propane','Butane','Biogaz','Pellets bois','Bûches','Plaquettes','Céréales','Charbon']}),
      req(F('powerKw','Puissance nominale utile (kW)','number')),
      F('genCount','Nb de générateurs','number'),
      F('raccordement','Raccordement','select',{options:['B','C']}),
      F('condensation','À condensation','select',{options:['oui','non']}),
      F('year','Année de construction','number'),
      F('make','Marque'), F('model','Type'), F('serial','N° série'),
      F('burnerType','Brûleur','select',{options:['1 allure','plusieurs allures','modulant']}),
      F('unitOrPulsed','Type','select',{options:['unit','air pulsé']}),
      F('premix','Prémix','select',{options:['prémix','non-premix']}),
      F('fluid','Fluide caloporteur','select',{options:['Eau','Vapeur basse pression','Huile thermique']}),
      F('production','Production','select',{options:['Chauffage','ECS','Chauffage + ECS']}),
      F('raccordementDetail','Détail raccordement (ex. C 53)'),
      F('burnerModel','Type du brûleur (ex. Top 22/28-3)'),
      F('plaque','Plaque signalétique','select',{options:['Absente','Présente']}),
    ]},
    { title:'Mesures & critères', hint:'Valeurs relevées. Le résultat se résout en OK / non OK.', measure:true, fields:[
      F('permisDate','Permis d’urbanisme','select',{options:['Avant le 29/05/2009','Après le 29/05/2009']}),
      F('ventLocal','Ventilation local','select',{options:['OUI','NON']}),
      F('airSupply','Amenée d’air comburant','select',{options:['OUI','NON']}),
      F('flue','Évacuation gaz de combustion','select',{options:['OUI','NON']}),
      F('orifices','Orifices de mesure','select',{options:['Dispensé','Présent et conforme','Présent et non conforme','Absent et techniquement non réalisable']}),
      // Limits are NOT stored on the field: they depend on the official category
      // (fuel / burner / premix / year) and are resolved by wallonia-criteria.js.
      {key:'smoke',label:'Indice de fumée (Bacharach)',type:'measure',unit:''},
      {key:'flueTemp',label:'Température des gaz de combustion',type:'measure',unit:'°C'},
      {key:'o2',label:'Teneur en O₂',type:'measure',unit:'%'},
      {key:'co2',label:'Teneur en CO₂',type:'measure',unit:'%'},
      {key:'co',label:'Teneur en CO',type:'measure',unit:'mg/kWh'},
      {key:'efficiency',label:'Rendement combustion',type:'measure',unit:'%'},
      {key:'waterTemp',label:'Température de l’eau',type:'measure',unit:'°C'},
      // The comparison row is the technician's own judgement. The computed
      // verdict is offered as a default, but these fields are authoritative.
      F('cmpSmoke','Comparaison — indice de fumée','select',{options:['','OK','non OK']}),
      F('cmpFlueTemp','Comparaison — température gaz','select',{options:['','OK','non OK']}),
      F('cmpCo2','Comparaison — CO₂','select',{options:['','OK','non OK']}),
      F('cmpO2','Comparaison — O₂','select',{options:['','OK','non OK']}),
      F('cmpCo','Comparaison — CO','select',{options:['','OK','non OK']}),
      F('cmpEfficiency','Comparaison — rendement','select',{options:['','OK','non OK']}),
      F('globalResult','Résultat global','select',{options:['','OK','non OK']}),
      F('chimneyPressure','Pression cheminée (type B)','number'),
      F('pumpPressure','Pression pompe (bar)','number'),
      F('load2','Allure 2 — valeurs','text',{hint:'Facultatif, brûleurs multiples/modulants. Ex. : CO₂ 11 / O₂ 4 / CO 100 / rendement 91'}),
      F('load3','Allure 3 — valeurs','text'),
      F('nozzleMake','Gicleur — marque & type'),
      F('nozzleFlow','Gicleur — débit (gal/h)'),
      F('nozzleAngle','Gicleur — angle (degré)'),
      F('solidSmoke','Fumée très brève (solide)','select',{options:['OUI','NON']}),
      F('solidFlue','Évacuation correcte (solide)','select',{options:['OUI','NON']}),
      F('solidResult','Résultat global (solide)','select',{options:['OK','non OK']}),
    ]},
    { title:'Déclaration', hint:'Diagnostic, conformité et prochaines interventions.', fields:[
      F('diagReport','Diagnostic approfondi présent ?','select',{options:['OUI','NON']}),
      F('diagModified','Modification depuis ?','select',{options:['OUI','NON']}),
      F('diagAfter2015','Modification après 30/04/2015 ?','select',{options:['OUI','NON']}),
      F('diagTwoYears','Au moins 2 ans ?','select',{options:['OUI','NON']}),
      F('diagDeferred','Déjà reporté ?','select',{options:['OUI','NON']}),
      req(F('conformity','Déclaration de conformité','select',{options:['CONFORME','NON CONFORME']})),
      F('defects','Causes / actions','textarea'),
      F('regulationMode','Régulation','select',{options:['AUTO','MAN']}),
      F('thermostat','Thermostat','select',{options:['OUI','NON']}),
      F('clock','Horloge','select',{options:['OUI','NON']}),
      F('night','Mode réduit nuit','select',{options:['OUI','NON']}),
      F('pumpIssue','Indices dysfonctionnement pompe','select',{options:['OUI','NON']}),
      F('regulationRemarks','Remarques régulation','textarea'),
    ]},
    { title:'Suivi & signatures', hint:'Prochaines interventions et réception de l’attestation.', fields:[
      F('followUp','Prochaine intervention','select',{options:[
        'Prochaine inspection périodique','Contrôle de mise en conformité',
        'Remise en service','Entretien conseillé','Diagnostic approfondi']}),
      F('techSignatureName','Attestation établie par (nom)'),
      F('recipientName','Attestation reçue par (nom)'),
      F('recipientCapacity','En qualité de'),
    ]},
  ]
};

export function fmt(d){
  const p=n=>String(n).padStart(2,'0');
  return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()}`;
}
