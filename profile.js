// Per-device technician profile. Identity + per-region recognition, remembered
// in localStorage and reused to pre-fill new attestations. No backend, no sync.
// Pure helpers (no DOM) so they are unit-testable; storage access is isolated in
// load/save/clear and mirrors the defensiveness of app.js load()/save().
import {scalarText,isValidBce,isValidEmail,recognitionPattern} from './input-validation.js';

export const PROFILE_KEY = 'attesta.profile.v1';

// Single source of truth for the profile schema version. Read (migrateProfile)
// and write (emptyProfile/normalizeProfile/captureProfileFromData) paths all use
// it, so a future bump can't leave save emitting an older version than load.
export const PROFILE_VERSION = 1;

// Identity fields shared across regions. `techEmail` only exists in Wallonia but
// is stored here harmlessly; regions without the field simply ignore it.
export const IDENTITY_KEYS = ['techName', 'company', 'bce', 'techPhone', 'techEmail'];

// Recognition fields are region-specific (category options + number format
// differ), so they are stored per region, never shared across regions.
export const RECOGNITION_KEYS = ['techCategory', 'techAgrement'];

export const PROFILE_REGIONS = ['wallonia', 'flanders', 'brussels'];

export function emptyProfile() {
  return {v: PROFILE_VERSION, identity: {}, recognition: {}};
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Shape-only normalization. Known values are coerced with scalarText and unknown
// keys are dropped. Values are NEVER checked against optionValues/recognition
// patterns here: an inline-invalid agrement in the editor must survive a reload,
// not be silently wiped.
function normalizeBucket(source) {
  const out = {};
  if (!isPlainObject(source)) return out;
  for (const key of [...IDENTITY_KEYS, ...RECOGNITION_KEYS]) {
    if (Object.hasOwn(source, key)) {
      const text = scalarText(source[key]);
      if (text !== '') out[key] = text;
    }
  }
  return out;
}

export function normalizeProfile(value) {
  if (!isPlainObject(value)) return emptyProfile();
  const profile = emptyProfile();
  profile.identity = normalizeBucket(value.identity);
  if (isPlainObject(value.recognition)) {
    for (const region of PROFILE_REGIONS) {
      const bucket = normalizeBucket(value.recognition[region]);
      if (Object.keys(bucket).length) profile.recognition[region] = bucket;
    }
  }
  if (typeof value.updatedAt === 'string' && value.updatedAt) profile.updatedAt = value.updatedAt;
  return profile;
}

// Single entry point for reading a stored profile. Centralizes version handling
// so future field changes migrate here instead of orphaning saved data. Unknown
// keys are dropped and the version is stamped to the current one.
export function migrateProfile(raw) {
  if (!isPlainObject(raw)) return emptyProfile();
  let migrated = raw;
  // Future upgrades, e.g.:
  //   if (!migrated.v || migrated.v < 2) migrated = upgradeV1toV2(migrated);
  migrated = normalizeProfile(migrated);
  migrated.v = PROFILE_VERSION;
  return migrated;
}

export function loadProfile() {
  try {
    return migrateProfile(JSON.parse(localStorage.getItem(PROFILE_KEY)));
  } catch (e) {
    return emptyProfile();
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(normalizeProfile(profile)));
  } catch (e) {
    console.warn('Could not save technician profile', e);
  }
}

export function clearProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch (e) {
    console.warn('Could not clear technician profile', e);
  }
}

// Non-blocking inline validation for the editor. Returns an error code ('invalid')
// or null. Empty values are allowed (partial profiles are valid); only a present,
// malformed value is flagged. Recognition is checked against the region's pattern
// for the currently chosen category; if the category is unset/unrecognized there
// is no pattern and no error.
export function profileFieldError(profile, scope, region, key, value) {
  const text = scalarText(value).trim();
  if (text === '') return null;
  if (scope === 'identity') {
    if (key === 'bce') return isValidBce(text) ? null : 'invalid';
    if (key === 'techEmail') return isValidEmail(text) ? null : 'invalid';
    return null;
  }
  if (key === 'techAgrement') {
    const category = profile?.recognition?.[region]?.techCategory;
    const pattern = recognitionPattern(region, {techCategory: category});
    if (pattern && !pattern.test(text)) return 'invalid';
  }
  return null;
}

// Build the data object to merge into a fresh attestation: identity + the
// requested region's recognition only. Empty values are skipped so an empty
// profile never clobbers a field. Pure; returns a new object.
export function applyProfileToData(profile, region) {
  const data = {};
  const source = normalizeProfile(profile);
  for (const key of IDENTITY_KEYS) {
    const value = source.identity[key];
    if (value != null && value !== '') data[key] = value;
  }
  const recognition = source.recognition[region];
  if (recognition) {
    for (const key of RECOGNITION_KEYS) {
      const value = recognition[key];
      if (value != null && value !== '') data[key] = value;
    }
  }
  return data;
}

// Capture identity + the current region's recognition from a job's data into a
// NEW profile, deep-cloning so the result shares no references with `existing`
// or `data`. Only keys present in `data` (Object.hasOwn) are written, so
// clearing a field to '' updates the profile. Other regions and `v` are
// preserved.
export function captureProfileFromData(data, region, existing) {
  const base = normalizeProfile(existing);
  const source = isPlainObject(data) ? data : {};
  const profile = {
    v: PROFILE_VERSION,
    identity: {...base.identity},
    recognition: {},
  };
  for (const other of PROFILE_REGIONS) {
    profile.recognition[other] = {...(base.recognition[other] || {})};
  }
  for (const key of IDENTITY_KEYS) {
    if (Object.hasOwn(source, key)) profile.identity[key] = scalarText(source[key]);
  }
  if (!profile.recognition[region]) profile.recognition[region] = {};
  for (const key of RECOGNITION_KEYS) {
    if (Object.hasOwn(source, key)) profile.recognition[region][key] = scalarText(source[key]);
  }
  if (base.updatedAt) profile.updatedAt = base.updatedAt;
  return normalizeProfile(profile);
}