
import { Preferences } from '@capacitor/preferences';
import { createEmptyRoutine } from './routine.js';

export const STORAGE_KEY = 'rrc-v1-data';

export function createDefaultData() {
  return {
    teachers: [],
    masterRoutine: createEmptyRoutine(),
    teacherHistory: [],
    records: [],
    school: 'KMC',
    department: '',
    lastImport: null,

    // Retain the old timetable for reference during migration.
    legacyRoutine: null,

    dataVersion: 2
  };
}

// Migrate existing data without deleting teachers or replacement records.
export function migrateData(oldData = {}) {
  const defaults = createDefaultData();

  const migrated = {
    ...defaults,
    ...oldData
  };

  // Preserve existing replacement records.
  migrated.records = Array.isArray(oldData.records)
    ? oldData.records
    : [];

  // Preserve existing teacher directory.
  migrated.teachers = Array.isArray(oldData.teachers)
    ? oldData.teachers
    : [];

  // Preserve historical teacher changes if already available.
  migrated.teacherHistory = Array.isArray(oldData.teacherHistory)
    ? oldData.teacherHistory
    : [];

  // Keep an existing new-format master routine.
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
    // Do not discard the previous timetable.
    migrated.legacyRoutine =
      oldData.legacyRoutine || oldData.routine || null;

    migrated.masterRoutine = createEmptyRoutine();
  }

  migrated.dataVersion = 2;

  return migrated;
}

// Load saved data from the device.
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

// Save all RRC data to the device.
export async function saveData(data) {
  await Preferences.set({
    key: STORAGE_KEY,
    value: JSON.stringify(data)
  });

  return true;
}

// Export a complete backup.
export function createBackup(data) {
  return JSON.stringify(data, null, 2);
}

// Restore data from a JSON backup.
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
