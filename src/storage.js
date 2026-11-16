
import { Preferences } from '@capacitor/preferences';
import {
  createEmptyRoutine,
  PERIOD_COUNT,
  DEFAULT_SECTIONS
} from './routine.js';

export const STORAGE_KEY = 'rrc-v1-data';

export const DATA_VERSION = 6;
export const BACKUP_FORMAT_VERSION = 1;

const BACKUP_APP_ID = 'RRC';

function createDefaultTimingHistory() {
  return [
    {
      effectiveFrom: '0000-00-00',
      periods: Array.from(
        { length: PERIOD_COUNT },
        (_, index) => ({
          period: index + 1,
          start: '',
          end: ''
        })
      )
    }
  ];
}

export function createDefaultData() {
  return {
    teachers: [],
    subjects: [],
    sections: [...DEFAULT_SECTIONS],

    masterRoutine: createEmptyRoutine(),
    routineVersions: [],

    teacherHistory: [],
    timingHistory: createDefaultTimingHistory(),

    records: [],
    dailyArchives: [],

    school: 'KMC',
    department: '',

    lastImport: null,
    legacyRoutine: null,

    dataVersion: DATA_VERSION
  };
}

/**
 * Adds defaults to older records without removing historical information.
 */
function migrateReplacementRecords(records) {
  if (!Array.isArray(records)) return [];

  return records.map(record => ({
    ...record,
    status: record.status || 'Assigned'
  }));
}

/**
 * Migrates older RRC data into the current storage structure.
 */
export function migrateData(oldData = {}) {
  const defaults = createDefaultData();

  const migrated = {
    ...defaults,
    ...oldData
  };

  migrated.records = migrateReplacementRecords(oldData.records);

  migrated.teachers = Array.isArray(oldData.teachers)
    ? oldData.teachers
    : [];

  migrated.subjects = Array.isArray(oldData.subjects)
    ? oldData.subjects
    : [];

  migrated.sections = Array.isArray(oldData.sections)
    ? oldData.sections
    : [...DEFAULT_SECTIONS];

  migrated.routineVersions = Array.isArray(oldData.routineVersions)
    ? oldData.routineVersions
    : [];

  migrated.teacherHistory = Array.isArray(oldData.teacherHistory)
    ? oldData.teacherHistory
    : [];

  migrated.timingHistory = Array.isArray(oldData.timingHistory)
    ? oldData.timingHistory
    : createDefaultTimingHistory();

  migrated.dailyArchives = Array.isArray(oldData.dailyArchives)
    ? oldData.dailyArchives
    : [];

  if (
    oldData.masterRoutine?.weekdays &&
    oldData.masterRoutine?.specialDates
  ) {
    migrated.masterRoutine = oldData.masterRoutine;
  } else if (
    oldData.routine?.weekdays &&
    oldData.routine?.specialDates
  ) {
    migrated.masterRoutine = oldData.routine;
  } else {
    migrated.legacyRoutine =
      oldData.legacyRoutine ||
      oldData.routine ||
      null;

    migrated.masterRoutine = createEmptyRoutine();
  }

  migrated.dataVersion = DATA_VERSION;

  return migrated;
}

export async function loadData() {
  const result = await Preferences.get({
    key: STORAGE_KEY
  });

  if (!result.value) {
    return createDefaultData();
  }

  try {
    return migrateData(JSON.parse(result.value));
  } catch (error) {
    console.error('Error loading RRC data:', error);

    throw new Error(
      'Your saved RRC data could not be read. Do not clear app storage.'
    );
  }
}

export async function saveData(data) {
  data.dataVersion = DATA_VERSION;

  await Preferences.set({
    key: STORAGE_KEY,
    value: JSON.stringify(data)
  });

  return true;
}

/**
 * Creates a versioned complete backup.
 *
 * The original app data is kept inside the "data" property.
 * This allows future versions to recognize the backup format.
 */
export function createBackup(data) {
  const backup = {
    app: BACKUP_APP_ID,
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    backupType: 'complete',
    createdAt: new Date().toISOString(),
    dataVersion: DATA_VERSION,
    data: JSON.parse(JSON.stringify(data))
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Reads both:
 * 1. New versioned RRC backup files.
 * 2. Older RRC backup files containing raw app data.
 */
export function restoreBackup(jsonText) {
  let parsed;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    throw new Error('Invalid RRC backup file.');
  }

  let backupData;

  if (parsed.app !== undefined || parsed.backupFormatVersion !== undefined) {
    if (parsed.app !== BACKUP_APP_ID) {
      throw new Error('This backup does not belong to RRC.');
    }

    if (
      !Number.isInteger(parsed.backupFormatVersion) ||
      parsed.backupFormatVersion < 1 ||
      parsed.backupFormatVersion > BACKUP_FORMAT_VERSION
    ) {
      throw new Error(
        'This backup format is not supported by this app version.'
      );
    }

    if (parsed.backupType !== 'complete') {
      throw new Error(
        'This file is not a complete RRC backup.'
      );
    }

    if (
      !parsed.data ||
      typeof parsed.data !== 'object' ||
      Array.isArray(parsed.data)
    ) {
      throw new Error('The backup does not contain valid RRC data.');
    }

    backupData = parsed.data;
  } else {
    // Compatibility with backups created by earlier RRC versions.
    backupData = parsed;
  }

  const recognizedFields = [
    'records',
    'teachers',
    'subjects',
    'masterRoutine',
    'routine',
    'sections'
  ];

  if (!recognizedFields.some(key =>
    Object.prototype.hasOwnProperty.call(backupData, key)
  )) {
    throw new Error('The selected file does not contain RRC data.');
  }

  return migrateData(backupData);
}
