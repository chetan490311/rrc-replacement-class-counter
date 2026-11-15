
function recordPeriods(record) {
  return Number(record.periods || 1);
}

function dateValue(record) {
  return record.dateBS || record.dateAD || '';
}

// Summarize replacement classes for every teacher.
export function getTeacherSummary(records) {
  const summary = {};

  for (const record of records || []) {
    const id = record.teacherId || record.teacher || record.initials;

    if (!summary[id]) {
      summary[id] = {
        teacherId: record.teacherId || '',
        initials: record.initials || '',
        teacher: record.teacher || '',
        totalPeriods: 0,
        entries: [],
        dates: []
      };
    }

    const item = summary[id];
    item.totalPeriods += recordPeriods(record);

    item.entries.push({
      dateBS: record.dateBS || '',
      dateAD: record.dateAD || '',
      weekday: record.weekday || '',
      section: record.section || '',
      subject: record.subject || '',
      period: record.period || '',
      periods: recordPeriods(record),
      assignedTeacher: record.assignedTeacher || ''
    });

    item.dates.push(
      `${dateValue(record)} (${record.section || 'Unknown section'})`
    );
  }

  return Object.values(summary).sort((a, b) =>
    a.initials.localeCompare(b.initials)
  );
}

// Summarize replacement classes for one section.
export function getSectionSummary(records, section) {
  return (records || [])
    .filter(record => record.section === section)
    .sort((a, b) =>
      dateValue(a).localeCompare(dateValue(b))
    )
    .map(record => ({
      dateBS: record.dateBS || '',
      dateAD: record.dateAD || '',
      weekday: record.weekday || '',
      section: record.section || '',
      teacher: record.teacher || '',
      initials: record.initials || '',
      subject: record.subject || '',
      period: record.period || '',
      periods: recordPeriods(record),
      assignedTeacher: record.assignedTeacher || ''
    }));
}

// Get records between two BS dates, inclusive.
export function getRecordsBetweenBS(records, fromDate, toDate) {
  return (records || []).filter(record => {
    const date = record.dateBS || '';

    if (!date) return false;
    if (fromDate && date < fromDate) return false;
    if (toDate && date > toDate) return false;

    return true;
  });
}

// Get records for a particular BS month, e.g. 2083-05.
export function getRecordsForBSMonth(records, yearMonth) {
  if (!/^\d{4}-\d{2}$/.test(yearMonth || '')) {
    throw new Error('Enter the BS month as YYYY-MM.');
  }

  return (records || []).filter(record =>
    (record.dateBS || '').startsWith(`${yearMonth}-`)
  );
}

// Produce a monthly teacher report.
export function getMonthlyTeacherSummary(records, yearMonth) {
  return getTeacherSummary(
    getRecordsForBSMonth(records, yearMonth)
  );
}

// Calculate the total replacement periods.
export function getTotalReplacementPeriods(records) {
  return (records || []).reduce(
    (total, record) => total + recordPeriods(record),
    0
  );
}

// Calculate total replacements for one teacher.
export function getTeacherTotal(records, teacherId) {
  return (records || [])
    .filter(record => record.teacherId === teacherId)
    .reduce((total, record) => total + recordPeriods(record), 0);
}

// Create printable report rows in the requested column order.
export function getPrintableReportRows(records) {
  return getTeacherSummary(records).map(item => ({
    initials: item.initials,
    fullName: item.teacher,
    replacementClasses: item.totalPeriods,
    dates: item.dates.join(', ')
  }));
}

// Create CSV text that can be opened in Excel.
export function createReportCSV(records) {
  const rows = getPrintableReportRows(records);

  const headers = [
    'Initials',
    'Full Name',
    'Number of Replacement Classes',
    'Dates / Sections'
  ];

  const escapeCSV = value =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;

  return [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => [
      row.initials,
      row.fullName,
      row.replacementClasses,
      row.dates
    ].map(escapeCSV).join(','))
  ].join('\r\n');
}
