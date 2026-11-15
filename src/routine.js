
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

export let SECTIONS = [...DEFAULT_SECTIONS];

export function setSections(sections) {
  const cleaned = [
    ...new Set(
      (sections || [])
        .map(section => String(section || '').trim())
        .filter(Boolean)
    )
  ];

  SECTIONS = cleaned;
  return SECTIONS;
}

function emptyPeriod() {
  return {
    type: 'theory',
    subjectId: '',
    subject: '',

    teacherId: '',
    teacherInitials: '',
    teacherName: '',

    teacherIds: [],
    teachers: [],

    isLab: false,
    labPeriods: 1,

    practicalSessionId: '',
    practicalPart: 0,
    practicalStartPeriod: 0
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

function normalizeAssignment(assignment = {}) {
  const result = {
    ...emptyPeriod(),
    ...assignment
  };

  // Convert older single-teacher practical assignments.
  if (result.isLab && !result.type) {
    result.type = 'practical';
  }

  if (result.type === 'practical' || result.isLab) {
    result.type = 'practical';
    result.isLab = true;

    if (!Array.isArray(result.teacherIds)) {
      result.teacherIds = result.teacherId
        ? [result.teacherId]
        : [];
    }

    if (!Array.isArray(result.teachers)) {
      result.teachers = result.teacherId
        ? [{
            id: result.teacherId,
            initials: result.teacherInitials || '',
            name: result.teacherName || ''
          }]
        : [];
    }

    result.labPeriods = Math.max(
      1,
      Math.min(2, Number(result.labPeriods) || 1)
    );
  } else {
    result.type = 'theory';
    result.isLab = false;
    result.teacherIds = result.teacherId ? [result.teacherId] : [];
    result.teachers = result.teacherId
      ? [{
          id: result.teacherId,
          initials: result.teacherInitials || '',
          name: result.teacherName || ''
        }]
      : [];
    result.labPeriods = 1;
  }

  return result;
}

export function ensureRoutineSections(routine) {
  if (!routine.weekdays) routine.weekdays = {};
  if (!routine.specialDates) routine.specialDates = {};

  for (const day of WEEKDAYS) {
    if (!routine.weekdays[day]) {
      routine.weekdays[day] = {};
    }

    for (const section of SECTIONS) {
      if (!Array.isArray(routine.weekdays[day][section])) {
        routine.weekdays[day][section] = emptySection();
      } else {
        const periods = routine.weekdays[day][section];

        while (periods.length < PERIOD_COUNT) {
          periods.push(emptyPeriod());
        }

        routine.weekdays[day][section] = periods
          .slice(0, PERIOD_COUNT)
          .map(normalizeAssignment);
      }
    }

    for (const section of Object.keys(routine.weekdays[day])) {
      if (!SECTIONS.includes(section)) {
        delete routine.weekdays[day][section];
      }
    }
  }

  // Keep special Sunday routines compatible with the current sections.
  for (const special of Object.values(routine.specialDates)) {
    if (!special.sections) special.sections = {};

    for (const section of SECTIONS) {
      if (!Array.isArray(special.sections[section])) {
        special.sections[section] = emptySection();
      } else {
        const periods = special.sections[section];

        while (periods.length < PERIOD_COUNT) {
          periods.push(emptyPeriod());
        }

        special.sections[section] = periods
          .slice(0, PERIOD_COUNT)
          .map(normalizeAssignment);
      }
    }

    for (const section of Object.keys(special.sections)) {
      if (!SECTIONS.includes(section)) {
        delete special.sections[section];
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

function getSectionPeriods(routine, weekday, section, bsDate = null) {
  const sections = weekday === 'Sunday'
    ? routine?.specialDates?.[bsDate]?.sections
    : routine?.weekdays?.[weekday];

  if (!sections) {
    throw new Error('No timetable exists for this date.');
  }

  if (!SECTIONS.includes(section)) {
    throw new Error('Invalid section.');
  }

  return sections[section];
}

function clearSessionFromPeriods(periods, index) {
  const current = periods[index];

  if (!current) return;

  const sessionId = current.practicalSessionId;

  if (sessionId) {
    for (let i = 0; i < periods.length; i++) {
      if (periods[i]?.practicalSessionId === sessionId) {
        periods[i] = emptyPeriod();
      }
    }
  } else {
    periods[index] = emptyPeriod();
  }
}

export function clearPeriodAssignment(
  routine,
  weekday,
  section,
  periodIndex,
  bsDate = null
) {
  if (
    !Number.isInteger(periodIndex) ||
    periodIndex < 0 ||
    periodIndex >= PERIOD_COUNT
  ) {
    throw new Error('Invalid period number.');
  }

  const periods = getSectionPeriods(
    routine,
    weekday,
    section,
    bsDate
  );

  clearSessionFromPeriods(periods, periodIndex);

  return routine;
}

export function assignPracticalSession(
  routine,
  weekday,
  section,
  periodIndex,
  assignment,
  periodCount = 1,
  bsDate = null
) {
  if (
    !Number.isInteger(periodIndex) ||
    periodIndex < 0 ||
    periodIndex >= PERIOD_COUNT
  ) {
    throw new Error('Invalid period number.');
  }

  const count = Number(periodCount);

  if (![1, 2].includes(count)) {
    throw new Error('A practical session must use one or two periods.');
  }

  if (count === 2 && periodIndex >= PERIOD_COUNT - 1) {
    throw new Error('There is no following period for a two-period practical.');
  }

  const periods = getSectionPeriods(
    routine,
    weekday,
    section,
    bsDate
  );

  const teacherIds = [...new Set(assignment.teacherIds || [])];

  if (!assignment.subjectId || !assignment.subject) {
    throw new Error('Choose a practical subject.');
  }

  if (!teacherIds.length) {
    throw new Error('Select at least one practical teacher.');
  }

  const targetIndexes = count === 2
    ? [periodIndex, periodIndex + 1]
    : [periodIndex];

  // Do not silently overwrite an unrelated class in the next period.
  for (const targetIndex of targetIndexes) {
    const existing = periods[targetIndex];

    if (
      existing?.subject &&
      !existing.practicalSessionId
    ) {
      throw new Error(
        `Period ${targetIndex + 1} already has an assignment. Clear it first.`
      );
    }

    if (
      existing?.practicalSessionId &&
      !targetIndexes.some(index =>
        periods[index]?.practicalSessionId === existing.practicalSessionId
      )
    ) {
      throw new Error(
        `Period ${targetIndex + 1} belongs to another practical session.`
      );
    }
  }

  // Clear any previous session attached to the starting period.
  clearSessionFromPeriods(periods, periodIndex);

  // Also clear a previous session occupying the second target period.
  if (count === 2) {
    clearSessionFromPeriods(periods, periodIndex + 1);
  }

  const sessionId = crypto.randomUUID();
  const teachers = (assignment.teachers || []).filter(teacher =>
    teacherIds.includes(teacher.id)
  );

  const base = {
    ...emptyPeriod(),
    ...assignment,
    type: 'practical',
    isLab: true,
    labPeriods: count,
    teacherId: teachers[0]?.id || teacherIds[0],
    teacherInitials: teachers[0]?.initials || '',
    teacherName: teachers[0]?.name || '',
    teacherIds,
    teachers,
    practicalSessionId: sessionId,
    practicalStartPeriod: periodIndex + 1
  };

  targetIndexes.forEach((targetIndex, partIndex) => {
    periods[targetIndex] = {
      ...base,
      practicalPart: partIndex + 1
    };
  });

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
  const periods = getSectionPeriods(
    routine,
    weekday,
    section,
    bsDate
  );

  if (
    !Number.isInteger(periodIndex) ||
    periodIndex < 0 ||
    periodIndex >= PERIOD_COUNT
  ) {
    throw new Error('Invalid period number.');
  }

  clearSessionFromPeriods(periods, periodIndex);

  const updated = normalizeAssignment({
    ...emptyPeriod(),
    ...assignment
  });

  periods[periodIndex] = updated;

  return routine;
}

export function getAssignmentTeachers(assignment) {
  if (!assignment) return [];

  if (Array.isArray(assignment.teachers) && assignment.teachers.length) {
    return assignment.teachers;
  }

  if (Array.isArray(assignment.teacherIds) && assignment.teacherIds.length) {
    return assignment.teacherIds.map(id => ({ id }));
  }

  if (assignment.teacherId) {
    return [{
      id: assignment.teacherId,
      initials: assignment.teacherInitials || '',
      name: assignment.teacherName || ''
    }];
  }

  return [];
}

export function getTeacherAssignments(sections, teacherId) {
  const assignments = [];

  if (!sections || !teacherId) return assignments;

  for (const section of SECTIONS) {
    const periods = sections[section] || [];

    periods.forEach((assignment, index) => {
      const teacherIds = getAssignmentTeachers(assignment)
        .map(teacher => teacher.id);

      if (teacherIds.includes(teacherId)) {
        assignments.push({
          section,
          period: index + 1,
          subject: assignment.subject,
          subjectId: assignment.subjectId,
          isLab: Boolean(assignment.isLab),
          type: assignment.type || (assignment.isLab ? 'practical' : 'theory'),
          labPeriods: assignment.labPeriods || 1,
          practicalSessionId: assignment.practicalSessionId || ''
        });
      }
    });
  }

  return assignments;
}

export function getSectionPeriodCount(sections, section) {
  return sections?.[section]?.length || 0;
}
