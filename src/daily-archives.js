
import { validateBSDate } from './nepali-date.js';
import {
  PERIOD_COUNT,
  getAssignmentTeachers
} from './routine.js';
import { resolveRoutineForDate } from './routine-versions.js';
import { getTeacherForDate } from './teacher-history.js';
import { getTimingsForDate } from './period-timings.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getRoutineSections(routine, bsDate, weekday) {
  if (weekday === 'Saturday') return null;

  if (weekday === 'Sunday') {
    return routine?.specialDates?.[bsDate]?.sections || null;
  }

  return routine?.weekdays?.[weekday] || null;
}

function applyConductedReplacements(
  assignment,
  records,
  bsDate,
  section,
  period
) {
  const actual = clone(assignment);
  const scheduledTeachers = getAssignmentTeachers(assignment);

  let actualTeachers = clone(scheduledTeachers);
  const appliedReplacements = [];

  const matchingRecords = (records || []).filter(record =>
    record.dateBS === bsDate &&
    record.section === section &&
    Number(record.period) === period &&
    record.status === 'Conducted'
  );

  for (const record of matchingRecords) {
    const originalTeacherId = record.assignedTeacherId ||
      assignment.teacherId ||
      '';

    const teacherIndex = actualTeachers.findIndex(
      teacher => teacher.id === originalTeacherId
    );

    if (teacherIndex === -1 || !record.teacherId) {
      continue;
    }

    const replacementTeacher = {
      id: record.teacherId,
      name: record.teacher || '',
      initials: record.initials || ''
    };

    actualTeachers[teacherIndex] = replacementTeacher;

    appliedReplacements.push({
      recordId: record.id,
      originalTeacherId,
      originalTeacher: record.assignedTeacher || '',
      originalTeacherInitials:
        record.assignedTeacherInitials || '',
      replacementTeacherId: record.teacherId,
      replacementTeacher: record.teacher || '',
      replacementTeacherInitials: record.initials || '',
      status: record.status
    });
  }

  const teacherIds = actualTeachers.map(teacher => teacher.id);

  actual.teachers = actualTeachers;
  actual.teacherIds = teacherIds;

  actual.teacherId = teacherIds[0] || '';
  actual.teacherName = actualTeachers[0]?.name || '';
  actual.teacherInitials = actualTeachers[0]?.initials || '';

  return {
    assignment: actual,
    replacements: appliedReplacements
  };
}

/**
 * Creates a permanent snapshot of the actual routine for one BS date.
 * This function does not modify the master routine or replacement records.
 */
export function createDailyArchive(data, bsDate) {
  const dateInfo = validateBSDate(bsDate);

  if (!dateInfo) {
    throw new Error('Please enter a valid BS date.');
  }

  if (dateInfo.weekday === 'Saturday') {
    throw new Error('Saturday is closed. There is no routine to archive.');
  }

  const resolvedRoutine = resolveRoutineForDate(data, bsDate);

  const routineSections = getRoutineSections(
    resolvedRoutine,
    bsDate,
    dateInfo.weekday
  );

  if (!routineSections) {
    throw new Error(
      'No routine exists for this date. Please check the master routine or Sunday special routine.'
    );
  }

  const timingSchedule = getTimingsForDate(
    data.timingHistory || [],
    bsDate
  );

  const timingPeriods = timingSchedule?.periods || [];

  const sections = {};

  for (const section of data.sections || []) {
    const periods = [];

    for (
      let period = 1;
      period <= PERIOD_COUNT;
      period++
    ) {
      const scheduledAssignment = getTeacherForDate(
        resolvedRoutine,
        data.teacherHistory || [],
        bsDate,
        dateInfo.weekday,
        section,
        period
      );

      const timing = timingPeriods.find(
        item => Number(item.period) === period
      );

      if (!scheduledAssignment) {
        periods.push({
          period,
          scheduledAssignment: null,
          actualAssignment: null,
          replacements: [],
          timing: timing ? clone(timing) : null
        });

        continue;
      }

      const result = applyConductedReplacements(
        scheduledAssignment,
        data.records || [],
        bsDate,
        section,
        period
      );

      periods.push({
        period,
        scheduledAssignment: clone(scheduledAssignment),
        actualAssignment: result.assignment,
        replacements: result.replacements,
        timing: timing ? clone(timing) : null
      });
    }

    sections[section] = periods;
  }

  return {
    id: crypto.randomUUID(),
    dateBS: bsDate,
    dateAD: dateInfo.ad,
    weekday: dateInfo.weekday,

    createdAt: new Date().toISOString(),
    updatedAt: null,

    timingSchedule: timingSchedule
      ? clone(timingSchedule)
      : null,

    sections
  };
}

/**
 * Saves a new daily archive without overwriting an existing date.
 */
export function saveDailyArchive(data, bsDate) {
  if (!data || typeof data !== 'object') {
    throw new Error('RRC data is not initialized.');
  }

  if (!Array.isArray(data.dailyArchives)) {
    data.dailyArchives = [];
  }

  const existing = data.dailyArchives.find(
    archive => archive.dateBS === bsDate
  );

  if (existing) {
    throw new Error(
      'An archive already exists for this date. Use the edit/correction option instead of creating another one.'
    );
  }

  const archive = createDailyArchive(data, bsDate);

  data.dailyArchives.push(archive);

  data.dailyArchives.sort((a, b) =>
    a.dateBS.localeCompare(b.dateBS)
  );

  return archive;
}
