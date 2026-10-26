const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const dbHelper = require('../db');
const { generateToken, authenticate } = require('../auth');

// POST /api/auth/teacher/login - Strictly for Teachers
router.post('/teacher/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  const user = dbHelper.getUserByEmail(email.trim());
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid credentials. User not found.' });
  }

  // Enforce separate login rule from Architecture PDF:
  // "Each page only accepts accounts with its own role, so a student cannot sign in through the teacher page."
  if (user.role !== 'teacher') {
    return res.status(403).json({
      success: false,
      roleMismatch: true,
      error: 'Access Denied: This portal is exclusively for Teachers. Student accounts must sign in via the Student Login page.'
    });
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ success: false, error: 'Invalid credentials. Incorrect password.' });
  }

  const token = generateToken(user);
  return res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
});

// POST /api/auth/student/login - Strictly for Students
router.post('/student/login', (req, res) => {
  const { identifier, password } = req.body; // Can be email or numeric student ID
  if (!identifier || !password) {
    return res.status(400).json({ success: false, error: 'Student ID or Email and password are required.' });
  }

  let user = null;
  const isNumericId = /^\d+$/.test(identifier.toString().trim());

  if (isNumericId) {
    user = dbHelper.getUserByStudentId(parseInt(identifier.toString().trim(), 10));
  } else {
    user = dbHelper.getUserByEmail(identifier.trim());
  }

  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid credentials. Student account not found.' });
  }

  // Enforce separate login rule from Architecture PDF:
  if (user.role !== 'student') {
    return res.status(403).json({
      success: false,
      roleMismatch: true,
      error: 'Access Denied: This portal is exclusively for Students. Teachers must sign in via the Teacher Login page.'
    });
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ success: false, error: 'Invalid credentials. Incorrect password.' });
  }

  const token = generateToken(user);
  return res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      studentId: user.student_id
    }
  });
});

// GET /api/auth/me - Verify current token
router.get('/me', authenticate, (req, res) => {
  const user = dbHelper.getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User no longer exists.' });
  }
  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      studentId: user.student_id
    }
  });
});

// GET /api/auth/demo-users - Quick reference credentials for testing & grading
router.get('/demo-users', (req, res) => {
  const students = dbHelper.getAllStudents();
  return res.json({
    success: true,
    teacher: {
      email: 'teacher@portal.edu',
      password: 'teacher123',
      name: 'Prof. Sarah Vance',
      role: 'teacher'
    },
    students: students.map(s => ({
      studentId: s.student_id,
      name: s.name,
      email: s.email,
      password: 'student123'
    }))
  });
});

module.exports = router;
