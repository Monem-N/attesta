// Legacy fixed-coordinate maps for Wallonia and Brussels.
// These are still label anchors, not fully calibrated rendering positions —
// see docs/field-matrix.md and docs/pdf-pipeline-tasks.md (P0-5, P0-8).
export const LEGACY_MAPS={
  wallonia:{
    controlDate:[0,140,53], attestNumber:[0,470,53],
    techName:[0,165,106], techAgrement:[0,180,131], company:[0,205,148],
    techPhone:[0,275,164], bce:[0,205,180],
    clientName:[0,470,106], clientStreet:[0,455,172], clientCity:[0,455,186], clientPhone:[0,455,200],
    applianceLocation:[0,180,196],
    fuelDetail:[0,250,262],
    genCount:[0,230,289], raccordement:[0,230,331], condensation:[0,330,344],
    year:[0,200,369], make:[0,150,381], model:[0,300,381], serial:[0,200,394], powerKw:[0,230,409],
    burnerType:[0,430,309], unitOrPulsed:[0,420,322], premix:[0,420,334],
    fluid:[0,470,384], production:[0,470,406],
    permisDate:[0,250,469], ventLocal:[0,470,492], airSupply:[0,470,506], flue:[0,470,519],
    orifices:[0,120,622],
    smoke:[1,185,166], o2:[1,330,166], co2:[1,285,166], co:[1,372,166], efficiency:[1,403,166],
    chimneyPressure:[1,281,400], pumpPressure:[1,437,416],
    conformity:[1,60,566], defects:[1,120,603],
    diagReport:[2,500,56], diagModified:[2,500,129], diagAfter2015:[2,500,228],
    diagTwoYears:[2,500,292], diagDeferred:[2,500,423],
    regulationMode:[2,188,638], thermostat:[2,206,666], clock:[2,206,691],
    night:[2,206,716], pumpIssue:[2,494,656],
    intervention:[0,60,692], building:[0,310,692], techCategory:[0,60,708],
    requester:[0,310,708], fuel:[0,60,724], clientCompany:[0,310,724],
    commissioningDate:[0,310,740],
  },
  brussels:{
    // page 1 — act, parties, declaration, requirements
    intervention:[0,300,80], controlDate:[0,130,90], attestNumber:[0,470,90], motif:[0,130,80],
    nextDueDate:[0,164,323],
    ownerType:[0,130,141], clientName:[0,420,141], clientStreet:[0,370,172], clientCity:[0,370,182],
    contactName:[0,130,193], contactPhone:[0,130,213],
    pebUnitRef:[0,140,162], floor:[0,110,151], buildingName:[0,140,172],
    applianceLocation:[0,130,131],
    company:[0,160,609], techName:[0,370,681], techAgrement:[0,400,671],
    techCategory:[0,306,650], tickets:[2,60,235],
    signature:[0,54,698],
    bce:[0,140,671], techPhone:[0,130,650],
    conformity:[0,300,286], stopProtocol:[0,400,303], derogation:[0,400,313],
    coAmbient:[0,400,392], safety:[0,400,413], flueState:[0,400,433],
    orifices:[0,400,454], ventilation:[0,400,464], draught:[0,400,474],
    emissions:[0,400,484], collectiveFlue:[0,400,494],
    // page 2 — system / appliance / dimensioning
    systemType:[1,400,108], collective:[1,400,118], boilerCount:[1,390,107],
    condensation:[1,400,169], usage:[1,400,179], connection:[1,400,241],
    fuel:[1,400,293], powerKw:[1,200,221],
    make:[1,180,200], model:[1,180,210], serial:[1,400,200], year:[1,400,210],
    en437:[1,400,262], gasConversion:[1,400,252],
    annualConsumption:[1,260,458], operatingHours:[1,260,489],
    defects:[2,60,215],
    annex1mw:[3,220,133], logbook:[2,400,127],
    // page 4 (landscape, already part of the official model) — combustion table
    o2:[3,520,367], co2:[3,520,387], co:[3,520,407], flueTemp:[3,520,427],
    draughtPa:[3,520,258],
  }
};

// Fields added by the renderer from rules/state, not collected by a wizard step.
export const COMPUTED_KEYS=new Set(['nextDueDate']);
