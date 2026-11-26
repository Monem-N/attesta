import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isEmpty, parseNumber, isValidDate, isValidTime, isValidBce, isValidEmail,
  normalizeStep, hasOwn, scalarText, validateField, fieldInputType, measurementVerdict,
  validateEnteredFields, errorAriaAttributes
} from '../input-validation.js';

test('scalar text conversion is safe for malformed persisted objects', () => {
  assert.equal(scalarText(' value '),' value ');
  assert.equal(scalarText(12.5),'12.5');
  assert.equal(scalarText(false),'false');
  assert.equal(scalarText({toString:null}),'');
  assert.equal(scalarText(null),'');
});

test('required text treats whitespace as empty', () => {
  assert.equal(isEmpty('   '), true);
  assert.equal(isEmpty('\n\t'), true);
  assert.equal(isEmpty(' 0 '), false);
  assert.equal(validateField({key:'name',type:'text',required:true}, '   '), 'required');
  assert.equal(validateField({key:'name',type:'text',required:true}, ' Ada '), null);
});

test('numbers accept comma decimals but reject malformed and non-finite values', () => {
  assert.equal(parseNumber(' 12,5 '), 12.5);
  assert.equal(parseNumber(' -2.75e1 '), -27.5);
  for (const value of ['', ' ', 'abc', 'NaN', 'Infinity', '1,2,3', {}, true]) {
    assert.equal(parseNumber(value), null, `parseNumber(${JSON.stringify(value)})`);
  }
});

test('number fields enforce finite values, integer steps, and physical bounds', () => {
  assert.equal(validateField({key:'powerKw',type:'number',min:0.01}, '12,5'), null);
  assert.equal(validateField({key:'powerKw',type:'number',min:0.01}, '0'), 'invalid');
  assert.equal(validateField({key:'year',type:'number',step:1}, '2026.5'), 'invalid');
  assert.equal(validateField({key:'coAmbient',type:'number',min:0}, '-1'), 'invalid');
  assert.equal(validateField({key:'coAmbient',type:'number',min:0}, 'oops'), 'invalid');
});

test('numeric fields use text entry so comma decimals are not silently erased', () => {
  assert.equal(fieldInputType({type:'number'}), 'text');
  assert.equal(fieldInputType({type:'date'}), 'date');
  assert.equal(fieldInputType({type:'time'}), 'time');
  assert.equal(fieldInputType({type:'text'}), 'text');
});

test('dates are real ISO calendar dates, not JavaScript rollover dates', () => {
  assert.equal(isValidDate('2024-02-29'), true);
  assert.equal(isValidDate('2026-02-29'), false);
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('2026-13-01'), false);
  assert.equal(isValidDate('2026-01-01T12:00:00Z'), false);
  assert.equal(validateField({key:'controlDate',type:'date',required:true}, '2026-02-30'), 'invalid');
});

test('measurement time uses a 24-hour HH:MM value', () => {
  assert.equal(isValidTime('09:05'), true);
  assert.equal(isValidTime('23:59'), true);
  assert.equal(isValidTime('24:00'), false);
  assert.equal(isValidTime('9:05'), false);
  assert.equal(validateField({key:'measureTime',type:'time'}, 'noon'), 'invalid');
});

test('BCE and email formats reject whitespace and malformed identifiers', () => {
  for (const value of ['0123.456.789', 'BE 0123-456-789', 'be0123456789']) {
    assert.equal(isValidBce(value), true, value);
  }
  for (const value of ['', '123', 'BE0123.456.78', 'BE0123.456.7890']) {
    assert.equal(isValidBce(value), false, value);
  }
  assert.equal(isValidEmail('tech@example.be'), true);
  assert.equal(isValidEmail(' tech@example.be '), true);
  assert.equal(isValidEmail('tech@example'), false);
  assert.equal(isValidEmail('tech @example.be'), false);
});

test('select, checkbox, and file fields reject malformed persisted shapes', () => {
  const select={key:'fuel',type:'select',required:true,options:[{v:'Gasvormig',l:{nl:'Gasvormig',fr:'Gazeux'}},'Vast']};
  assert.equal(validateField(select, 'Gasvormig'), null);
  assert.equal(validateField(select, 'Gazeux'), 'invalid');
  assert.equal(validateField(select, false), 'invalid');
  assert.equal(validateField(select, {}), 'invalid');

  const checkbox={key:'logbook',type:'checkbox'};
  assert.equal(validateField(checkbox, false), null);
  assert.equal(validateField(checkbox, 'false'), 'invalid');
  assert.equal(validateField({...checkbox,required:true}, false), 'required');

  const file={key:'tickets',type:'file'};
  assert.equal(validateField(file, []), null);
  assert.equal(validateField(file, ['initial.pdf','final.jpg']), null);
  assert.equal(validateField(file, 'initial.pdf'), 'invalid');
  assert.equal(validateField(file, ['']), 'invalid');
});

