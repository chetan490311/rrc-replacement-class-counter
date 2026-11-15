
import './style.css';

import {
  loadData,
  saveData,
  createBackup,
  restoreBackup
} from './storage.js';

import {
  WEEKDAYS,
  PERIOD_COUNT,
  DEFAULT_SECTIONS,
  setSections,
  ensureRoutineSections,
  createSundayRoutine,
  deleteSundayRoutine,
  updatePeriod,
  assignPracticalSession,
  clearPeriodAssignment,
  getAssignmentTeachers
} from './routine.js';

import {
  addSubject,
  assignTeacherToSubject,
  removeTeacherFromSubject,
  getTeachersForSubject
} from './subjects.js';

import {
  addTimingChange,
  getTimingsForDate
} from './period-timings.js';

import {
  validateBSDate,
  todayBS,
  getWeekdayFromBS
} from './nepali-date.js';

import {
  addTeacherChange,
  getTeacherForDate
} from './teacher-history.js';

import {
  createReplacementRecord,
  createPracticalReplacementRecords
} from './replacements.js';

import {
  initializeRoutineVersions,
  getRoutineVersions,
  resolveRoutineForDate,
  createRoutineVersion,
  updateRoutineVersion,
  deleteRoutineVersion
} from './routine-versions.js';

let data;
let tab = 'counter';
let selectedBS = todayBS();
let selectedDay = 'Monday';
let selectedSection = '';
let editingTeacher = null;
let editingRoutineVersionId = '';

const $ = selector => document.querySelector(selector);

const esc = value =>
  String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);

function notify(message) {
  alert(message);
}

function persist() {
  return saveData(data);
}

function refreshSections() {
  setSections(data.sections);

  ensureRoutineSections(data.masterRoutine);

  for (const version of data.routineVersions || []) {
    if (version.routine) {
      ensureRoutineSections(version.routine);
    }
  }

  if (!data.sections.includes(selectedSection)) {
    selectedSection = data.sections[0] || '';
  }
}

function initialiseData() {
  if (!Array.isArray(data.sections)) {
    data.sections = [...DEFAULT_SECTIONS];
  }

  if (!Array.isArray(data.subjects)) data.subjects = [];
  if (!Array.isArray(data.teachers)) data.teachers = [];
  if (!Array.isArray(data.records)) data.records = [];
  if (!Array.isArray(data.teacherHistory)) data.teacherHistory = [];

  initializeRoutineVersions(data);

  if (!data.masterRoutine) {
    data.masterRoutine = {
      weekdays: {},
      specialDates: {}
    };
  }

  if (!Array.isArray(data.timingHistory)) {
    data.timingHistory = [{
      effectiveFrom: '0000-00-00',
      periods: Array.from({ length: PERIOD_COUNT }, (_, i) => ({
        period: i + 1,
        start: '',
        end: ''
      }))
    }];
  }

  for (const subject of data.subjects) {
    if (!Array.isArray(subject.teacherIds)) {
      subject.teacherIds = [];
    }
  }

  for (const teacher of data.teachers) {
    if (!teacher.id) teacher.id = crypto.randomUUID();

    if (teacher.subject && !data.subjects.some(
      subject => subject.name.toLowerCase() === teacher.subject.toLowerCase()
    )) {
      data.subjects.push({
        id: crypto.randomUUID(),
        name: teacher.subject,
        teacherIds: [teacher.id],
        createdAt: new Date().toISOString()
      });
    } else if (teacher.subject) {
      const subject = data.subjects.find(
        item => item.name.toLowerCase() === teacher.subject.toLowerCase()
      );

      if (subject && !subject.teacherIds.includes(teacher.id)) {
        subject.teacherIds.push(teacher.id);
      }
    }
  }

  refreshSections();
}

function weekdayForDate(bsDate) {
  return getWeekdayFromBS(bsDate);
}

function getDateRoutine(bsDate) {
  const day = weekdayForDate(bsDate);
  const routine = resolveRoutineForDate(data, bsDate);

  if (day === 'Sunday') {
    return routine.specialDates?.[bsDate]?.sections || null;
  }

  if (day === 'Saturday') return null;

  return routine.weekdays?.[day] || null;
}

function getAssignment(bsDate, section, period) {
  const day = weekdayForDate(bsDate);
  const routine = resolveRoutineForDate(data, bsDate);

  return getTeacherForDate(
    routine,
    data.teacherHistory,
    bsDate,
    day,
    section,
    period
  );
}

function getEditingRoutine() {
  if (!editingRoutineVersionId) {
    return data.masterRoutine;
  }

  const version = data.routineVersions.find(
    item => item.id === editingRoutineVersionId
  );

  if (!version) {
    editingRoutineVersionId = '';
    return data.masterRoutine;
  }

  return version.routine;
}

function getEditingVersion() {
  return data.routineVersions.find(
    item => item.id === editingRoutineVersionId
  ) || null;
}

function getSubjectName(subjectId) {
  return data.subjects.find(item => item.id === subjectId)?.name || '';
}

function teacherSubjects(teacherId) {
  return data.subjects.filter(subject =>
    subject.teacherIds.includes(teacherId)
  );
}

function practicalSubject(subject) {
  const name = String(subject?.name || '').trim().toLowerCase();

  return (
    name === 'physics' ||
    name === 'chemistry' ||
    name === 'biology' ||
    name.startsWith('computer') ||
    name === 'ict' ||
    name.includes('information technology')
  );
}

function teacherNames(assignment) {
  const teachers = getAssignmentTeachers(assignment);

  if (!teachers.length) {
    return assignment?.teacherInitials || assignment?.teacherName || 'Not assigned';
  }

  return teachers.map(teacher => {
    const registered = data.teachers.find(item => item.id === teacher.id);

    return registered
      ? registered.initials
      : teacher.initials || teacher.name || '';
  }).filter(Boolean).join(', ');
}

function header() {
  const tabs = [
    ['counter', 'Counter'],
    ['sections', 'Sections'],
    ['teachers', 'Teachers'],
    ['subjects', 'Subjects'],
    ['routine', 'Master Routine'],
    ['routineVersions', 'Routine Versions'],
    ['changes', 'Teacher Changes'],
    ['timings', 'Period Timings'],
    ['reports', 'Reports'],
    ['backup', 'Backup']
  ];

  return `
    <header>
      <div class="brand">
        <div class="logo">R</div>
        <div><b>RRC</b><small>REPLACEMENT CLASS COUNTER</small></div>
      </div>
      <div class="topmeta">OFFLINE RECORDS</div>
    </header>

    <nav>
      ${tabs.map(([id, name]) => `
        <button data-tab="${id}" class="${tab === id ? 'active' : ''}">
          ${name}
        </button>
      `).join('')}
    </nav>

    <main id="view"></main>
    <footer>RRC · Replacement Class Counter</footer>
  `;
}

