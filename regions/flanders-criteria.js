import {parseNumber} from '../input-validation.js';

// Official Flanders LP/GP/GUP/GUnP A-D performance table.
const CATEGORIES = [
  {code:'LP A',fuel:'vloeibaar',burner:'pulsed',from:1998,to:9999,smoke:1,netTemp:null,co2:12,o2:4.4,co:155,efficiency:90},
  {code:'LP B',fuel:'vloeibaar',burner:'pulsed',from:1988,to:1997,smoke:1,netTemp:null,co2:11,o2:null,co:155,efficiency:88},
  {code:'LP C',fuel:'vloeibaar',burner:'pulsed',from:0,to:1987,smoke:2,netTemp:null,co2:10,o2:null,co:155,efficiency:85},
  {code:'GP A',fuel:'gasvormig',burner:'pulsed',from:1998,to:9999,smoke:null,netTemp:200,co2:8.5,o2:null,co:110,efficiency:90},
  {code:'GP B',fuel:'gasvormig',burner:'pulsed',from:1988,to:1997,smoke:null,netTemp:220,co2:7.5,o2:null,co:150,efficiency:88},
  {code:'GP C',fuel:'gasvormig',burner:'pulsed',from:0,to:1987,smoke:null,netTemp:250,co2:6.5,o2:null,co:270,efficiency:85},
  {code:'GUP A',fuel:'gasvormig',burner:'unit-premix',from:2007,to:9999,smoke:null,netTemp:180,co2:null,o2:null,co:110,efficiency:90},
  {code:'GUP B',fuel:'gasvormig',burner:'unit-premix',from:1998,to:2006,smoke:null,netTemp:180,co2:null,o2:null,co:150,efficiency:90},
  {code:'GUP C',fuel:'gasvormig',burner:'unit-premix',from:1988,to:1997,smoke:null,netTemp:200,co2:null,o2:null,co:150,efficiency:88},
  {code:'GUP D',fuel:'gasvormig',burner:'unit-premix',from:0,to:1987,smoke:null,netTemp:250,co2:null,o2:null,co:270,efficiency:84},
  {code:'GUnP A',fuel:'gasvormig',burner:'unit-nonpremix',from:2007,to:9999,smoke:null,netTemp:200,co2:null,o2:null,co:150,efficiency:88},
  {code:'GUnP B',fuel:'gasvormig',burner:'unit-nonpremix',from:1998,to:2006,smoke:null,netTemp:200,co2:null,o2:null,co:200,efficiency:88},
  {code:'GUnP C',fuel:'gasvormig',burner:'unit-nonpremix',from:1988,to:1997,smoke:null,netTemp:250,co2:null,o2:null,co:200,efficiency:86},
  {code:'GUnP D',fuel:'gasvormig',burner:'unit-nonpremix',from:0,to:1987,smoke:null,netTemp:300,co2:null,o2:null,co:300,efficiency:82}
];

export function categoryFor(fuelOrData, year, unitOrPulsed) {
  const data = fuelOrData && typeof fuelOrData === 'object'
    ? fuelOrData
    : {fuel:fuelOrData,year,unitOrPulsed};
  const fuel = typeof data.fuel === 'string' ? data.fuel.trim().toLowerCase() : '';
  const parsedYear = parseNumber(data.year);
  if (!['gasvormig','vloeibaar'].includes(fuel) || parsedYear === null || !Number.isInteger(parsedYear) || parsedYear < 1) return null;
  const burnerInput = typeof data.unitOrPulsed === 'string' ? data.unitOrPulsed.trim().toLowerCase() : '';
  let burner = 'unit-nonpremix';
  if (fuel === 'vloeibaar' || /air|puls/i.test(burnerInput)) burner = 'pulsed';
  else if (burnerInput.includes('premix') && !/non[ -]?premix/i.test(burnerInput)) burner = 'unit-premix';
  return CATEGORIES.find(category => category.fuel === fuel && category.burner === burner
    && parsedYear >= category.from && parsedYear <= category.to) || null;
}

const pairValue = (value, trial) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return trial === 1 ? value.i : value.f;
};

function criteriaSpecs(source) {
  const category = categoryFor(source);
  if (!category) return [];
  const gasText = typeof source.gas === 'string' ? source.gas : '';
  const lpg = (/propaan|butaan/i.test(gasText) || (source.fuel === 'gasvormig' && gasText && !/aardgas/i.test(gasText))) ? 15 : 0;
  return [
    ['smoke',category.smoke,'max',false],['netTemp',category.netTemp,'max',true],
    ['co2',category.co2,'min',true],['o2',category.o2,'max',true],
    ['co',category.co == null ? null : category.co + lpg,'max',true],['efficiency',category.efficiency,'min',true]
  ];
}

export function limitsForField(data) {
  const source = data && typeof data === 'object' ? data : {};
  const limits = {};
  for (const [key,limit,direction] of criteriaSpecs(source)) {
    if (limit != null) limits[key] = {[direction]:limit};
  }
  return limits;
}

export function computeVerdicts(data) {
  const source = data && typeof data === 'object' ? data : {};
  const specs = criteriaSpecs(source);
  if (!specs.length) return {};
  const verdicts = [];
  const output = {};
  let complete = true;
  for (const [key,limit,direction,paired] of specs) {
    if (limit == null) continue;
    for (const trial of paired ? [1,2] : [1]) {
      const raw = pairValue(source[key],trial);
      if (raw == null || raw === '') { complete = false; continue; }
      const value = parseNumber(raw);
      if (value === null) { complete = false; continue; }
      const ok = direction === 'min' ? value >= limit : value <= limit;
      output[`v_${key}_${trial}`] = ok ? 'OK' : 'Niet OK';
      verdicts.push(ok);
    }
  }
  if (verdicts.some(ok => !ok)) output.v_overall = 'Niet OK';
  else if (complete && verdicts.length) output.v_overall = 'OK';
  return output;
}
