
export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday'
];

export const PERIOD_COUNT = 9;

export const SECTIONS = [
  ...Array.from({ length: 12 }, (_, i) => `XI M${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `XII M${i + 1}`)
];

export const LAB_SUBJECTS = [
  'Physics Lab',
  'Chemistry Lab',
  'Biology Lab',
  'Computer Lab'
];

function emptyPeriod() {
  return {
    subject: '',
    teacherId: '',
    teacherInitials: '',
    teacherName: '',
    isLab: false,
    labPeriods: 1
  };
}

function emptySection() {
  return Array.from({ length: PERIOD_COUNT }, emptyPeriod);
}

function emptyDay() {
  return Object.fromEntries(
    SECTIONS.map(section => [section, emptySection()])
  );
}

// Creates a new master timetable.
export function createEmptyRoutine() {
  return {
    weekdays: Object.fromEntries(
      WEEKDAYS.map(day => [day, emptyDay()])
    ),
    specialDates: {}
  };
}

// Makes a separate copy so editing a Sunday never changes its source day.
export function copyRoutine(source) {
  return JSON.parse(JSON.stringify(source));
}

// Gets the timetable for a normal weekday.
export function getWeekdayRoutine(routine, weekday) {
  return routine?.weekdays?.[weekday] || null;
}

// Gets the timetable for a particular BS date.
// Sunday is closed unless a special timetable exists.
export function getRoutineForDate(routine, bsDate, weekday) {
  if (weekday === 'Sunday') {
    return routine?.specialDates?.[bsDate]?.sections || null;
  }

  return getWeekdayRoutine(routine, weekday);
}

// Opens a particular Sunday by copying a weekday timetable.
export function createSundayRoutine(routine, bsDate, sourceDay) {
  if (!routine || !routine.weekdays?.[sourceDay]) {
    throw new Error('Choose a valid weekday routine to copy.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(bsDate)) {
    throw new Error('Enter the BS date in YYYY-MM-DD format.');
  }

  routine.specialDates[bsDate] = {
    dateBS: bsDate,
    weekday: 'Sunday',
    copiedFrom: sourceDay,
    sections: copyRoutine(routine.weekdays[sourceDay]),
    createdAt: new Date().toISOString()
  };

  return routine;
}

// Deletes a special Sunday timetable.
export function deleteSundayRoutine(routine, bsDate) {
  if (routine?.specialDates) {
    delete routine.specialDates[bsDate];
  }

  return routine;
}

// Updates one period in one section.
// periodIndex starts at zero: 0 means Period 1.
export function updatePeriod(
  routine,
  weekday,
  section,
  periodIndex,
  assignment,
  bsDate = null
) {
  let sections;

  if (weekday === 'Sunday') {
    sections = routine?.specialDates?.[bsDate]?.sections;
  } else {
    sections = routine?.weekdays?.[weekday];
  }

  if (!sections) {
    throw new Error('No timetable exists for this date.');
  }

  if (!SECTIONS.includes(section)) {
    throw new Error('Invalid section.');
  }

  if (
    !Number.isInteger(periodIndex) ||
    periodIndex < 0 ||
    periodIndex >= PERIOD_COUNT
  ) {
    throw new Error('Invalid period number.');
  }

  const previous = sections[section][periodIndex];

  sections[section][periodIndex] = {
    ...previous,
    ...assignment,
    isLab: Boolean(assignment.isLab),
    labPeriods: Math.max(
      1,
      Math.min(2, Number(assignment.labPeriods) || 1)
    )
  };

  return routine;
}

// Returns all sections assigned to a teacher in a timetable.
export function getTeacherAssignments(sections, teacherId) {
  if (!sections || !teacherId) return [];

  const results = [];

  for (const section of SECTIONS) {
    const periods = sections[section] || [];

    periods.forEach((assignment, index) => {
      if (assignment.teacherId === teacherId) {
        results.push({
          section,
          period: index + 1,
          subject: assignment.subject,
          isLab: assignment.isLab,
          labPeriods: assignment.labPeriods
        });
      }
    });
  }

  return results;
}

// Returns the number of periods assigned to a section.
export function getSectionPeriodCount(sections, section) {
  return (sections?.[section] || []).filter(
    period => period.subject || period.teacherId
  ).length;
}