function hero(title, description) {
  return `
    <section class="hero">
      <div>
        <span class="eyebrow">RRC MANAGEMENT</span>
        <h1>${title}</h1>
        <p>${description}</p>
      </div>
    </section>
  `;
}

function render() {
  document.querySelector('#app').innerHTML = header();

  const views = {
    counter: counterView,
    sections: sectionsView,
    teachers: teachersView,
    subjects: subjectsView,
    routine: routineView,
    routineVersions: routineVersionsView,
    changes: changesView,
    timings: timingsView,
    reports: reportsView,
    backup: backupView
  };

  $('#view').innerHTML = views[tab]();
  wire();
}

function sectionsView() {
  return `
    ${hero('Section management', 'Add, rename or remove your college sections.')}

    <section class="panel">
      <h2>Add a new section</h2>
      <form id="addSectionForm" class="inline-form">
        <input id="newSection" required placeholder="e.g. XII M11">
        <button class="primary">Add section</button>
      </form>
    </section>

    <section class="panel">
      <h2>Current sections (${data.sections.length})</h2>

      ${data.sections.map(section => `
        <div class="record">
          <b>${esc(section)}</b>
          <div class="actions">
            <button class="small" data-rename-section="${esc(section)}">Rename</button>
            <button class="danger small" data-remove-section="${esc(section)}">Remove</button>
          </div>
        </div>
      `).join('') || '<p class="muted">No sections added.</p>'}
    </section>
  `;
}

function teachersView() {
  return `
    ${hero('Teacher directory', 'Register teachers and manage their details.')}

    <section class="panel">
      <h2>${editingTeacher ? 'Edit teacher' : 'Add teacher'}</h2>

      <form id="teacherForm" class="formgrid">
        <input type="hidden" id="teacherId" value="${editingTeacher?.id || ''}">

        <label>Initials
          <input id="teacherInitials" required maxlength="12"
            value="${esc(editingTeacher?.initials || '')}" placeholder="CP">
        </label>

        <label>Full name
          <input id="teacherName" required
            value="${esc(editingTeacher?.name || '')}" placeholder="Full name">
        </label>

        <button class="primary">Save teacher</button>

        ${editingTeacher ? '<button type="button" id="cancelTeacher">Cancel edit</button>' : ''}
      </form>
    </section>

    <section class="panel">
      <h2>Registered teachers (${data.teachers.length})</h2>

      ${data.teachers.map(teacher => `
        <div class="record">
          <div>
            <b>${esc(teacher.initials)} · ${esc(teacher.name)}</b>
            <small>${teacherSubjects(teacher.id).map(s => esc(s.name)).join(', ') || 'No subject assigned yet'}</small>
          </div>

          <div class="actions">
            <button class="small" data-edit-teacher="${teacher.id}">Edit</button>
            <button class="danger small" data-delete-teacher="${teacher.id}">Delete</button>
          </div>
        </div>
      `).join('') || '<p class="muted">No teachers registered yet.</p>'}
    </section>
  `;
}

function subjectsView() {
  return `
    ${hero('Subject management', 'Register subjects and select the teachers who teach each subject.')}

    <section class="panel">
      <h2>Add subject</h2>
      <form id="subjectForm" class="inline-form">
        <input id="subjectName" required placeholder="e.g. Physics">
        <button class="primary">Add subject</button>
      </form>
    </section>

    ${data.subjects.map(subject => `
      <section class="panel">
        <h2>${esc(subject.name)}</h2>

        <label>Assign a teacher
          <select data-subject-teacher="${subject.id}">
            <option value="">Choose teacher</option>
            ${data.teachers.map(teacher => `
              <option value="${teacher.id}">
                ${esc(teacher.initials)} · ${esc(teacher.name)}
              </option>
            `).join('')}
          </select>
        </label>

        <div class="record-list">
          ${getTeachersForSubject(data.subjects, subject.id, data.teachers).map(teacher => `
            <div class="record">
              <span>${esc(teacher.initials)} · ${esc(teacher.name)}</span>
              <button class="danger small"
                data-unassign="${subject.id}:${teacher.id}">Remove</button>
            </div>
          `).join('') || '<p class="muted">No teachers assigned.</p>'}
        </div>
      </section>
    `).join('')}
  `;
}

/* -------------------------------------------------------
   ROUTINE VERSIONS
------------------------------------------------------- */

function routineVersionsView() {
  const versions = getRoutineVersions(data);

  return `
    ${hero(
      'Routine versions',
      'Create date-effective timetable versions for the whole school or an individual section.'
    )}

    <section class="panel">
      <h2>Create a new routine version</h2>

      <form id="routineVersionForm" class="formgrid">

        <label>Version name
          <input id="versionName" required
            placeholder="e.g. Winter Routine, First Terminal">
        </label>

        <label>Apply this routine to
          <select id="versionScope">
            <option value="school">Whole school</option>
            <option value="section">One specific section only</option>
          </select>
        </label>

        <label id="versionSectionWrap" style="display:none">
          Select section
          <select id="versionSection">
            ${data.sections.map(section => `
              <option value="${esc(section)}">${esc(section)}</option>
            `).join('')}
          </select>
        </label>

        <label>Effective from (BS)
          <input id="versionFrom" required placeholder="YYYY-MM-DD">
        </label>

        <label>Effective until (BS)
          <input id="versionTo" placeholder="YYYY-MM-DD">
          <small class="muted">Leave blank if this version has no end date.</small>
        </label>

        <button class="primary">Create routine version</button>
      </form>

      <p class="muted">
        The new version starts as a copy of the routine already applicable
        on its start date. You can then change only the periods that need
        updating.
      </p>
    </section>

    <section class="panel">
      <h2>Saved routine versions (${versions.length})</h2>

      ${versions.map(version => `
        <div class="record">
          <div>
            <b>${esc(version.name)}</b>
            <small>
              ${version.scope === 'school'
                ? 'Whole school'
                : `Section: ${esc(version.section)}`}
              · From ${esc(version.effectiveFrom)}
              · ${version.effectiveTo
                ? `Until ${esc(version.effectiveTo)}`
                : 'No end date'}
            </small>
          </div>

          <div class="actions">
            <button class="small" data-edit-version="${version.id}">
              Edit routine
            </button>
            <button class="danger small" data-delete-version="${version.id}">
              Delete
            </button>
          </div>
        </div>
      `).join('') || '<p class="muted">No routine versions created yet.</p>'}
    </section>

    <section class="panel">
      <h2>How routine versions work</h2>
      <ul>
        <li>The original Master Routine remains your base timetable.</li>
        <li>A whole-school version applies to every section during its date range.</li>
        <li>A section-specific version overrides the whole-school routine for that section only.</li>
        <li>Different sections can have their own versions over the same dates.</li>
        <li>Replacement records already saved are not changed when you edit a routine.</li>
      </ul>
    </section>
  `;
}

