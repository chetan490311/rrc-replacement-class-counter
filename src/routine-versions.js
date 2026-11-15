
import { copyRoutine } from './routine.js';
import { validateBSDate } from './nepali-date.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date || '') &&
    Boolean(validateBSDate(date));
}

function versionScope(version) {
  return version.scope === 'section'
    ? `section:${version.section}`
    : 'school';
}

function versionMatches(version, bsDate) {
  return (
    version.effectiveFrom <= bsDate &&
    (!version.effectiveTo || version.effectiveTo >= bsDate)
  );
}

function latestVersion(versions) {
  return [...versions].sort((a, b) =>
    b.effectiveFrom.localeCompare(a.effectiveFrom)
  )[0] || null;
}

export function initializeRoutineVersions(data) {
  if (!Array.isArray(data.routineVersions)) {
    data.routineVersions = [];
  }

  return data.routineVersions;
}

export function getRoutineVersions(data) {
  return [...(data.routineVersions || [])].sort((a, b) =>
    a.effectiveFrom.localeCompare(b.effectiveFrom)
  );
}

/**
 * Returns the applicable routine for a date.
 *
 * Priority:
 * 1. Matching section-specific version.
 * 2. Matching whole-school version.
 * 3. Original master routine.
 *
 * A section-specific version replaces only that section.
 */
export function resolveRoutineForDate(data, bsDate) {
  if (!validDate(bsDate)) {
    throw new Error('Enter a valid BS date.');
  }

  const versions = data.routineVersions || [];

  const schoolVersions = versions.filter(version =>
    version.scope === 'school' &&
    versionMatches(version, bsDate)
  );

  const schoolVersion = latestVersion(schoolVersions);

  const baseRoutine = schoolVersion
    ? schoolVersion.routine
    : data.masterRoutine;

  const result = copyRoutine(baseRoutine);

  const sections = data.sections || [];

  for (const section of sections) {
    const sectionVersions = versions.filter(version =>
      version.scope === 'section' &&
      version.section === section &&
      versionMatches(version, bsDate)
    );

    const sectionVersion = latestVersion(sectionVersions);

    if (!sectionVersion) continue;

    const override = sectionVersion.routine;

    for (const day of Object.keys(result.weekdays || {})) {
      const sectionPeriods = override.weekdays?.[day]?.[section];

      if (sectionPeriods) {
        if (!result.weekdays[day]) {
          result.weekdays[day] = {};
        }

        result.weekdays[day][section] = clone(sectionPeriods);
      }
    }

    // Apply this section's Sunday special routines too.
    const specialDates = override.specialDates || {};

    for (const [date, special] of Object.entries(specialDates)) {
      if (!special.sections?.[section]) continue;

      if (!result.specialDates[date]) {
        result.specialDates[date] = clone(special);
        result.specialDates[date].sections = {};
      }

      if (!result.specialDates[date].sections) {
        result.specialDates[date].sections = {};
      }

      result.specialDates[date].sections[section] =
        clone(special.sections[section]);
    }
  }

  return result;
}

/**
 * Creates a new version by copying the routine currently applicable
 * on its effective start date.
 */
export function createRoutineVersion(data, details) {
  initializeRoutineVersions(data);

  const {
    name,
    scope,
    section = '',
    effectiveFrom,
    effectiveTo = ''
  } = details;

  if (!name?.trim()) {
    throw new Error('Enter a name for this routine version.');
  }

  if (!['school', 'section'].includes(scope)) {
    throw new Error('Choose whole school or a specific section.');
  }

  if (scope === 'section' &&
      !(data.sections || []).includes(section)) {
    throw new Error('Choose a valid section.');
  }

  if (!validDate(effectiveFrom)) {
    throw new Error('Enter a valid BS start date.');
  }

  if (effectiveTo && !validDate(effectiveTo)) {
    throw new Error('Enter a valid BS end date.');
  }

  if (effectiveTo && effectiveTo < effectiveFrom) {
    throw new Error('The end date cannot be earlier than the start date.');
  }

  const candidate = {
    scope,
    section,
    effectiveFrom,
    effectiveTo
  };

  const overlaps = data.routineVersions.some(version => {
    if (versionScope(version) !== versionScope(candidate)) {
      return false;
    }

    const existingEnd = version.effectiveTo || '9999-99-99';
    const newEnd = effectiveTo || '9999-99-99';

    return (
      effectiveFrom <= existingEnd &&
      version.effectiveFrom <= newEnd
    );
  });

  if (overlaps) {
    throw new Error(
      'Another version for this same scope already covers part of this date range. Adjust its dates first.'
    );
  }

  const sourceRoutine = resolveRoutineForDate(data, effectiveFrom);

  const version = {
    id: crypto.randomUUID(),
    name: name.trim(),
    scope,
    section: scope === 'section' ? section : '',
    effectiveFrom,
    effectiveTo,
    routine: copyRoutine(sourceRoutine),
    createdAt: new Date().toISOString()
  };

  data.routineVersions.push(version);

  return version;
}

export function updateRoutineVersion(data, versionId, changes) {
  const version = data.routineVersions?.find(
    item => item.id === versionId
  );

  if (!version) {
    throw new Error('Routine version not found.');
  }

  if (changes.routine) {
    version.routine = copyRoutine(changes.routine);
  }

  if (changes.name !== undefined) {
    if (!changes.name.trim()) {
      throw new Error('Routine version name cannot be empty.');
    }

    version.name = changes.name.trim();
  }

  return version;
}

export function deleteRoutineVersion(data, versionId) {
  const before = data.routineVersions?.length || 0;

  data.routineVersions = (data.routineVersions || []).filter(
    version => version.id !== versionId
  );

  return data.routineVersions.length < before;
}
