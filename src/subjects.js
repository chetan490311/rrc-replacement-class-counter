
export function createSubject(name) {
  const cleanName = String(name || '').trim();

  if (!cleanName) {
    throw new Error('Enter a subject name.');
  }

  return {
    id: crypto.randomUUID(),
    name: cleanName,
    teacherIds: [],
    createdAt: new Date().toISOString()
  };
}

export function addSubject(subjects, name) {
  const cleanName = String(name || '').trim();

  const exists = subjects.some(
    subject => subject.name.toLowerCase() === cleanName.toLowerCase()
  );

  if (exists) {
    throw new Error('This subject already exists.');
  }

  subjects.push(createSubject(cleanName));
  return subjects;
}

export function assignTeacherToSubject(subjects, subjectId, teacherId) {
  const subject = subjects.find(item => item.id === subjectId);

  if (!subject) throw new Error('Subject not found.');
  if (!teacherId) throw new Error('Choose a teacher.');

  if (!subject.teacherIds.includes(teacherId)) {
    subject.teacherIds.push(teacherId);
  }

  return subjects;
}

export function removeTeacherFromSubject(subjects, subjectId, teacherId) {
  const subject = subjects.find(item => item.id === subjectId);

  if (!subject) throw new Error('Subject not found.');

  subject.teacherIds = subject.teacherIds.filter(
    id => id !== teacherId
  );

  return subjects;
}

export function getTeachersForSubject(subjects, subjectId, teachers) {
  const subject = subjects.find(item => item.id === subjectId);

  if (!subject) return [];

  return teachers.filter(teacher =>
    subject.teacherIds.includes(teacher.id)
  );
}

export function getSubjectById(subjects, subjectId) {
  return subjects.find(item => item.id === subjectId) || null;
}