/* -------------------------------------------------------
   MASTER ROUTINE EDITOR
------------------------------------------------------- */

function routineView() {
  const routine = getEditingRoutine();
  const version = getEditingVersion();

  const allowedSections = version?.scope === 'section'
    ? [version.section]
    : data.sections;

  if (!allowedSections.includes(selectedSection)) {
    selectedSection = allowedSections[0] || '';
  }

  const sundayDates = Object.keys(routine.specialDates || {}).sort();

  return `
    ${hero(
      version ? `Editing: ${esc(version.name)}` : 'Master routine',
      version
        ? `Editing the ${version.scope === 'school' ? 'whole-school' : `section ${esc(version.section)}`} routine version. Changes will be saved inside this version only.`
        : 'Create the original weekday timetable manually, one section at a time.'
    )}

    ${version ? `
      <section class="panel">
        <div class="record">
          <div>
            <b>${esc(version.name)}</b>
            <small>
              Effective ${esc(version.effectiveFrom)}
              ${version.effectiveTo ? ` to ${esc(version.effectiveTo)}` : ' onward'}
            </small>
          </div>
          <button class="small" id="exitVersionEditor">
            Back to routine versions
          </button>
        </div>
      </section>
    ` : ''}

    <section class="panel">
      <div class="toolbar">
        <label>Weekday
          <select id="routineDay">
            ${WEEKDAYS.map(day => `
              <option ${day === selectedDay ? 'selected' : ''}>${day}</option>
            `).join('')}
          </select>
        </label>

        <label>Section
          <select id="routineSection" ${version?.scope === 'section' ? 'disabled' : ''}>
            ${allowedSections.map(section => `
              <option value="${esc(section)}"
                ${section === selectedSection ? 'selected' : ''}>
                ${esc(section)}
              </option>
            `).join('')}
          </select>
        </label>
      </div>

      <p class="muted">
        Select a period cell to assign Theory or Practical.
      </p>

      <div class="period-grid">
        ${Array.from({ length: PERIOD_COUNT }, (_, i) => {
          const assignment =
            routine.weekdays?.[selectedDay]?.[selectedSection]?.[i];

          const linked =
            assignment?.practicalSessionId &&
            assignment.practicalPart === 2;

          return `
            <button class="period-card" data-edit-period="${i}">
              <b>Period ${i + 1}</b>
              <span>${esc(assignment?.subject || 'Not assigned')}</span>
              <small>${esc(teacherNames(assignment))}</small>
              ${assignment?.isLab
                ? `<em>Practical${assignment.labPeriods === 2
                    ? ` · ${assignment.practicalPart}/2`
                    : ''}</em>`
                : ''}
              ${linked ? '<small>Linked to previous period</small>' : ''}
            </button>
          `;
        }).join('')}
      </div>
    </section>

    <section class="panel">
      <h2>Sunday special routine</h2>
      <p class="muted">
        A Sunday routine is a separate copy for one specific date.
        Later weekday edits will not change it.
      </p>

      <form id="sundayForm" class="inline-form">
        <label>Sunday BS date
          <input id="sundayDate" placeholder="YYYY-MM-DD" required>
        </label>

        <label>Copy routine from
          <select id="sundaySource">
            ${WEEKDAYS.map(day => `<option>${day}</option>`).join('')}
          </select>
        </label>

        <button class="primary">Create Sunday routine</button>
      </form>

      ${sundayDates.map(date => `
        <div class="record">
          <b>
            BS ${esc(date)} · Copied from
            ${esc(routine.specialDates[date].copiedFrom || 'weekday')}
          </b>
          <button class="danger small" data-delete-sunday="${date}">
            Delete
          </button>
        </div>
      `).join('') || '<p class="muted">No special Sunday routines yet.</p>'}
    </section>
  `;
}

/* -------------------------------------------------------
   OTHER SCREENS
------------------------------------------------------- */

function changesView() {
  return `
    ${hero('Teacher changes', 'Schedule a teacher change from any effective BS date. Earlier dates retain the previous assignment.')}

    <section class="panel">
      <h2>Add teacher change</h2>

      <form id="changeForm" class="formgrid">
        <label>Effective BS date
          <input id="changeDate" placeholder="YYYY-MM-DD" required>
        </label>

        <label>Section
          <select id="changeSection">
            ${data.sections.map(s => `<option>${esc(s)}</option>`).join('')}
          </select>
        </label>

        <label>Period
          <select id="changePeriod">
            ${Array.from({ length: PERIOD_COUNT }, (_, i) => `
              <option value="${i + 1}">Period ${i + 1}</option>
            `).join('')}
          </select>
        </label>

        <label>New teacher
          <select id="changeTeacher">
            ${data.teachers.map(t => `
              <option value="${t.id}">
                ${esc(t.initials)} · ${esc(t.name)}
              </option>
            `).join('')}
          </select>
        </label>

        <button class="primary">Save teacher change</button>
      </form>

      <p class="muted">
        The selected date determines the weekday. The change applies to that
        weekday, section and period from that date onward.
      </p>
    </section>

    <section class="panel">
      <h2>Saved changes</h2>

      ${(data.teacherHistory || []).slice()
        .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
        .map(change => `
          <div class="record">
            <div>
              <b>
                ${esc(change.section)} · Period ${change.period}
                · ${esc(change.teacherInitials)}
              </b>
              <small>
                Effective BS ${esc(change.effectiveFrom)}
                · ${esc(change.weekday)}
                · ${esc(change.teacherName)}
              </small>
            </div>
          </div>
        `).join('') || '<p class="muted">No teacher changes saved.</p>'}
    </section>
  `;
}

