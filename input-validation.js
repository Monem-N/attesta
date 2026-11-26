import {optionValues} from './lang.js';
import {isSignatureEmpty} from './signature.js';

export function isEmpty(value){
  if(value==null) return true;
  if(typeof value==='string') return value.trim()==='';
  if(Array.isArray(value)) return value.length===0;
  return false;
}

// Persisted JSON can contain objects with a null toString/valueOf. Never let
// such a value crash a predicate or renderer before the user can correct it.
export function scalarText(value){
  if(typeof value==='string') return value;
  if(typeof value==='number'||typeof value==='boolean') return String(value);
  return '';
}

export function parseNumber(value){
  if(typeof value==='number') return Number.isFinite(value)?value:null;
  if(typeof value!=='string') return null;
  const text=value.trim();
  if(!text || !/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
  const number=Number(text.replace(',','.'));
  return Number.isFinite(number)?number:null;
}

export function isValidDate(value){
  if(typeof value!=='string') return false;
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if(!match) return false;
  const year=Number(match[1]), month=Number(match[2]), day=Number(match[3]);
  if(year<1900 || month<1 || month>12 || day<1) return false;
  return day<=new Date(Date.UTC(year,month,0)).getUTCDate();
}

export function isValidTime(value){
  return typeof value==='string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isValidBce(value){
  if(typeof value!=='string') return false;
  const text=value.trim().toUpperCase().replace(/^BE\s*/,'').replace(/[.\s-]/g,'');
  return /^\d{10}$/.test(text);
}

export function isValidEmail(value){
  return typeof value==='string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function normalizeStep(value,max){
  const number=typeof value==='number'?value:typeof value==='string'?Number(value):NaN;
  if(!Number.isInteger(number)) return 0;
  return Math.max(0,Math.min(number,max));
}

export function hasOwn(object,key){
  return !!object && Object.prototype.hasOwnProperty.call(object,key);
}

// Native number inputs reject comma decimals and can silently clear the field.
// Keep numeric entry as text; validateField remains the source of truth.
export function fieldInputType(field){
  return field.type==='date'||field.type==='time'?field.type:'text';
}

export function errorAriaAttributes(id,error){
  return error?` aria-invalid="true" aria-describedby="${id}-error"`:'';
}

function numericFieldError(field,value){
  const number=parseNumber(value);
  if(number===null) return 'invalid';
  if(field.min!=null && number<field.min) return 'invalid';
  if(field.max!=null && number>field.max) return 'invalid';
  if(field.step!=null && field.step!=='any' && !Number.isInteger(number/field.step)) return 'invalid';
  return null;
}

function measurementError(field,value){
  const number=parseNumber(value);
  if(number===null) return 'invalid';
  if(field.physicalMin!=null && number<field.physicalMin) return 'invalid';
  if(field.physicalMax!=null && number>field.physicalMax) return 'invalid';
  return null;
}

function pairError(field,value){
  if(value==null || value==='') return field.required?'required':null;
  if(typeof value!=='object' || Array.isArray(value)) return 'invalid';
  const initial=value.i??'', final=value.f??'';
  if(field.required && (isEmpty(initial)||isEmpty(final))) return 'required';
  for(const part of [initial,final]){
    if(!isEmpty(part) && measurementError(field,part)) return 'invalid';
  }
  return null;
}

// A signature field holds either drawn strokes or a typed name. `isEmpty`
// treats any object as non-empty, so the signature case is handled explicitly.
function signatureValue(value){
  return value && typeof value==='object' && !Array.isArray(value) &&
    ('strokes' in value || 'typed' in value) ? value : null;
}
function signatureBlank(value){
  const sig=signatureValue(value);
  return sig ? isSignatureEmpty(sig) : true;
}
export function isEmptyFieldValue(field,value){
  if(field && field.type==='signature') return signatureBlank(value);
  return isEmpty(value);
}

export function validateField(field,value){
  if(field.type==='signature')
    return signatureBlank(value)?(field.required?'required':null):null;
  const blank=isEmpty(value);
  if(field.type==='checkbox'){
    if(value==null || value==='') return field.required?'required':null;
    if(typeof value!=='boolean') return 'invalid';
    return field.required && value!==true?'required':null;
  }
  if(field.type==='file'){
    if(blank) return field.required?'required':null;
    if(!Array.isArray(value) || value.some(name=>typeof name!=='string' || !name.trim())) return 'invalid';
    return null;
  }
  if(field.pair) return pairError(field,value);
  if(blank) return field.required?'required':null;

  if(field.type==='select'){
    return typeof value==='string' && optionValues(field).includes(value)?null:'invalid';
  }
  if(field.type==='number') return numericFieldError(field,value);
  if(field.type==='measure') return measurementError(field,value);
  if(field.type==='date') return isValidDate(value)?null:'invalid';
  if(field.type==='time') return isValidTime(value)?null:'invalid';
  if(typeof value!=='string') return 'invalid';
  if(field.format==='bce' && !isValidBce(value)) return 'invalid';
  if(field.format==='email' && !isValidEmail(value)) return 'invalid';
  return null;
}

export function measurementVerdict(field,value,rule,invalid=false){
  if(value===''||value==null) return 'idle';
  if(invalid) return 'invalid';
  const scalar=field.pair?{...field,pair:false}:field;
  if(validateField(scalar,value)) return 'invalid';
  if(!rule) return 'idle';
  const number=parseNumber(value);
  if(number===null) return 'invalid';
  const ok=(rule.max!=null?number<=rule.max:true)&&(rule.min!=null?number>=rule.min:true);
  return ok?'ok':'bad';
}

export function recognitionPattern(region,data){
  const category=typeof data.techCategory==='string'?data.techCategory:'';
  if(region==='flanders'){
    if(category.includes('gasvormige')) return /^GV\d{5}$/i;
    if(category.includes('vloeibare')) return /^TV\d{5}$/i;
    if(category.includes('VA+')) return /^VA\+\d{5}$/i;
  }
  if(region==='brussels'){
    if(/\bGII\b/.test(category)) return /^GII$/i;
    if(/\bGI\b/.test(category)) return /^GI$/i;
    if(/\bL\b/.test(category)) return /^L$/i;
    if(category.includes('RESCERT')) return /^RESCERT$/i;
  }
  if(region==='wallonia' && recognitionRequired(region,data)){
    return /^(?:(?:GII|GI|L)[\s-]?)?\d{1,7}$/i;
  }
  return null;
}

export function recognitionRequired(region,data){
  const category=typeof data.techCategory==='string'?data.techCategory:'';
  if(region==='flanders') return /gasvormige|vloeibare|VA\+/i.test(category);
  if(region==='wallonia') return /agréé\s+(?:L|GI|GII)\b/i.test(category);
  return false;
}

export function brusselsAnnexRequired(data){
  const power=parseNumber(data?.powerKw);
  return power!==null && power>=1000;
}

export function attachmentsForFields(fields,data,files){
  const selected=new Map();
  for(const field of fields.filter(f=>f.type==='file')){
    const names=Array.isArray(data?.[field.key])?data[field.key]:[];
    const current=(files?.get(field.key)||[]).filter(file=>names.includes(file.name));
    if(current.length) selected.set(field.key,current);
  }
  return selected;
}

export function hasMissingAttachments(fields,data,files){
  return fields.some(field=>{
    if(field.type!=='file') return false;
    const names=Array.isArray(data?.[field.key])?data[field.key]:[];
    if(!names.length) return false;
    const available=new Set((files?.get(field.key)||[]).map(file=>file?.name));
    return names.some(name=>!available.has(name));
  });
}

function isVisible(field,data){
  if(typeof field.when!=='function') return true;
  try{ return field.when(data); }catch(e){ return false; }
}

function walloniaFuelMatches(fuel,detail){
  const text=scalarText(detail);
  if(!text) return true;
  if(fuel==='Liquide') return /gasoil|fuel lourd/i.test(text);
  if(fuel==='Gazeux') return /gaz|propane|butane|biogaz/i.test(text);
  if(fuel==='Solide') return /pellets|bûches|plaquettes|céréales|charbon/i.test(text);
  return true;
}

export function validateWorkflow(config,data,files){
  const value=data && typeof data==='object' && !Array.isArray(data)?data:{};
  const errors={};
  const fields=config.steps.flatMap(step=>step.fields);
  const visible=fields.filter(field=>isVisible(field,value));
  for(const field of visible){
    const error=validateField(field,value[field.key]);
    if(error) errors[field.key]=error;
  }
  if(files && hasMissingAttachments(visible,value,files)){
    for(const field of visible.filter(f=>f.type==='file')){
      const names=Array.isArray(value[field.key])?value[field.key]:[];
      const available=new Set((files.get(field.key)||[]).map(file=>file?.name));
      if(names.length && names.some(name=>!available.has(name)) && !errors[field.key])
        errors[field.key]='missing';
    }
  }

  const agreement=visible.find(field=>field.key==='techAgrement');
  const pattern=recognitionPattern(config.id,value);
  if(agreement && pattern){
    const entered=scalarText(value.techAgrement);
    if(isEmpty(value.techAgrement) && recognitionRequired(config.id,value)) errors.techAgrement='required';
    else if(!isEmpty(value.techAgrement) && (!entered || !pattern.test(entered))) errors.techAgrement='invalid';
  }

  if(config.id==='wallonia'){
    const legacy=!isEmpty(value.clientStreet);
    const split=!isEmpty(value.clientStreetName) && !isEmpty(value.clientStreetNumber);
    if(!legacy && !split) errors.clientStreetName='required';
    else if(!isEmpty(value.clientStreetName) && isEmpty(value.clientStreetNumber)) errors.clientStreetNumber='required';
    if(isValidDate(value.controlDate) && isValidDate(value.commissioningDate) && value.commissioningDate>value.controlDate)
      errors.commissioningDate='invalid';
    if(!walloniaFuelMatches(value.fuel,value.fuelDetail)) errors.fuelDetail='invalid';
    if(value.conformity==='CONFORME'){
      for(const key of ['ventLocal','airSupply','flue']){
        if(isEmpty(value[key])) errors[key]='required';
        else if(/^non$/i.test(scalarText(value[key]))) errors.conformity='invalid';
      }
      if(/non\s*ok/i.test(scalarText(value.globalResult))) errors.conformity='invalid';
    }
    if(value.conformity==='NON CONFORME' && isEmpty(value.defects)) errors.defects='required';
    if(value.pumpIssue==='OUI' && isEmpty(value.regulationRemarks)) errors.regulationRemarks='required';
    if(value.raccordement==='C' && isEmpty(value.raccordementDetail)) errors.raccordementDetail='required';
    if(value.burnerType==='plusieurs allures' && isEmpty(value.load2)) errors.load2='required';
    if(value.plaque==='Absente' && isEmpty(value.year)) errors.year='required';
  }

  if(config.id==='brussels'){
    const power=parseNumber(value.powerKw);
    const count=parseNumber(value.boilerCount);
    const systemType=typeof value.systemType==='string'?value.systemType:'';
    if(systemType.startsWith('Type 1')){
      if(isEmpty(value.boilerCount)) errors.boilerCount='required';
      else if(count!==null && count!==1) errors.systemType='invalid';
      if(power!==null && power>100) errors.systemType='invalid';
    }
    if(systemType.startsWith('Type 2') && power!==null && power<=100 && (count===null || count<=1))
      errors.boilerCount='required';
    if(power!==null){
      if(power>=1000 && value.annex1mw!==true) errors.annex1mw='required';
      else if(power<1000 && value.annex1mw===true) errors.annex1mw='invalid';
    }
    if(value.conformity==='NON CONFORME' && isEmpty(value.defects)) errors.defects='required';
  }
  const allowed=new Set(visible.map(field=>field.key));
  for(const key of Object.keys(errors)) if(!allowed.has(key)) delete errors[key];
  return errors;
}

export function validateEnteredFields(config,data){
  const value=data && typeof data==='object' && !Array.isArray(data)?data:{};
  const errors=validateWorkflow(config,value);
  const fields=config.steps.flatMap(step=>step.fields);
  for(const key of Object.keys(errors)){
    const field=fields.find(f=>f.key===key);
    if(errors[key]==='required' && isEmptyFieldValue(field,value[key])) delete errors[key];
  }
  return errors;
}