test('paired measurements require numeric object values and never use compliance limits as input validity', () => {
  const pair={key:'co',type:'measure',pair:true,max:150,lower:true};
  assert.equal(validateField(pair, {i:'200,5',f:'160'}), null);
  assert.equal(validateField(pair, {i:'abc',f:''}), 'invalid');
  assert.equal(validateField(pair, {i:'',f:' '}), null);
  assert.equal(validateField(pair, []), 'invalid');
  assert.equal(validateField(pair, '200'), 'invalid');
});

test('field formats are enforced only when a value is present', () => {
  assert.equal(validateField({key:'bce',type:'text',format:'bce'}, ''), null);
  assert.equal(validateField({key:'bce',type:'text',format:'bce'}, 'BE0123.456.789'), null);
  assert.equal(validateField({key:'bce',type:'text',format:'bce'}, 'bad'), 'invalid');
  assert.equal(validateField({key:'techEmail',type:'text',format:'email'}, ''), null);
  assert.equal(validateField({key:'techEmail',type:'text',format:'email'}, 'bad'), 'invalid');
});

test('measurement compliance limits never block a nonconforming reading', () => {
  assert.equal(validateField({key:'co',type:'measure',max:150,lower:true}, '200'), null);
  assert.equal(validateField({key:'co2',type:'measure',min:12}, '9'), null);
});

test('measurement physical bounds reject impossible values separately from compliance limits', () => {
  assert.equal(validateField({key:'smoke',type:'measure',physicalMin:0,physicalMax:9}, '9'), null);
  assert.equal(validateField({key:'smoke',type:'measure',physicalMin:0,physicalMax:9}, '10'), 'invalid');
  assert.equal(validateField({key:'co',type:'measure',physicalMin:0,max:150}, '-1'), 'invalid');
  assert.equal(validateField({key:'efficiency',type:'measure',physicalMin:0,physicalMax:100}, '101'), 'invalid');
});

test('paired measurement halves are classified individually', () => {
  const co={key:'co',type:'measure',pair:true,max:150,physicalMin:0};
  assert.equal(measurementVerdict(co,'120',{max:150}), 'ok');
  assert.equal(measurementVerdict(co,'200',{max:150}), 'bad');
  assert.equal(measurementVerdict(co,'-1',{max:150}), 'invalid');
  const o2={key:'o2',type:'measure',pair:true,max:4.4,physicalMax:100};
  assert.equal(measurementVerdict(o2,'3,2',{max:4.4}), 'ok');
  assert.equal(measurementVerdict(o2,'101',{max:4.4}), 'invalid');
  assert.equal(measurementVerdict(co,'',{max:150}), 'idle');
  assert.equal(measurementVerdict(co,'120',{max:150},true), 'invalid');
});

test('error ARIA attributes reference the rendered message id', () => {
  assert.equal(errorAriaAttributes('field-powerKw',true),
    ' aria-invalid="true" aria-describedby="field-powerKw-error"');
  assert.equal(errorAriaAttributes('field-powerKw',false),'');
});

test('entered-value validation exposes malformed drafts without flagging untouched blanks', () => {
  const config={id:'test',steps:[{fields:[
    {key:'name',type:'text',required:true},
    {key:'date',type:'date'},
    {key:'pair',type:'measure',pair:true,required:true},
    {key:'annex',type:'checkbox',required:true}
  ]}]};
  assert.deepEqual(validateEnteredFields(config,{}),{});
  assert.deepEqual(validateEnteredFields(config,{
    date:'2026-02-30',pair:{i:'3',f:''},annex:false
  }),{date:'invalid',pair:'required',annex:'required'});
});

test('URL steps are safe integers and region keys must be own properties', () => {
  assert.equal(normalizeStep('1.5', 6), 0);
  assert.equal(normalizeStep('-2', 6), 0);
  assert.equal(normalizeStep('99', 6), 6);
  assert.equal(normalizeStep('2', 6), 2);
  assert.equal(normalizeStep(JSON.parse('{"toString":null,"valueOf":null}'), 6), 0);
  assert.equal(hasOwn({wallonia:true}, 'wallonia'), true);
  assert.equal(hasOwn({}, 'constructor'), false);
  assert.equal(hasOwn({}, 'toString'), false);
});
