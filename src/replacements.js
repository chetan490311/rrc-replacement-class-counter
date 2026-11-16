
import { validateBSDate } from './nepali-date.js';
import { SECTIONS, PERIOD_COUNT, getAssignmentTeachers } from './routine.js';
import { getTeacherForDate } from './teacher-history.js';

export const REPLACEMENT_STATUSES = [
  'Assigned',
  'Conducted',
  'Not conducted',
  'Cancelled'
];

function validateCommon({ bsDate, section, period }) {
  const dateInfo = validateBSDate(bsDate);

  if (!dateInfo) {
    throw new Error('Invalid BS date. Please check the date.');
  }

  if (dateInfo.weekday === 'Saturday') {
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

  return { dateInfo, periodNumber };
}

function validateReplacementTeacher(teacher) {
  if (!teacher?.id || !teacher?.name || !teacher?.initials) {
    throw new Error('Please select a registered replacement teacher.');
  }
}

function getScheduledAssignment({
  masterRoutine,
  teacherHistory,
  bsDate,
  section,
  periodNumber,
  weekday
}) {
  const assignment = getTeacherForDate(
    masterRoutine,
    teacherHistory,
    bsDate,
    weekday,
    section,
    periodNumber
  );

  if (!assignment || !assignment.subject) {
    throw new Error(
      'No subject or timetable assignment exists for this period.'
    );
  }

  return assignment;
}

function createRecord({
  dateInfo,
  bsDate,
  section,
  periodNumber,
  replacementTeacher,
  scheduledTeacher,
  originalTeacherId,
  sessionId = ''
}) {
  return {
    id: crypto.randomUUID(),

    dateBS: bsDate,
    dateAD: dateInfo.ad,
    weekday: dateInfo.weekday,

    section,
    period: periodNumber,
    periods: 1,

    teacherId: replacementTeacher.id,
    teacher: replacementTeacher.name,
    initials: replacementTeacher.initials,

    subject: scheduledTeacher.subject,

    assignedTeacherId: originalTeacherId ||
      scheduledTeacher.teacherId ||
      '',
    assignedTeacher: scheduledTeacher.teachers?.find(
      teacher => teacher.id === originalTeacherId
    )?.name || scheduledTeacher.teacherName || '',
    assignedTeacherInitials: scheduledTeacher.teachers?.find(
      teacher => teacher.id === originalTeacherId
    )?.initials || scheduledTeacher.teacherInitials || '',

    type: scheduledTeacher.isLab ? 'Lab' : 'Section',
    isLab: Boolean(scheduledTeacher.isLab),

    practicalSessionId: sessionId,

    // Every new replacement begins as assigned.
    status: 'Assigned',

    createdAt: new Date().toISOString()
  };
}

/**
 * Existing single-period replacement function.
 * Retained for compatibility with the current theory replacement screen.
 */
export function createReplacementRecord({
  masterRoutine,
  teacherHistory,
  bsDate,
  section,
  period,
  replacementTeacher,
  periods = 1
}) {
  const { dateInfo, periodNumber } = validateCommon({
    bsDate,
    section,
    period
  });

  validateReplacementTeacher(replacementTeacher);

  const scheduledTeacher = getScheduledAssignment({
    masterRoutine,
    teacherHistory,
    bsDate,
    section,
    periodNumber,
    weekday: dateInfo.weekday
  });

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

  if (
    periodCount === 2 &&
    periodNumber === PERIOD_COUNT
  ) {
    throw new Error('There is no following period for a two-period lab.');
  }

  const sessionId = scheduledTeacher.practicalSessionId || '';

  return {
    ...createRecord({
      dateInfo,
      bsDate,
      section,
      periodNumber,
      replacementTeacher,
      scheduledTeacher,
      originalTeacherId: scheduledTeacher.teacherId || '',
      sessionId
    }),
    periods: periodCount
  };
}

/**
 * Creates one replacement record for every practical period covered.
 *
 * replacements format:
 * [
 *   { period: 1, replacementTeacher: teacherObject },
 *   { period: 2, replacementTeacher: anotherTeacherObject }
 * ]
 *
 * The same replacement teacher may be selected for both periods.
 */
export function createPracticalReplacementRecords({
  masterRoutine,
  teacherHistory,
  bsDate,
  section,
  period,
  originalTeacherId,
  replacements
}) {
  const { dateInfo, periodNumber } = validateCommon({
    bsDate,
    section,
    period
  });

  if (!originalTeacherId) {
    throw new Error('Choose the practical teacher being replaced.');
  }

  if (!Array.isArray(replacements) || !replacements.length) {
    throw new Error('Choose at least one practical period to replace.');
  }

  const startingAssignment = getScheduledAssignment({
    masterRoutine,
    teacherHistory,
    bsDate,
    section,
    periodNumber,
    weekday: dateInfo.weekday
  });

  if (!startingAssignment.isLab) {
    throw new Error('This timetable assignment is not a practical.');
  }

  const sessionId = startingAssignment.practicalSessionId || '';

  const assignedTeachers = getAssignmentTeachers(startingAssignment);
  const originalTeacher = assignedTeachers.find(
    teacher => teacher.id === originalTeacherId
  );

  if (!originalTeacher) {
    throw new Error(
      'The selected teacher is not assigned to this practical.'
    );
  }

  const sessionLength = Math.max(
    1,
    Math.min(2, Number(startingAssignment.labPeriods) || 1)
  );

  const startPeriod = Number(
    startingAssignment.practicalStartPeriod || periodNumber
  );

  const allowedPeriods = Array.from(
    { length: sessionLength },
    (_, index) => startPeriod + index
  );

  const usedPeriods = new Set();

  const records = replacements.map(item => {
    const selectedPeriod = Number(item.period);

    if (!allowedPeriods.includes(selectedPeriod)) {
      throw new Error(
        `Period ${selectedPeriod} is not part of this practical session.`
      );
    }

    if (usedPeriods.has(selectedPeriod)) {
      throw new Error(
        `Period ${selectedPeriod} has been selected more than once.`
      );
    }

    usedPeriods.add(selectedPeriod);

    const replacementTeacher = item.replacementTeacher;
    validateReplacementTeacher(replacementTeacher);

    const scheduledTeacher = getScheduledAssignment({
      masterRoutine,
      teacherHistory,
      bsDate,
      section,
      periodNumber: selectedPeriod,
      weekday: dateInfo.weekday
    });

    if (
      !scheduledTeacher.isLab ||
      (
        sessionId &&
        scheduledTeacher.practicalSessionId !== sessionId
      )
    ) {
      throw new Error(
        `Period ${selectedPeriod} does not belong to the same practical session.`
      );
    }

    const periodTeachers = getAssignmentTeachers(scheduledTeacher);

    if (!periodTeachers.some(teacher => teacher.id === originalTeacherId)) {
      throw new Error(
        `The selected original teacher is not assigned in period ${selectedPeriod}.`
      );
    }

    return createRecord({
      dateInfo,
      bsDate,
      section,
      periodNumber: selectedPeriod,
      replacementTeacher,
      scheduledTeacher,
      originalTeacherId,
      sessionId
    });
  });

  return records;
}

/**
 * Updates the completion status of one replacement record.
 * Practical periods have separate records and separate statuses.
 */
export function updateReplacementStatus(records, recordId, status) {
  if (!REPLACEMENT_STATUSES.includes(status)) {
    throw new Error('Please select a valid replacement status.');
  }

  if (!Array.isArray(records)) {
    throw new Error('Replacement records are not initialized.');
  }

  const index = records.findIndex(record => record.id === recordId);

  if (index === -1) {
    throw new Error('Replacement record could not be found.');
  }

  records[index] = {
    ...records[index],
    status,
    statusUpdatedAt: new Date().toISOString()
  };

  return records;
}

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

export function getReplacementsForBSDate(records, bsDate) {
  return (records || []).filter(
    record => record.dateBS === bsDate
  );
}

export function getReplacementsForTeacher(records, teacherId) {
  return (records || []).filter(
    record => record.teacherId === teacherId
  );
}

export function getTeacherReplacementTotal(records, teacherId) {
  return getReplacementsForTeacher(records, teacherId)
    .reduce(
      (total, record) => total + Number(record.periods || 1),
      0
    );
}

export function getDailyReplacementTotal(records, bsDate) {
  return getReplacementsForBSDate(records, bsDate)
    .reduce(
      (total, record) => total + Number(record.periods || 1),
      0
    );
}

export function deleteReplacementRecord(records, recordId) {
  return (records || []).filter(
    record => record.id !== recordId
  );
}
