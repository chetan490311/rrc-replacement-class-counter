
import {
  WEEKDAYS,
  SECTIONS,
  PERIOD_COUNT,
  getRoutineForDate
} from './routine.js';

// Get a section's complete weekday timetable.
export function getSectionTimetable(routine, section) {
  if (!SECTIONS.includes(section)) {
    throw new Error('Invalid section.');
  }

  return WEEKDAYS.map(day => {
    const assignments = routine?.weekdays?.[day]?.[section] || [];

    return {
      day,
      section,
      periods: Array.from({ length: PERIOD_COUNT }, (_, index) => ({
        period: index + 1,
        ...(assignments[index] || {
          subject: '',
          teacherId: '',
          teacherName: '',
          teacherInitials: '',
          isLab: false,
          labPeriods: 1
        })
      }))
    };
  });
}

// Get a teacher's assignments for one weekday.
export function getTeacherDayTimetable(routine, teacherId, weekday) {
  if (!teacherId) throw new Error('Select a teacher.');

  const sections = routine?.weekdays?.[weekday];

  if (!sections) {
    return {
      weekday,
      teacherId,
      periods: Array.from({ length: PERIOD_COUNT }, (_, index) => ({
        period: index + 1,
        assignments: [],
        isFree: true
      }))
    };
  }

  return {
    weekday,
    teacherId,
    periods: Array.from({ length: PERIOD_COUNT }, (_, index) => {
      const assignments = SECTIONS
        .filter(section => {
          const assignment = sections[section]?.[index];
          return assignment?.teacherId === teacherId;
        })
        .map(section => {
          const assignment = sections[section][index];

          return {
            section,
            subject: assignment.subject,
            isLab: Boolean(assignment.isLab),
            labPeriods: assignment.labPeriods || 1
          };
        });

      return {
        period: index + 1,
        assignments,
        isFree: assignments.length === 0
      };
    })
  };
}

// Get a teacher's timetable for all five weekdays.
export function getTeacherWeeklyTimetable(routine, teacherId) {
  return WEEKDAYS.map(day =>
    getTeacherDayTimetable(routine, teacherId, day)
  );
}

// Get a section's timetable for a particular date.
// This supports special Sunday routines.
export function getSectionTimetableForDate(
  routine,
  section,
  bsDate,
  weekday
) {
  if (!SECTIONS.includes(section)) {
    throw new Error('Invalid section.');
  }

  const sections = getRoutineForDate(routine, bsDate, weekday);

  if (!sections) {
    return {
      dateBS: bsDate,
      weekday,
      section,
      closed: weekday === 'Sunday',
      periods: []
    };
  }

  const assignments = sections[section] || [];

  return {
    dateBS: bsDate,
    weekday,
    section,
    closed: false,
    periods: Array.from({ length: PERIOD_COUNT }, (_, index) => ({
      period: index + 1,
      ...(assignments[index] || {})
    }))
  };
}

// Get a teacher's assignments for a special Sunday.
export function getTeacherSundayTimetable(
  routine,
  teacherId,
  bsDate
) {
  if (!teacherId) throw new Error('Select a teacher.');

  const special = routine?.specialDates?.[bsDate];

  if (!special) {
    return {
      dateBS: bsDate,
      weekday: 'Sunday',
      teacherId,
      closed: true,
      periods: []
    };
  }

  return {
    dateBS: bsDate,
    weekday: 'Sunday',
    teacherId,
    closed: false,
    periods: Array.from({ length: PERIOD_COUNT }, (_, index) => {
      const assignments = SECTIONS
        .filter(section =>
          special.sections?.[section]?.[index]?.teacherId === teacherId
        )
        .map(section => {
          const assignment = special.sections[section][index];

          return {
            section,
            subject: assignment.subject,
            isLab: Boolean(assignment.isLab),
            labPeriods: assignment.labPeriods || 1
          };
        });

      return {
        period: index + 1,
        assignments,
        isFree: assignments.length === 0
      };
    })
  };
}

// Get a compact list of all sections assigned to a teacher.
export function getTeacherSectionList(routine, teacherId) {
  const result = [];

  for (const day of WEEKDAYS) {
    const sections = routine?.weekdays?.[day] || {};

    for (const section of SECTIONS) {
      const periods = sections[section] || [];

      periods.forEach((assignment, index) => {
        if (assignment?.teacherId === teacherId) {
          result.push({
            day,
            section,
            period: index + 1,
            subject: assignment.subject || '',
            isLab: Boolean(assignment.isLab)
          });
        }
      });
    }
  }

  return result;
}