function timingsView() {
  const base = data.timingHistory.find(
    t => t.effectiveFrom === '0000-00-00'
  ) || data.timingHistory[0];

  return `
    ${hero('Period timings', 'Set your default period schedule and future date-effective changes.')}

    <section class="panel">
      <h2>Default period timings</h2>
      <form id="defaultTimingForm">
        ${timingInputs(base?.periods || [])}
        <button class="primary">Save default timings</button>
      </form>
    </section>

    <section class="panel">
      <h2>Schedule a timing change</h2>
      <form id="timingChangeForm">
        <label>Effective BS date
          <input id="timingDate" placeholder="YYYY-MM-DD" required>
        </label>
        ${timingInputs(base?.periods || [], 'future')}
        <button class="primary">Save new schedule</button>
      </form>
    </section>

    <section class="panel">
      <h2>Saved timing schedules</h2>
      ${data.timingHistory.map(item => `
        <div class="record">
          <b>
            ${item.effectiveFrom === '0000-00-00'
              ? 'Default schedule'
              : `Effective BS ${esc(item.effectiveFrom)}`}
          </b>
          <small>
            ${item.periods.filter(p => p.start && p.end).length}
            of ${PERIOD_COUNT} periods configured
          </small>
        </div>
      `).join('')}
    </section>
  `;
}

