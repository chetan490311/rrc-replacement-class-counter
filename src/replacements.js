
import { validateBSDate } from './nepali-date.js';
import { SECTIONS, PERIOD_COUNT } from './routine.js';
import { getTeacherForDate } from './teacher-history.js';

// Create a replacement record using the timetable valid on that BS date.
export function createReplacementRecord({
  masterRoutine,
  teacherHistory,
  bsDate,
  section,
  period,
  replacementTeacher,
  periods = 1
}) {
  // Validate and convert the selected BS date.
  const dateInfo = validateBSDate(bsDate);

  if (!dateInfo) {
    throw new Error('Invalid BS date. Please check the date.');
  }

  const weekday = dateInfo.weekday;

  if (weekday === 'Saturday') {
    throw new Error('Saturday is closed.');
  }

  if (!SECTIONS.includes(section)) {
    throw new Error('Please select a valid section.');
  }

  const periodNumber = Number(period);

  if (
    !Number.isInteger(periodNumber) ||
    periodNumber < 1 ||
    periodNumber > PERIOD_COUNT
  ) {
    throw new Error('Please select a valid period.');
  }

  if (
    !replacementTeacher?.id ||
    !replacementTeacher?.name ||
    !replacementTeacher?.initials
  ) {
    throw new Error('Please select a registered replacement teacher.');
  }

  // Retrieve the teacher who was scheduled on the selected date.
  const scheduledTeacher = getTeacherForDate(
    masterRoutine,
    teacherHistory,
    bsDate,
    weekday,
    section,
    periodNumber
  );

  if (!scheduledTeacher || !scheduledTeacher.subject) {
    throw new Error(
      'No subject or timetable assignment exists for this period.'
    );
  }

  const isLab = Boolean(scheduledTeacher.isLab);
  const periodCount = Number(periods);

  if (
    !Number.isInteger(periodCount) ||
    periodCount < 1 ||
    periodCount > 2
  ) {
    throw new Error('A replacement must be 1 or 2 periods.');
  }

  if (!isLab && periodCount !== 1) {
    throw new Error('Only laboratory replacements can cover two periods.');
  }

  if (periodCount === 2 && periodNumber === PERIOD_COUNT) {
    throw new Error('There is no following period for a two-period lab.');
  }

  // Preserve both teacher identities as they were on the entry date.
  return {
    id: crypto.randomUUID(),

    dateBS: bsDate,
    dateAD: dateInfo.ad,
    weekday,

    section,
    period: periodNumber,
    periods: periodCount,

    // Teacher receiving the replacement assignment.
    teacherId: replacementTeacher.id,
    teacher: replacementTeacher.name,
    initials: replacementTeacher.initials,
    subject: scheduledTeacher.subject,

    // Original teacher whose scheduled class is being covered.
    assignedTeacherId: scheduledTeacher.teacherId || '',
    assignedTeacher: scheduledTeacher.teacherName || '',
    assignedTeacherInitials: scheduledTeacher.teacherInitials || '',

    type: isLab ? 'Lab' : 'Section',
    isLab,

    createdAt: new Date().toISOString()
  };
}

// Add a validated replacement record to the existing records array.
export function addReplacementRecord(data, details) {
  if (!data || !Array.isArray(data.records)) {
    throw new Error('Replacement data storage is not initialized.');
  }

  const record = createReplacementRecord({
    masterRoutine: data.routine,
    teacherHistory: data.teacherHistory || [],
    ...details
  });

  data.records.push(record);

  return record;
}

// Get replacement records for a particular BS date.
export function getReplacementsForBSDate(records, bsDate) {
  return (records || []).filter(record => record.dateBS === bsDate);
}

// Get replacement records for a particular teacher.
export function getReplacementsForTeacher(records, teacherId) {
  return (records || []).filter(
    record => record.teacherId === teacherId
  );
}

// Calculate the total replacement periods for a teacher.
export function getTeacherReplacementTotal(records, teacherId) {
  return getReplacementsForTeacher(records, teacherId)
    .reduce((total, record) => total + Number(record.periods || 1), 0);
}

// Calculate total replacement periods for a selected BS date.
export function getDailyReplacementTotal(records, bsDate) {
  return getReplacementsForBSDate(records, bsDate)
    .reduce((total, record) => total + Number(record.periods || 1), 0);
}

// Remove a replacement record by ID.
export function deleteReplacementRecord(records, recordId) {
  return (records || []).filter(record => record.id !== recordId);
}
