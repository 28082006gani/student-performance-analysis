const express = require('express');
const router = express.Router();
const dbHelper = require('../db');
const { requireTeacher, requireStudent } = require('../auth');

// GET /api/attendance - Teacher only
router.get('/attendance', requireTeacher, (req, res) => {
  try {
    const all = dbHelper.getAllAttendance();
    res.json({ success: true, attendance: all });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to retrieve attendance: ' + err.message });
  }
});

// POST /api/attendance - Teacher only
router.post('/attendance', requireTeacher, (req, res) => {
  try {
    const { studentId, period, percentage, presentDays, totalDays, notes } = req.body;

    const idNum = parseInt(studentId, 10);
    if (isNaN(idNum) || idNum <= 0) {
      return res.status(400).json({ success: false, error: 'Valid Student ID is required.' });
    }

    const pct = parseFloat(percentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ success: false, error: 'Attendance percentage must be between 0 and 100.' });
    }

    // Fix: Handle presentDays === 0 properly without treating 0 as falsy
    const hasPresent = presentDays !== undefined && presentDays !== null && presentDays !== '';
    const parsedPresent = hasPresent ? parseInt(presentDays, 10) : Math.round((pct / 100) * 50);

    const hasTotal = totalDays !== undefined && totalDays !== null && totalDays !== '';
    const parsedTotal = hasTotal ? parseInt(totalDays, 10) : 50;

    if (isNaN(parsedPresent) || parsedPresent < 0) {
      return res.status(400).json({ success: false, error: 'Present days must be a non-negative number.' });
    }

    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      return res.status(400).json({ success: false, error: 'Total days must be a positive number.' });
    }

    if (parsedPresent > parsedTotal) {
      return res.status(400).json({ success: false, error: 'Present days cannot exceed total days.' });
    }

    dbHelper.upsertAttendance(
      idNum,
      period || 'Current Semester',
      pct,
      parsedPresent,
      parsedTotal,
      notes || '',
      req.user.id
    );

    res.json({ success: true, message: `Attendance updated for Student #${idNum}` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update attendance: ' + err.message });
  }
});

// GET /api/student/attendance - Student only: strictly own attendance
router.get('/student/attendance', requireStudent, (req, res) => {
  try {
    if (!req.user || !req.user.studentId) {
      return res.status(400).json({ success: false, error: 'Student ID not found in session.' });
    }

    const records = dbHelper.getStudentAttendance(req.user.studentId);
    res.json({
      success: true,
      studentId: req.user.studentId,
      attendance: records
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to retrieve personal attendance: ' + err.message });
  }
});

module.exports = router;
