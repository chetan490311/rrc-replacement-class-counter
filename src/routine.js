
export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday'
];

export const PERIOD_COUNT = 9;

export const DEFAULT_SECTIONS = [
  ...Array.from({ length: 12 }, (_, i) => `XI M${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `XII M${i + 1}`)
];

// Live section list: can be changed by the app without rebuilding.
export let SECTIONS = [...DEFAULT_SECTIONS];

export function setSections(sections) {
  const cleaned = [...new Set(
    (sections || [])
      .map(s => String(s || '').trim())
      .filter(Boolean)
  )];

  SECTIONS = cleaned;
  return SECTIONS;
}

function emptyPeriod() {
  return {
    subjectId: '',
    subject: '',
    teacherId: '',
    teacherInitials: '',
    teacherName: '',
    isLab: false,
    labPeriods: 1
  };
}

function emptySection() {
  return Array.from(
    { length: PERIOD_COUNT },
    () => emptyPeriod()
  );
}

function emptyDay() {
  return Object.fromEntries(
    SECTIONS.map(section => [section, emptySection()])
  );
}

export function createEmptyRoutine() {
  return {
    weekdays: Object.fromEntries(
      WEEKDAYS.map(day => [day, emptyDay()])
    ),
    specialDates: {}
  };
}

export function copyRoutine(source) {
  return JSON.parse(JSON.stringify(source));
}

export function getWeekdayRoutine(routine, weekday) {
  return routine?.weekdays?.[weekday] || null;
}

export function getRoutineForDate(routine, bsDate, weekday) {
  if (weekday === 'Sunday') {
    return routine?.specialDates?.[bsDate]?.sections || null;
  }

  return getWeekdayRoutine(routine, weekday);
}

export function ensureRoutineSections(routine) {
  if (!routine.weekdays) routine.weekdays = {};
  if (!routine.specialDates) routine.specialDates = {};

  for (const day of WEEKDAYS) {
    if (!routine.weekdays[day]) routine.weekdays[day] = {};

    for (const section of SECTIONS) {
      if (!Array.isArray(routine.weekdays[day][section])) {
        routine.weekdays[day][section] = emptySection();
      } else {
        while (routine.weekdays[day][section].length < PERIOD_COUNT) {
          routine.weekdays[day][section].push(emptyPeriod());
        }
        routine.weekdays[day][section] =
          routine.weekdays[day][section].slice(0, PERIOD_COUNT);
      }
    }

    for (const section of Object.keys(routine.weekdays[day])) {
      if (!SECTIONS.includes(section)) {
        delete routine.weekdays[day][section];
      }
    }
  }

  return routine;
}

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

export function deleteSundayRoutine(routine, bsDate) {
  if (routine?.specialDates) {
    delete routine.specialDates[bsDate];
  }

  return routine;
}

export function updatePeriod(
  routine,
  weekday,
  section,
  periodIndex,
  assignment,
  bsDate = null
) {
  const sections = weekday === 'Sunday'
    ? routine?.specialDates?.[bsDate]?.sections
    : routine?.weekdays?.[weekday];

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

  const previous = sections[section]?.[periodIndex] || emptyPeriod();

  const updated = {
    ...previous,
    ...assignment,
    isLab: Boolean(assignment.isLab ?? previous.isLab),
    labPeriods: Math.max(
      1,
      Math.min(2, Number(assignment.labPeriods ?? previous.labPeriods) || 1)
    )
  };

  if (
    assignment.subjectId !== undefined &&
    assignment.subjectId !== previous.subjectId
  ) {
    updated.teacherId = assignment.teacherId || '';
    updated.teacherInitials = assignment.teacherInitials || '';
    updated.teacherName = assignment.teacherName || '';
  }

  sections[section][periodIndex] = updated;
  return routine;
}

export function getTeacherAssignments(sections, teacherId) {
  const assignments = [];

  if (!sections || !teacherId) return assignments;

  for (const section of SECTIONS) {
    const periods = sections[section] || [];

    periods.forEach((assignment, index) => {
      if (assignment.teacherId === teacherId) {
        assignments.push({
          section,
          period: index + 1,
          subject: assignment.subject,
          subjectId: assignment.subjectId,
          isLab: assignment.isLab,
          labPeriods: assignment.labPeriods
        });
      }
    });
  }

  return assignments;
}

export function getSectionPeriodCount(sections, section) {
  return sections?.[section]?.length || 0;
}