function timingInputs(periods, prefix = 'default') {
  return `
    <div class="tablewrap">
      <table>
        <thead>
          <tr><th>Period</th><th>Start</th><th>End</th></tr>
        </thead>
        <tbody>
          ${Array.from({ length: PERIOD_COUNT }, (_, i) => {
            const item = periods[i] || {};

            return `
              <tr>
                <td>${i + 1}</td>
                <td>
                  <input type="time" id="${prefix}Start${i}"
                    value="${esc(item.start || '')}">
                </td>
                <td>
                  <input type="time" id="${prefix}End${i}"
                    value="${esc(item.end || '')}">
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function counterView() {
  const valid = validateBSDate(selectedBS);
  const day = valid?.weekday || '';
  const sections = getDateRoutine(selectedBS);
  const entries = [];

  if (sections) {
    for (const section of data.sections) {
      for (let i = 0; i < PERIOD_COUNT; i++) {
        const assignment = getAssignment(selectedBS, section, i + 1);

        if (assignment?.subject) {
          entries.push({
            section,
            period: i + 1,
            assignment
          });
        }
      }
    }
  }

  return `
    ${hero('Replacement counter', 'Select a BS date and record the teacher covering a scheduled class.')}

    <section class="panel controls">
      <label>Replacement date (BS)
        <input id="counterDate" value="${esc(selectedBS)}"
          placeholder="YYYY-MM-DD">
      </label>

      <div class="date-info">
        <b>${valid ? esc(day) : 'Invalid date'}</b>
        <small>${valid ? `AD ${esc(valid.ad)}` : 'Use YYYY-MM-DD format'}</small>
      </div>
    </section>

    ${!valid ? '<div class="note">Enter a valid Nepali date.</div>' : ''}
    ${day === 'Saturday' ? '<div class="note">Saturday is closed by default.</div>' : ''}
    ${day === 'Sunday' && !sections
      ? '<div class="note">No special Sunday routine exists for this date. Create one in Master Routine first.</div>'
      : ''}

    ${sections ? `
      <section class="panel">
        <h2>Scheduled classes for BS ${esc(selectedBS)}</h2>
        <p class="muted">
          Choose the class being covered, then choose the replacement teacher.
        </p>

        <div class="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Section</th>
                <th>Period</th>
                <th>Subject</th>
                <th>Scheduled teacher(s)</th>
                <th>Record</th>
              </tr>
            </thead>
            <tbody>
              ${entries.map(item => `
                <tr>
                  <td>${esc(item.section)}</td>
                  <td>${item.period}</td>
                  <td>${esc(item.assignment.subject)}</td>
                  <td>${esc(teacherNames(item.assignment))}</td>
                  <td>
                    <button class="primary small"
                      data-replace="${esc(item.section)}:${item.period}">
                      Replace
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${entries.length
          ? ''
          : '<p class="muted">No scheduled classes found for this date.</p>'}
      </section>
    ` : ''}

    <section class="panel">
      <h2>Entries for this date</h2>

      ${data.records.filter(r => r.dateBS === selectedBS).map(record => `
        <div class="record">
          <div>
            <b>${esc(record.initials || record.teacherInitials)} · ${esc(record.teacher)}</b>
            <small>
              ${esc(record.section)} · ${esc(record.subject)}
              · Period ${record.period}
              · ${record.periods || 1} period(s)
            </small>
          </div>
          <button class="danger small" data-delete-record="${record.id}">
            Undo
          </button>
        </div>
      `).join('') || '<p class="muted">No replacement entries for this date.</p>'}
    </section>
  `;
}

function reportsView() {
  const grouped = new Map();

  for (const record of data.records) {
    const key = record.teacherId || record.teacher;

    if (!grouped.has(key)) {
      grouped.set(key, {
        initials: record.initials || record.teacherInitials || '',
        name: record.teacher || record.teacherName || '',
        total: 0,
        dates: []
      });
    }

    const item = grouped.get(key);
    item.total += Number(record.periods || 1);
    item.dates.push(
      `${record.dateBS} (${record.section}, P${record.period || 1})`
    );
  }

  const total = data.records.reduce(
    (sum, record) => sum + Number(record.periods || 1),
    0
  );

  return `
    ${hero('Replacement reports', 'Teacher-wise totals and dates of replacement classes.')}

    <section class="panel">
      <div class="total report-total">
        <b>${total}</b>
        <small>Total replacement periods</small>
      </div>

      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Initials</th>
              <th>Teacher</th>
              <th>Periods</th>
              <th>Dates and sections</th>
            </tr>
          </thead>
          <tbody>
            ${[...grouped.values()].map(item => `
              <tr>
                <td>${esc(item.initials)}</td>
                <td>${esc(item.name)}</td>
                <td>${item.total}</td>
                <td>${esc(item.dates.join(', '))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <button class="primary" id="printReport">
        Print report / Save as PDF
      </button>
    </section>
  `;
}

function backupView() {
  return `
    ${hero('Backup and restore', 'Save a copy of all RRC data or restore a previous backup.')}

    <section class="panel">
      <button class="primary" id="exportBackup">
        Download JSON backup
      </button>

      <label class="filelabel">Restore backup
        <input type="file" id="restoreFile" accept=".json,application/json">
      </label>

      <p class="muted">
        Keep backup files somewhere safe, especially before changing devices
        or reinstalling the app.
      </p>
    </section>
  `;
}

/* -------------------------------------------------------
   PERIOD EDITOR
------------------------------------------------------- */

function openPeriodEditor(index) {
  const routine = getEditingRoutine();

  const periods =
    routine.weekdays?.[selectedDay]?.[selectedSection] || [];

  const clicked = periods[index] || {};

  const startIndex = clicked.practicalSessionId
    ? Math.max(0, Number(clicked.practicalStartPeriod || index + 1) - 1)
    : index;

  const current = periods[startIndex] || {};
  const editingPractical = Boolean(current.isLab);

  const modal = document.createElement('dialog');
  modal.className = 'modal';

  modal.innerHTML = `
    <form method="dialog" class="modalbox" id="periodForm">
      <button class="close" value="cancel">×</button>

      <h2>
        ${esc(selectedSection)} · Period ${startIndex + 1}
        ${current.labPeriods === 2 ? `–${startIndex + 2}` : ''}
      </h2>

      <label>Class type
        <select id="classType">
          <option value="theory" ${!editingPractical ? 'selected' : ''}>Theory</option>
          <option value="practical" ${editingPractical ? 'selected' : ''}>Practical</option>
        </select>
      </label>

      <div id="periodCountWrap">
        <label>Practical duration
          <select id="practicalPeriods">
            <option value="1" ${current.labPeriods !== 2 ? 'selected' : ''}>One period</option>
            <option value="2" ${current.labPeriods === 2 ? 'selected' : ''}>Two consecutive periods</option>
          </select>
        </label>
      </div>

      <label>Subject
        <select id="periodSubject">
          <option value="">Choose subject</option>
        </select>
      </label>

      <div id="teacherSelection"></div>

      <button class="primary" id="savePeriod">Save assignment</button>
      <button type="button" class="danger" id="clearPeriod">Clear assignment</button>
    </form>
  `;

  document.body.append(modal);

  const typeSelect = modal.querySelector('#classType');
  const durationWrap = modal.querySelector('#periodCountWrap');
  const durationSelect = modal.querySelector('#practicalPeriods');
  const subjectSelect = modal.querySelector('#periodSubject');
  const teacherSelection = modal.querySelector('#teacherSelection');

  function updateSubjectOptions() {
    const type = typeSelect.value;

    const eligible = data.subjects.filter(subject =>
      type === 'practical' ? practicalSubject(subject) : true
    );

    subjectSelect.innerHTML = `
      <option value="">Choose subject</option>
      ${eligible.map(subject => `
        <option value="${subject.id}"
          ${subject.id === current.subjectId ? 'selected' : ''}>
          ${esc(subject.name)}
        </option>
      `).join('')}
    `;

    if (!eligible.some(subject => subject.id === current.subjectId)) {
      subjectSelect.value = '';
    }

    durationWrap.style.display =
      type === 'practical' ? '' : 'none';

    updateTeacherOptions();
  }

  function updateTeacherOptions() {
    const subjectId = subjectSelect.value;

    const teachers = getTeachersForSubject(
      data.subjects,
      subjectId,
      data.teachers
    );

    if (typeSelect.value === 'theory') {
      teacherSelection.innerHTML = `
        <label>Teacher
          <select id="periodTeacher">
            <option value="">Choose registered teacher</option>
            ${teachers.map(teacher => `
              <option value="${teacher.id}"
                ${teacher.id === current.teacherId ? 'selected' : ''}>
                ${esc(teacher.initials)} · ${esc(teacher.name)}
              </option>
            `).join('')}
          </select>
        </label>
      `;
    } else {
      const selectedIds = new Set(
        current.isLab
          ? getAssignmentTeachers(current).map(teacher => teacher.id)
          : []
      );

      teacherSelection.innerHTML = `
        <fieldset class="teacher-check-list">
          <legend>Select practical teacher(s)</legend>

          ${teachers.map(teacher => `
            <label class="check-row">
              <input type="checkbox" name="practicalTeacher"
                value="${teacher.id}"
                ${selectedIds.has(teacher.id) ? 'checked' : ''}>
              ${esc(teacher.initials)} · ${esc(teacher.name)}
            </label>
          `).join('')}

          ${teachers.length
            ? ''
            : '<p class="muted">No teachers are registered for this subject. Assign teachers in Subject Management first.</p>'}
        </fieldset>
      `;
    }
  }

  typeSelect.addEventListener('change', updateSubjectOptions);
  subjectSelect.addEventListener('change', updateTeacherOptions);

  updateSubjectOptions();

  modal.querySelector('#savePeriod').addEventListener('click', async event => {
    event.preventDefault();

    const type = typeSelect.value;
    const subjectId = subjectSelect.value;
    const subject = data.subjects.find(item => item.id === subjectId);

    if (!subject) {
      notify('Choose a registered subject.');
      return;
    }

    try {
      if (type === 'theory') {
        const teacherId = modal.querySelector('#periodTeacher')?.value;
        const teacher = data.teachers.find(item => item.id === teacherId);

        if (!teacher) {
          notify('Choose a registered teacher for this theory class.');
          return;
        }

        updatePeriod(
          routine,
          selectedDay,
          selectedSection,
          startIndex,
          {
            type: 'theory',
            subjectId: subject.id,
            subject: subject.name,
            teacherId: teacher.id,
            teacherInitials: teacher.initials,
            teacherName: teacher.name,
            isLab: false,
            labPeriods: 1
          }
        );
      } else {
        const teacherIds = [
          ...modal.querySelectorAll('input[name="practicalTeacher"]:checked')
        ].map(input => input.value);

        if (!teacherIds.length) {
          notify('Select at least one practical teacher.');
          return;
        }

        const teachers = teacherIds.map(id =>
          data.teachers.find(teacher => teacher.id === id)
        ).filter(Boolean);

        assignPracticalSession(
          routine,
          selectedDay,
          selectedSection,
          startIndex,
          {
            type: 'practical',
            subjectId: subject.id,
            subject: subject.name,
            teacherIds,
            teachers
          },
          Number(durationSelect.value)
        );
      }

      await persist();
      modal.close();
      modal.remove();
      render();
    } catch (error) {
      notify(error.message);
    }
  });

  modal.querySelector('#clearPeriod').addEventListener('click', async () => {
    try {
      clearPeriodAssignment(
        routine,
        selectedDay,
        selectedSection,
        startIndex
      );

      await persist();
      modal.close();
      modal.remove();
      render();
    } catch (error) {
      notify(error.message);
    }
  });

  modal.addEventListener('close', () => modal.remove());
  modal.showModal();
}

/* -------------------------------------------------------
   REPLACEMENT RECORDING
------------------------------------------------------- */

function openReplacement(section, period) {
  const applicableRoutine = resolveRoutineForDate(data, selectedBS);
  const assignment = getAssignment(selectedBS, section, period);

  if (!assignment?.subject) {
    notify('There is no scheduled subject in this period.');
    return;
  }

  const modal = document.createElement('dialog');
  modal.className = 'modal';

  if (!assignment.isLab) {
    modal.innerHTML = `
      <form method="dialog" class="modalbox">
        <button class="close" value="cancel">×</button>

        <h2>Record theory replacement</h2>

        <p class="muted">
          ${esc(section)} · Period ${period} · ${esc(assignment.subject)}
        </p>

        <p>Scheduled teacher: <b>${esc(teacherNames(assignment))}</b></p>

        <label>Replacement teacher
          <select id="replacementTeacher">
            <option value="">Choose teacher</option>
            ${data.teachers.map(teacher => `
              <option value="${teacher.id}">
                ${esc(teacher.initials)} · ${esc(teacher.name)}
              </option>
            `).join('')}
          </select>
        </label>

        <button class="primary" id="saveReplacement">
          Save replacement
        </button>
      </form>
    `;

    document.body.append(modal);

    modal.querySelector('#saveReplacement').addEventListener('click', async event => {
      event.preventDefault();

      const teacherId = modal.querySelector('#replacementTeacher').value;
      const teacher = data.teachers.find(item => item.id === teacherId);

      if (!teacher) {
        notify('Choose the replacement teacher.');
        return;
      }

      if (data.records.some(record =>
        record.dateBS === selectedBS &&
        record.section === section &&
        Number(record.period) === period
      )) {
        notify('A replacement has already been recorded for this period. Undo it first if you need to change it.');
        return;
      }

      try {
        const record = createReplacementRecord({
          masterRoutine: applicableRoutine,
          teacherHistory: data.teacherHistory,
          bsDate: selectedBS,
          section,
          period,
          replacementTeacher: teacher,
          periods: 1
        });

        data.records.push(record);
        await persist();

        modal.close();
        modal.remove();
        render();
      } catch (error) {
        notify(error.message);
      }
    });
  } else {
    const sessionLength = Math.max(
      1,
      Math.min(2, Number(assignment.labPeriods) || 1)
    );

    const startPeriod = Number(
      assignment.practicalStartPeriod || period
    );

    const sessionPeriods = Array.from(
      { length: sessionLength },
      (_, index) => startPeriod + index
    );

    const originalTeachers = getAssignmentTeachers(assignment);

    modal.innerHTML = `
      <form method="dialog" class="modalbox">
        <button class="close" value="cancel">×</button>

        <h2>Practical replacement</h2>

        <p class="muted">
          ${esc(section)} · ${esc(assignment.subject)}
          · Period${sessionLength === 2 ? 's' : ''}
          ${sessionPeriods.join(' and ')}
        </p>

        <label>Original practical teacher being replaced
          <select id="originalPracticalTeacher">
            <option value="">Choose original teacher</option>

            ${originalTeachers.map(teacher => {
              const registered = data.teachers.find(
                item => item.id === teacher.id
              );

              return `
                <option value="${teacher.id}">
                  ${esc(registered?.initials || teacher.initials || '')} ·
                  ${esc(registered?.name || teacher.name || '')}
                </option>
              `;
            }).join('')}
          </select>
        </label>

        <p><b>Select the period(s) to replace:</b></p>

        ${sessionPeriods.map(sessionPeriod => `
          <div class="practical-replacement-row">
            <label class="check-row">
              <input type="checkbox" class="replacement-period-check"
                data-period="${sessionPeriod}"
                ${sessionPeriod === period ? 'checked' : ''}>
              Period ${sessionPeriod}
            </label>

            <label>Replacement teacher
              <select class="period-replacement-teacher"
                data-period="${sessionPeriod}">
                <option value="">Choose teacher</option>
                ${data.teachers.map(teacher => `
                  <option value="${teacher.id}">
                    ${esc(teacher.initials)} · ${esc(teacher.name)}
                  </option>
                `).join('')}
              </select>
            </label>
          </div>
        `).join('')}

        <button class="primary" id="savePracticalReplacement">
          Save practical replacement
        </button>
      </form>
    `;

    document.body.append(modal);

    modal.querySelector('#savePracticalReplacement').addEventListener('click', async event => {
      event.preventDefault();

      const originalTeacherId =
        modal.querySelector('#originalPracticalTeacher').value;

      if (!originalTeacherId) {
        notify('Choose the original practical teacher being replaced.');
        return;
      }

      const selectedPeriods = [
        ...modal.querySelectorAll('.replacement-period-check:checked')
      ];

      if (!selectedPeriods.length) {
        notify('Select at least one period to replace.');
        return;
      }

      const replacements = [];

      for (const checkbox of selectedPeriods) {
        const selectedPeriod = Number(checkbox.dataset.period);

        const teacherId = modal.querySelector(
          `.period-replacement-teacher[data-period="${selectedPeriod}"]`
        ).value;

        const replacementTeacher = data.teachers.find(
          teacher => teacher.id === teacherId
        );

        if (!replacementTeacher) {
          notify(`Choose a replacement teacher for period ${selectedPeriod}.`);
          return;
        }

        if (data.records.some(record =>
          record.dateBS === selectedBS &&
          record.section === section &&
          Number(record.period) === selectedPeriod
        )) {
          notify(`A replacement has already been recorded for period ${selectedPeriod}. Undo it first if you need to change it.`);
          return;
        }

        replacements.push({
          period: selectedPeriod,
          replacementTeacher
        });
      }

      try {
        const records = createPracticalReplacementRecords({
          masterRoutine: applicableRoutine,
          teacherHistory: data.teacherHistory,
          bsDate: selectedBS,
          section,
          period: startPeriod,
          originalTeacherId,
          replacements
        });

        data.records.push(...records);
        await persist();

        modal.close();
        modal.remove();
        render();
      } catch (error) {
        notify(error.message);
      }
    });
  }

  modal.addEventListener('close', () => modal.remove());
  modal.showModal();
}

/* -------------------------------------------------------
   EVENT HANDLERS
------------------------------------------------------- */

function wire() {
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.onclick = () => {
      tab = button.dataset.tab;
      editingTeacher = null;
      render();
    };
  });

  /* Section management */

  const addSectionForm = $('#addSectionForm');

  if (addSectionForm) {
    addSectionForm.onsubmit = async event => {
      event.preventDefault();

      const name = $('#newSection').value.trim();

      if (!name) return;

      if (data.sections.some(section =>
        section.toLowerCase() === name.toLowerCase()
      )) {
        notify('That section already exists.');
        return;
      }

      data.sections.push(name);
      refreshSections();
      await persist();
      render();
    };
  }

  document.querySelectorAll('[data-rename-section]').forEach(button => {
    button.onclick = async () => {
      const oldName = button.dataset.renameSection;

      const newName = prompt(
        'Enter the new section name:',
        oldName
      )?.trim();

      if (!newName || newName === oldName) return;

      if (data.sections.some(section =>
        section.toLowerCase() === newName.toLowerCase()
      )) {
        notify('That section name already exists.');
        return;
      }

      data.sections = data.sections.map(
        section => section === oldName ? newName : section
      );

      const routinesToUpdate = [
        data.masterRoutine,
        ...(data.routineVersions || []).map(version => version.routine)
      ];

      for (const routine of routinesToUpdate) {
        if (!routine) continue;

        for (const day of WEEKDAYS) {
          const dayRoutine = routine.weekdays?.[day];

          if (dayRoutine?.[oldName]) {
            dayRoutine[newName] = dayRoutine[oldName];
            delete dayRoutine[oldName];
          }
        }

        for (const special of Object.values(routine.specialDates || {})) {
          if (special.sections?.[oldName]) {
            special.sections[newName] = special.sections[oldName];
            delete special.sections[oldName];
          }
        }
      }

      for (const version of data.routineVersions || []) {
        if (version.scope === 'section' && version.section === oldName) {
          version.section = newName;
        }
      }

      data.teacherHistory.forEach(change => {
        if (change.section === oldName) {
          change.section = newName;
        }
      });

      data.records.forEach(record => {
        if (record.section === oldName) {
          record.section = newName;
        }
      });

      refreshSections();
      await persist();
      render();
    };
  });

  document.querySelectorAll('[data-remove-section]').forEach(button => {
    button.onclick = async () => {
      const section = button.dataset.removeSection;

      if (!confirm(
        `Remove ${section}? Its routine assignments, section-specific routine versions and teacher-change entries will also be removed. Replacement records will be retained.`
      )) {
        return;
      }

      data.sections = data.sections.filter(item => item !== section);

      const routinesToUpdate = [
        data.masterRoutine,
        ...(data.routineVersions || []).map(version => version.routine)
      ];

      for (const routine of routinesToUpdate) {
        if (!routine) continue;

        for (const day of WEEKDAYS) {
          delete routine.weekdays?.[day]?.[section];
        }

        for (const special of Object.values(routine.specialDates || {})) {
          delete special.sections?.[section];
        }
      }

      data.routineVersions = (data.routineVersions || []).filter(
        version => !(version.scope === 'section' && version.section === section)
      );

      if (
        editingRoutineVersionId &&
        !data.routineVersions.some(v => v.id === editingRoutineVersionId)
      ) {
        editingRoutineVersionId = '';
      }

      data.teacherHistory = data.teacherHistory.filter(
        change => change.section !== section
      );

      refreshSections();
      await persist();
      render();
    };
  });

  /* Teacher management */

  const teacherForm = $('#teacherForm');

  if (teacherForm) {
    teacherForm.onsubmit = async event => {
      event.preventDefault();

      const id = $('#teacherId').value;
      const initials = $('#teacherInitials').value.trim();
      const name = $('#teacherName').value.trim();

      if (!initials || !name) return;

      const teacher = {
        id: id || crypto.randomUUID(),
        initials,
        name
      };

      if (id) {
        data.teachers = data.teachers.map(
          item => item.id === id ? teacher : item
        );
      } else {
        data.teachers.push(teacher);
      }

      editingTeacher = null;
      await persist();
      render();
    };
  }

  $('#cancelTeacher')?.addEventListener('click', () => {
    editingTeacher = null;
    render();
  });

  document.querySelectorAll('[data-edit-teacher]').forEach(button => {
    button.onclick = () => {
      editingTeacher = data.teachers.find(
        teacher => teacher.id === button.dataset.editTeacher
      );

      render();
    };
  });

  document.querySelectorAll('[data-delete-teacher]').forEach(button => {
    button.onclick = async () => {
      const id = button.dataset.deleteTeacher;

      if (!confirm(
        'Delete this teacher from the directory? Historical records will remain.'
      )) {
        return;
      }

      data.teachers = data.teachers.filter(
        teacher => teacher.id !== id
      );

      data.subjects.forEach(subject => {
        subject.teacherIds = subject.teacherIds.filter(
          teacherId => teacherId !== id
        );
      });

      await persist();
      render();
    };
  });

  /* Subject management */

  const subjectForm = $('#subjectForm');

  if (subjectForm) {
    subjectForm.onsubmit = async event => {
      event.preventDefault();

      try {
        addSubject(data.subjects, $('#subjectName').value);
        await persist();
        render();
      } catch (error) {
        notify(error.message);
      }
    };
  }

  document.querySelectorAll('[data-subject-teacher]').forEach(select => {
    select.onchange = async () => {
      if (!select.value) return;

      try {
        assignTeacherToSubject(
          data.subjects,
          select.dataset.subjectTeacher,
          select.value
        );

        await persist();
        render();
      } catch (error) {
        notify(error.message);
      }
    };
  });

  document.querySelectorAll('[data-unassign]').forEach(button => {
    button.onclick = async () => {
      const [subjectId, teacherId] =
        button.dataset.unassign.split(':');

      removeTeacherFromSubject(
        data.subjects,
        subjectId,
        teacherId
      );

      await persist();
      render();
    };
  });

  /* Routine version creation and management */

  $('#versionScope')?.addEventListener('change', event => {
    $('#versionSectionWrap').style.display =
      event.target.value === 'section' ? '' : 'none';
  });

  $('#routineVersionForm')?.addEventListener('submit', async event => {
    event.preventDefault();

    try {
      const version = createRoutineVersion(data, {
        name: $('#versionName').value,
        scope: $('#versionScope').value,
        section: $('#versionSection').value,
        effectiveFrom: $('#versionFrom').value.trim(),
        effectiveTo: $('#versionTo').value.trim()
      });

      editingRoutineVersionId = version.id;
      selectedSection = version.scope === 'section'
        ? version.section
        : (data.sections[0] || '');

      await persist();

      tab = 'routine';
      render();
    } catch (error) {
      notify(error.message);
    }
  });

  document.querySelectorAll('[data-edit-version]').forEach(button => {
    button.onclick = () => {
      editingRoutineVersionId = button.dataset.editVersion;

      const version = getEditingVersion();

      if (!version) return;

      selectedSection = version.scope === 'section'
        ? version.section
        : (data.sections[0] || '');

      tab = 'routine';
      render();
    };
  });

  document.querySelectorAll('[data-delete-version]').forEach(button => {
    button.onclick = async () => {
      const version = data.routineVersions.find(
        item => item.id === button.dataset.deleteVersion
      );

      if (!version) return;

      if (!confirm(
        `Delete routine version "${version.name}"? This cannot be undone.`
      )) {
        return;
      }

      deleteRoutineVersion(data, version.id);

      if (editingRoutineVersionId === version.id) {
        editingRoutineVersionId = '';
      }

      await persist();
      render();
    };
  });

  $('#exitVersionEditor')?.addEventListener('click', () => {
    editingRoutineVersionId = '';
    tab = 'routineVersions';
    render();
  });

  /* Master routine editor */

  $('#routineDay')?.addEventListener('change', event => {
    selectedDay = event.target.value;
    render();
  });

  $('#routineSection')?.addEventListener('change', event => {
    selectedSection = event.target.value;
    render();
  });

  document.querySelectorAll('[data-edit-period]').forEach(button => {
    button.onclick = () => {
      openPeriodEditor(Number(button.dataset.editPeriod));
    };
  });

  $('#sundayForm')?.addEventListener('submit', async event => {
    event.preventDefault();

    const date = $('#sundayDate').value.trim();
    const valid = validateBSDate(date);

    if (!valid || valid.weekday !== 'Sunday') {
      notify('Enter a valid BS date that falls on Sunday.');
      return;
    }

    try {
      createSundayRoutine(
        getEditingRoutine(),
        date,
        $('#sundaySource').value
      );

      await persist();
      render();
    } catch (error) {
      notify(error.message);
    }
  });

  document.querySelectorAll('[data-delete-sunday]').forEach(button => {
    button.onclick = async () => {
      const date = button.dataset.deleteSunday;

      if (!confirm(`Delete the special routine for BS ${date}?`)) {
        return;
      }

      deleteSundayRoutine(getEditingRoutine(), date);
      await persist();
      render();
    };
  });

  /* Teacher changes */

  $('#changeForm')?.addEventListener('submit', async event => {
    event.preventDefault();

    const effectiveFrom = $('#changeDate').value.trim();
    const valid = validateBSDate(effectiveFrom);

    if (!valid || !WEEKDAYS.includes(valid.weekday)) {
      notify('Choose a valid Monday–Friday BS date.');
      return;
    }

    const section = $('#changeSection').value;
    const period = Number($('#changePeriod').value);

    const teacher = data.teachers.find(
      item => item.id === $('#changeTeacher').value
    );

    const original = getAssignment(effectiveFrom, section, period);

    if (!original?.subject) {
      notify('There is no subject assigned to this section and period on that weekday.');
      return;
    }

    if (!teacher) {
      notify('Choose a registered teacher.');
      return;
    }

    try {
      addTeacherChange(data.teacherHistory, {
        effectiveFrom,
        weekday: valid.weekday,
        section,
        period,
        teacherId: teacher.id,
        teacherName: teacher.name,
        teacherInitials: teacher.initials,
        subject: original.subject
      });

      await persist();
      render();
    } catch (error) {
      notify(error.message);
    }
  });

  /* Period timings */

  $('#defaultTimingForm')?.addEventListener('submit', async event => {
    event.preventDefault();

    const periods = Array.from({ length: PERIOD_COUNT }, (_, i) => ({
      start: $(`#defaultStart${i}`).value,
      end: $(`#defaultEnd${i}`).value
    }));

    try {
      addTimingChange(data.timingHistory, '0000-00-00', periods);
      await persist();
      notify('Default period timings saved.');
      render();
    } catch (error) {
      notify(error.message);
    }
  });

  $('#timingChangeForm')?.addEventListener('submit', async event => {
    event.preventDefault();

    const effectiveFrom = $('#timingDate').value.trim();

    if (!validateBSDate(effectiveFrom)) {
      notify('Enter a valid BS effective date.');
      return;
    }

    const periods = Array.from({ length: PERIOD_COUNT }, (_, i) => ({
      start: $(`#futureStart${i}`).value,
      end: $(`#futureEnd${i}`).value
    }));

    try {
      addTimingChange(data.timingHistory, effectiveFrom, periods);
      await persist();
      notify('New timing schedule saved.');
      render();
    } catch (error) {
      notify(error.message);
    }
  });

  /* Counter date */

  $('#counterDate')?.addEventListener('change', event => {
    const value = event.target.value.trim();

    if (!validateBSDate(value)) {
      notify('Enter a valid BS date.');
      return;
    }

    selectedBS = value;
    render();
  });

  /* Replacement records */

  document.querySelectorAll('[data-replace]').forEach(button => {
    button.onclick = () => {
      const [section, period] = button.dataset.replace.split(':');
      openReplacement(section, Number(period));
    };
  });

  document.querySelectorAll('[data-delete-record]').forEach(button => {
    button.onclick = async () => {
      if (!confirm('Undo this replacement entry?')) return;

      data.records = data.records.filter(
        record => record.id !== button.dataset.deleteRecord
      );

      await persist();
      render();
    };
  });

  /* Reports */

  $('#printReport')?.addEventListener('click', () => {
    window.print();
  });

  /* Backup and restore */

  $('#exportBackup')?.addEventListener('click', () => {
    const blob = new Blob(
      [createBackup(data)],
      { type: 'application/json' }
    );

    downloadFile('rrc-backup.json', blob);
  });

  $('#restoreFile')?.addEventListener('change', async event => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const restored = restoreBackup(await file.text());

      data = restored;
      editingRoutineVersionId = '';
      initialiseData();

      await persist();

      notify('Backup restored successfully.');
      render();
    } catch (error) {
      notify(`Could not restore backup: ${error.message}`);
    }
  });
}

/* -------------------------------------------------------
   FILE DOWNLOAD AND APP START
------------------------------------------------------- */

function downloadFile(name, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = name;
  link.click();

  URL.revokeObjectURL(url);
}

async function start() {
  data = await loadData();

  initialiseData();

  await persist();
  render();
}

start().catch(error => {
  console.error('RRC startup error:', error);

  document.querySelector('#app').innerHTML = `
    <main class="panel">
      <h2>RRC could not start</h2>
      <p>${esc(error.message)}</p>
      <p class="muted">
        Please share the browser console error before clearing any app data.
      </p>
    </main>
  `;
});
