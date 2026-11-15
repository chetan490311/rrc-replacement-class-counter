
import { SECTIONS, PERIOD_COUNT } from './routine.js';

// Create a new teacher assignment history.
export function createTeacherHistory() {
  return [];
}

// Record a teacher change for one section, period and weekday.
// The change becomes effective from the specified BS date.
export function addTeacherChange(history, change) {
  const {
    effectiveFrom,
    weekday,
    section,
    period,
    teacherId,
    teacherName,
    teacherInitials,
    subject
  } = change;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom || '')) {
    throw new Error('Enter the effective BS date as YYYY-MM-DD.');
  }

  if (!['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(weekday)) {
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

  if (!teacherId || !teacherName || !teacherInitials) {
    throw new Error('Select a registered teacher.');
  }

  const entry = {
    id: crypto.randomUUID(),
    effectiveFrom,
    weekday,
    section,
    period: Number(period),
    teacherId,
    teacherName,
    teacherInitials,
    subject: subject || '',
    createdAt: new Date().toISOString()
  };

  history.push(entry);

  history.sort((a, b) =>
    a.effectiveFrom.localeCompare(b.effectiveFrom)
  );

  return history;
}

// Find the teacher assigned to a particular period on a particular BS date.
// If no historical change applies, use the original master routine.
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
    original =
      masterRoutine?.specialDates?.[bsDate]?.sections?.[section]?.[periodIndex];
  } else {
    original =
      masterRoutine?.weekdays?.[weekday]?.[section]?.[periodIndex];
  }

  if (!original) return null;

  const applicableChanges = (history || [])
    .filter(change =>
      change.effectiveFrom <= bsDate &&
      change.weekday === weekday &&
      change.section === section &&
      change.period === period
    )
    .sort((a, b) =>
      b.effectiveFrom.localeCompare(a.effectiveFrom)
    );

  if (applicableChanges.length === 0) {
    return { ...original };
  }

  const latest = applicableChanges[0];

  return {
    ...original,
    teacherId: latest.teacherId,
    teacherName: latest.teacherName,
    teacherInitials: latest.teacherInitials,
    subject: latest.subject || original.subject
  };
}

// List all teacher changes effective on or before a selected BS date.
export function getChangesUntil(history, bsDate) {
  return (history || [])
    .filter(change => change.effectiveFrom <= bsDate)
    .sort((a, b) =>
      a.effectiveFrom.localeCompare(b.effectiveFrom)
    );
}

// Get the complete history of changes for one section and period.
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

// Remove a mistakenly entered change by its ID.
export function deleteTeacherChange(history, changeId) {
  return (history || []).filter(change => change.id !== changeId);
}
