
import { SECTIONS, PERIOD_COUNT } from './routine.js';

export function createTeacherHistory() {
  return [];
}

function normalizeTeachers(change) {
  if (Array.isArray(change.teachers) && change.teachers.length) {
    return change.teachers;
  }

  if (Array.isArray(change.teacherIds) && change.teacherIds.length) {
    return change.teacherIds.map(id => ({ id }));
  }

  if (change.teacherId) {
    return [{
      id: change.teacherId,
      name: change.teacherName || '',
      initials: change.teacherInitials || ''
    }];
  }

  return [];
}

function applyTeachers(assignment, teachers, change) {
  const teacherIds = teachers.map(teacher => teacher.id);

  return {
    ...assignment,
    teacherIds,
    teachers,

    teacherId: teacherIds[0] || '',
    teacherName: teachers[0]?.name || '',
    teacherInitials: teachers[0]?.initials || '',

    ...(change.subject ? { subject: change.subject } : {})
  };
}

export function addTeacherChange(history, change) {
  const {
    effectiveFrom,
    weekday,
    section,
    period
  } = change;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom || '')) {
    throw new Error('Enter the effective BS date as YYYY-MM-DD.');
  }

  if (![
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday'
  ].includes(weekday)) {
    throw new Error('Choose a valid weekday.');
  }

  if (!SECTIONS.includes(section)) {
    throw new Error('Choose a valid section.');
  }

  if (
    !Number.isInteger(Number(period)) ||
    Number(period) < 1 ||
    Number(period) > PERIOD_COUNT
  ) {
    throw new Error('Choose a valid period.');
  }

  const teachers = normalizeTeachers(change);

  if (!teachers.length || teachers.some(teacher => !teacher.id)) {
    throw new Error('Select at least one registered teacher.');
  }

  // Keep the legacy single-teacher fields for compatibility.
  const firstTeacher = teachers[0];

  const entry = {
    id: crypto.randomUUID(),
    effectiveFrom,
    weekday,
    section,
    period: Number(period),

    teacherIds: teachers.map(teacher => teacher.id),
    teachers,

    teacherId: firstTeacher.id,
    teacherName: firstTeacher.name || '',
    teacherInitials: firstTeacher.initials || '',

    subject: change.subject || '',
    createdAt: new Date().toISOString()
  };

  history.push(entry);

  history.sort((a, b) =>
    a.effectiveFrom.localeCompare(b.effectiveFrom)
  );

  return history;
}

export function getTeacherForDate(
  masterRoutine,
  history,
  bsDate,
  weekday,
  section,
  period
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bsDate || '')) {
    throw new Error('Invalid BS date.');
  }

  const periodIndex = Number(period) - 1;

  if (
    !Number.isInteger(periodIndex) ||
    periodIndex < 0 ||
    periodIndex >= PERIOD_COUNT
  ) {
    throw new Error('Invalid period.');
  }

  let original;

  if (weekday === 'Sunday') {
    original = masterRoutine
      ?.specialDates
      ?.[bsDate]
      ?.sections
      ?.[section]
      ?.[periodIndex];
  } else {
    original = masterRoutine
      ?.weekdays
      ?.[weekday]
      ?.[section]
      ?.[periodIndex];
  }

  if (!original) return null;

  const applicableChanges = (history || [])
    .filter(change =>
      change.effectiveFrom <= bsDate &&
      change.weekday === weekday &&
      change.section === section &&
      change.period === Number(period)
    )
    .sort((a, b) =>
      b.effectiveFrom.localeCompare(a.effectiveFrom)
    );

  if (!applicableChanges.length) {
    return { ...original };
  }

  const latest = applicableChanges[0];
  const teachers = normalizeTeachers(latest);

  // Old records contain only teacherId, teacherName and teacherInitials.
  if (!teachers.length) {
    return { ...original };
  }

  return applyTeachers(original, teachers, latest);
}

export function getChangesUntil(history, bsDate) {
  return (history || [])
    .filter(change => change.effectiveFrom <= bsDate)
    .sort((a, b) =>
      a.effectiveFrom.localeCompare(b.effectiveFrom)
    );
}

export function getAssignmentHistory(
  history,
  weekday,
  section,
  period
) {
  return (history || [])
    .filter(change =>
      change.weekday === weekday &&
      change.section === section &&
      change.period === Number(period)
    )
    .sort((a, b) =>
      a.effectiveFrom.localeCompare(b.effectiveFrom)
    );
}

export function deleteTeacherChange(history, changeId) {
  return (history || []).filter(
    change => change.id !== changeId
  );
}
