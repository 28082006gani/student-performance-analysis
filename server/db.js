const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'student_portal.db');
const db = new DatabaseSync(DB_PATH);

// Initialize schema
function initDatabase() {
  // Foreign keys enabled
  db.exec('PRAGMA foreign_keys = ON;');

  // Users table: teachers and students
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('teacher', 'student')),
      student_id INTEGER UNIQUE,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Marks table: records individual subject marks
  db.exec(`
    CREATE TABLE IF NOT EXISTS marks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      marks REAL NOT NULL CHECK(marks >= 0 AND marks <= 100),
      uploaded_by INTEGER,
      date TEXT DEFAULT CURRENT_DATE,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, subject)
    );
  `);

  // Attendance table
  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      period TEXT NOT NULL, -- e.g. '2026-10' or 'Overall'
      attendance_percentage REAL NOT NULL CHECK(attendance_percentage >= 0 AND attendance_percentage <= 100),
      present_days INTEGER DEFAULT 0,
      total_days INTEGER DEFAULT 0,
      notes TEXT,
      uploaded_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, period)
    );
  `);

  seedInitialData();
  updateStudentPasswordsToFirst4Caps();
}

// Ensure all student passwords follow rule: first 4 letters of name in CAPITAL
function updateStudentPasswordsToFirst4Caps() {
  const students = db.prepare("SELECT id, name FROM users WHERE role = 'student'").all();
  const updateStmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
  for (const s of students) {
    const rawPass = (s.name || '').trim().substring(0, 4).toUpperCase();
    if (rawPass) {
      const hash = bcrypt.hashSync(rawPass, 10);
      updateStmt.run(hash, s.id);
    }
  }
}

// Seed the 10 students and default teacher from README
function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) {
    return; // Already seeded
  }

  console.log('Seeding initial data from README dataset...');

  const defaultTeacherPassword = bcrypt.hashSync('teacher123', 10);

  // 1. Insert default teacher
  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, role, student_id, name)
    VALUES (?, ?, ?, ?, ?)
  `);

  const teacherResult = insertUser.run(
    'teacher@portal.edu',
    defaultTeacherPassword,
    'teacher',
    null,
    'Prof. Sarah Vance'
  );
  const teacherId = teacherResult.lastInsertRowid;

  // 2. Sample dataset from README:
  // 101 Aarav 85 90 78
  // 102 Diya 92 88 95
  // 103 Rahul 45 55 60
  // 104 Priya 35 40 38 (Fail - Math 35, English 38)
  // 105 Arjun 76 82 80
  // 106 Ananya 88 91 85
  // 107 Rohan 55 48 52
  // 108 Sneha 95 96 92
  // 109 Karan 30 35 42 (Fail - Math 30, Science 35)
  // 110 Meera 80 75 89
  const sampleStudents = [
    { id: 101, name: 'Aarav', math: 85, science: 90, english: 78, attendance: 94, present: 47, total: 50 },
    { id: 102, name: 'Diya', math: 92, science: 88, english: 95, attendance: 98, present: 49, total: 50 },
    { id: 103, name: 'Rahul', math: 45, science: 55, english: 60, attendance: 84, present: 42, total: 50 },
    { id: 104, name: 'Priya', math: 35, science: 40, english: 38, attendance: 76, present: 38, total: 50 },
    { id: 105, name: 'Arjun', math: 76, science: 82, english: 80, attendance: 90, present: 45, total: 50 },
    { id: 106, name: 'Ananya', math: 88, science: 91, english: 85, attendance: 92, present: 46, total: 50 },
    { id: 107, name: 'Rohan', math: 55, science: 48, english: 52, attendance: 86, present: 43, total: 50 },
    { id: 108, name: 'Sneha', math: 95, science: 96, english: 92, attendance: 99, present: 49, total: 50 },
    { id: 109, name: 'Karan', math: 30, science: 35, english: 42, attendance: 72, present: 36, total: 50 },
    { id: 110, name: 'Meera', math: 80, science: 75, english: 89, attendance: 92, present: 46, total: 50 }
  ];

  const insertMarks = db.prepare(`
    INSERT INTO marks (student_id, subject, marks, uploaded_by, date)
    VALUES (?, ?, ?, ?, CURRENT_DATE)
  `);

  const insertAttendance = db.prepare(`
    INSERT INTO attendance (student_id, period, attendance_percentage, present_days, total_days, notes, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const s of sampleStudents) {
    const email = `${s.name.toLowerCase()}@student.edu`;
    const studentPass = s.name.substring(0, 4).toUpperCase();
    const studentPassHash = bcrypt.hashSync(studentPass, 10);
    insertUser.run(email, studentPassHash, 'student', s.id, s.name);

    insertMarks.run(s.id, 'Mathematics', s.math, teacherId);
    insertMarks.run(s.id, 'Science', s.science, teacherId);
    insertMarks.run(s.id, 'English', s.english, teacherId);

    insertAttendance.run(
      s.id,
      'Current Semester',
      s.attendance,
      s.present,
      s.total,
      s.attendance >= 85 ? 'Consistent Attendance' : 'Attendance Warning',
      teacherId
    );
  }

  console.log('Seed completed successfully.');
}

// User helper methods
function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
}

function getUserById(id) {
  return db.prepare('SELECT id, email, role, student_id, name, created_at FROM users WHERE id = ?').get(id);
}

function getUserByStudentId(studentId) {
  return db.prepare('SELECT * FROM users WHERE student_id = ?').get(studentId);
}

function getAllStudents() {
  return db.prepare("SELECT student_id, name, email FROM users WHERE role = 'student' ORDER BY student_id ASC").all();
}

// Ensure a student user exists when new student is added by teacher
function ensureStudentUser(studentId, studentName, creatorId) {
  const existing = getUserByStudentId(studentId);
  if (existing) {
    if (studentName && existing.name !== studentName) {
      db.prepare('UPDATE users SET name = ? WHERE student_id = ?').run(studentName, studentId);
    }
    return existing.id;
  }
  const cleanName = studentName || `Student ${studentId}`;
  const email = `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${studentId}@student.edu`;
  const studentPass = cleanName.trim().substring(0, 4).toUpperCase();
  const defaultStudentPassword = bcrypt.hashSync(studentPass, 10);
  const result = db.prepare(`
    INSERT INTO users (email, password_hash, role, student_id, name)
    VALUES (?, ?, 'student', ?, ?)
  `).run(email, defaultStudentPassword, studentId, cleanName);
  return result.lastInsertRowid;
}

// Marks helper methods
function getStudentMarksRecord(studentId) {
  const student = getUserByStudentId(studentId);
  const rows = db.prepare('SELECT subject, marks, date, updated_at FROM marks WHERE student_id = ?').all(studentId);
  
  const subjects = {};
  let total = 0;
  let count = 0;
  let allAbove40 = true;

  for (const r of rows) {
    subjects[r.subject] = r.marks;
    total += r.marks;
    count++;
    if (r.marks < 40) {
      allAbove40 = false;
    }
  }

  // The passing criterion from README: A student must score at least 40 marks in every subject to pass.
  // Must have marks in core subjects (Math, Science, English) or all available subjects
  const hasCoreSubjects = ('Mathematics' in subjects) && ('Science' in subjects) && ('English' in subjects);
  const average = count > 0 ? parseFloat((total / count).toFixed(2)) : 0;
  const result = (count > 0 && allAbove40 && hasCoreSubjects) ? 'Pass' : 'Fail';

  return {
    studentId,
    studentName: student ? student.name : `ID: ${studentId}`,
    email: student ? student.email : null,
    marks: subjects,
    totalMarks: total,
    averageMarks: average,
    subjectCount: count,
    result,
    isPassing: result === 'Pass'
  };
}

function getAllClassMarks() {
  const students = getAllStudents();
  return students.map(s => getStudentMarksRecord(s.student_id));
}

function upsertStudentMark(studentId, subject, marks, uploadedBy) {
  const stmt = db.prepare(`
    INSERT INTO marks (student_id, subject, marks, uploaded_by, date, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_DATE, CURRENT_TIMESTAMP)
    ON CONFLICT(student_id, subject) DO UPDATE SET
      marks = excluded.marks,
      uploaded_by = excluded.uploaded_by,
      updated_at = CURRENT_TIMESTAMP
  `);
  return stmt.run(studentId, subject, marks, uploadedBy);
}

function deleteStudent(studentId) {
  db.prepare('DELETE FROM marks WHERE student_id = ?').run(studentId);
  db.prepare('DELETE FROM attendance WHERE student_id = ?').run(studentId);
  db.prepare('DELETE FROM users WHERE student_id = ?').run(studentId);
}

// Attendance helpers
function getStudentAttendance(studentId) {
  return db.prepare('SELECT * FROM attendance WHERE student_id = ? ORDER BY id DESC').all(studentId);
}

function getAllAttendance() {
  const students = getAllStudents();
  return students.map(s => {
    const records = getStudentAttendance(s.student_id);
    const latest = records[0] || {
      attendance_percentage: 0,
      present_days: 0,
      total_days: 0,
      period: 'Overall',
      notes: 'No records'
    };
    return {
      student_id: s.student_id,
      name: s.name,
      email: s.email,
      ...latest
    };
  });
}

function upsertAttendance(studentId, period, percentage, presentDays, totalDays, notes, uploadedBy) {
  const stmt = db.prepare(`
    INSERT INTO attendance (student_id, period, attendance_percentage, present_days, total_days, notes, uploaded_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(student_id, period) DO UPDATE SET
      attendance_percentage = excluded.attendance_percentage,
      present_days = excluded.present_days,
      total_days = excluded.total_days,
      notes = excluded.notes,
      uploaded_by = excluded.uploaded_by,
      updated_at = CURRENT_TIMESTAMP
  `);
  return stmt.run(studentId, period, percentage, presentDays || 0, totalDays || 0, notes || '', uploadedBy);
}

module.exports = {
  db,
  initDatabase,
  getUserByEmail,
  getUserById,
  getUserByStudentId,
  getAllStudents,
  ensureStudentUser,
  getStudentMarksRecord,
  getAllClassMarks,
  upsertStudentMark,
  deleteStudent,
  getStudentAttendance,
  getAllAttendance,
  upsertAttendance
};
