const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const dbHelper = require('../db');
const { requireTeacher, requireStudent } = require('../auth');
const analytics = require('../analytics');

// Multer memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// ==========================================
// TEACHER ENDPOINTS (Role-checked strictly)
// ==========================================

// GET /api/marks - Fetch all class marks with calculations
router.get('/marks', requireTeacher, (req, res) => {
  const classMarks = dbHelper.getAllClassMarks();
  res.json({ success: true, count: classMarks.length, students: classMarks });
});

// POST /api/marks - Manual entry / update of a student's marks
router.post('/marks', requireTeacher, (req, res) => {
  const { studentId, studentName, mathematics, science, english } = req.body;

  const idNum = parseInt(studentId, 10);
  if (isNaN(idNum) || idNum <= 0) {
    return res.status(400).json({ success: false, error: 'Valid positive Student ID is required.' });
  }

  const subjectsToCheck = [
    { name: 'Mathematics', val: mathematics },
    { name: 'Science', val: science },
    { name: 'English', val: english }
  ];

  for (const s of subjectsToCheck) {
    if (s.val !== undefined && s.val !== null && s.val !== '') {
      const num = Number(s.val);
      if (isNaN(num) || num < 0 || num > 100) {
        return res.status(400).json({
          success: false,
          error: `Marks for ${s.name} must be a number between 0 and 100. Received: ${s.val}`
        });
      }
    }
  }

  // Ensure user account exists
  dbHelper.ensureStudentUser(idNum, studentName, req.user.id);

  // Save marks
  for (const s of subjectsToCheck) {
    if (s.val !== undefined && s.val !== null && s.val !== '') {
      dbHelper.upsertStudentMark(idNum, s.name, Number(s.val), req.user.id);
    }
  }

  // Retrieve calculated record
  const updatedRecord = dbHelper.getStudentMarksRecord(idNum);

  return res.json({
    success: true,
    message: `Marks recorded successfully for Student #${idNum}`,
    student: updatedRecord
  });
});

// POST /api/marks/upload - Bulk Excel / CSV upload
router.post('/marks/upload', requireTeacher, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Please select an Excel (.xlsx, .xls) or CSV file to upload.' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Uploaded file is empty or contains no readable rows.' });
    }

    const imported = [];
    const errors = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 2; // considering header as row 1

      // Flexible column mapping
      const studentIdRaw = row['Student ID'] || row['student_id'] || row['StudentID'] || row['ID'] || row['Id'];
      const studentNameRaw = row['Student Name'] || row['student_name'] || row['Name'] || row['Student'];
      const mathRaw = row['Mathematics'] || row['math'] || row['Math'] || row['Maths'];
      const scienceRaw = row['Science'] || row['science'];
      const englishRaw = row['English'] || row['english'];

      const studentId = parseInt(studentIdRaw, 10);
      if (isNaN(studentId) || studentId <= 0) {
        errors.push(`Row ${rowNum}: Invalid or missing Student ID.`);
        return;
      }

      const math = Number(mathRaw);
      const sci = Number(scienceRaw);
      const eng = Number(englishRaw);

      if (isNaN(math) || math < 0 || math > 100) {
        errors.push(`Row ${rowNum} (ID: ${studentId}): Mathematics mark must be between 0 and 100.`);
        return;
      }
      if (isNaN(sci) || sci < 0 || sci > 100) {
        errors.push(`Row ${rowNum} (ID: ${studentId}): Science mark must be between 0 and 100.`);
        return;
      }
      if (isNaN(eng) || eng < 0 || eng > 100) {
        errors.push(`Row ${rowNum} (ID: ${studentId}): English mark must be between 0 and 100.`);
        return;
      }

      // Valid row: ensure student and upsert
      dbHelper.ensureStudentUser(studentId, studentNameRaw ? String(studentNameRaw).trim() : null, req.user.id);
      dbHelper.upsertStudentMark(studentId, 'Mathematics', math, req.user.id);
      dbHelper.upsertStudentMark(studentId, 'Science', sci, req.user.id);
      dbHelper.upsertStudentMark(studentId, 'English', eng, req.user.id);

      imported.push({ studentId, studentName: studentNameRaw, math, sci, eng });
    });

    const currentMarks = dbHelper.getAllClassMarks();

    return res.json({
      success: true,
      importedCount: imported.length,
      errorsCount: errors.length,
      errors,
      students: currentMarks,
      message: `Successfully processed ${imported.length} student record(s).`
    });
  } catch (err) {
    console.error('File parse error:', err);
    return res.status(500).json({ success: false, error: 'Failed to parse spreadsheet: ' + err.message });
  }
});

// GET /api/marks/export/excel - Export analysis workbook (.xlsx)
router.get('/marks/export/excel', requireTeacher, (req, res) => {
  try {
    const buffer = analytics.generateExcelBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Student_Performance_Analysis.xlsx"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to generate Excel export: ' + err.message });
  }
});

// GET /api/marks/export/csv - Export CSV
router.get('/marks/export/csv', requireTeacher, (req, res) => {
  try {
    const csvContent = analytics.generateCsvString();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Student_Performance_Analysis.csv"');
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to generate CSV export: ' + err.message });
  }
});

// GET /api/marks/template - Download upload template
router.get('/marks/template', requireTeacher, (req, res) => {
  const sample = [
    { 'Student ID': 111, 'Student Name': 'John Doe', 'Mathematics': 85, 'Science': 78, 'English': 92 },
    { 'Student ID': 112, 'Student Name': 'Jane Smith', 'Mathematics': 62, 'Science': 68, 'English': 74 }
  ];
  const ws = xlsx.utils.json_to_sheet(sample);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Template');
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="Student_Marks_Upload_Template.xlsx"');
  res.send(buffer);
});

// DELETE /api/marks/:studentId - Teacher can remove a student record
router.delete('/marks/:studentId', requireTeacher, (req, res) => {
  const idNum = parseInt(req.params.studentId, 10);
  if (isNaN(idNum)) {
    return res.status(400).json({ success: false, error: 'Invalid Student ID.' });
  }

  dbHelper.deleteStudent(idNum);
  return res.json({ success: true, message: `Student #${idNum} and associated records deleted.` });
});

// ==========================================
// STUDENT ENDPOINTS (Strictly self-only)
// ==========================================

// GET /api/student/marks - Strictly fetch the logged-in student's marks only
router.get('/student/marks', requireStudent, (req, res) => {
  const studentId = req.user.studentId;
  const record = dbHelper.getStudentMarksRecord(studentId);

  // Also calculate class average benchmark so student can see comparison safely without seeing other students' individual marks
  const classAnalytics = analytics.calculateClassAnalytics();
  const benchmark = {
    classAverage: classAnalytics.overallAverage,
    subjectAverages: {
      Mathematics: classAnalytics.subjectStats.Mathematics ? classAnalytics.subjectStats.Mathematics.average : 0,
      Science: classAnalytics.subjectStats.Science ? classAnalytics.subjectStats.Science.average : 0,
      English: classAnalytics.subjectStats.English ? classAnalytics.subjectStats.English.average : 0
    }
  };

  res.json({
    success: true,
    student: record,
    benchmark
  });
});

module.exports = router;
