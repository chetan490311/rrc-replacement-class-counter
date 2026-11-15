
import { Preferences } from '@capacitor/preferences';
import {
  createEmptyRoutine,
  PERIOD_COUNT
} from './routine.js';

export const STORAGE_KEY = 'rrc-v1-data';

function createDefaultTimingHistory() {
  return [
    {
      effectiveFrom: '0000-00-00',
      periods: Array.from({ length: PERIOD_COUNT }, (_, index) => ({
        period: index + 1,
        start: '',
        end: ''
      }))
    }
  ];
}

export function createDefaultData() {
  return {
    teachers: [],
    subjects: [],
    masterRoutine: createEmptyRoutine(),
    teacherHistory: [],
    timingHistory: createDefaultTimingHistory(),
    records: [],
    school: 'KMC',
    department: '',
    lastImport: null,
    legacyRoutine: null,
    dataVersion: 3
  };
}

export function migrateData(oldData = {}) {
  const defaults = createDefaultData();
  const migrated = { ...defaults, ...oldData };

  migrated.records = Array.isArray(oldData.records)
    ? oldData.records
    : [];

  migrated.teachers = Array.isArray(oldData.teachers)
    ? oldData.teachers
    : [];

  migrated.subjects = Array.isArray(oldData.subjects)
    ? oldData.subjects
    : [];

  migrated.teacherHistory = Array.isArray(oldData.teacherHistory)
    ? oldData.teacherHistory
    : [];

  migrated.timingHistory = Array.isArray(oldData.timingHistory)
    ? oldData.timingHistory
    : createDefaultTimingHistory();

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
      oldData.legacyRoutine || oldData.routine || null;

    migrated.masterRoutine = createEmptyRoutine();
  }

  migrated.dataVersion = 3;

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
    const oldData = JSON.parse(result.value);
    return migrateData(oldData);
  } catch (error) {
    console.error('Could not read saved RRC data:', error);

    throw new Error(
      'Your saved RRC data could not be read. Do not clear app storage.'
    );
  }
}

export async function saveData(data) {
  await Preferences.set({
    key: STORAGE_KEY,
    value: JSON.stringify(data)
  });

  return true;
}

export function createBackup(data) {
  return JSON.stringify(data, null, 2);
}

export function restoreBackup(jsonText) {
  const parsed = JSON.parse(jsonText);

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    throw new Error('Invalid RRC backup file.');
  }

  return migrateData(parsed);
}
