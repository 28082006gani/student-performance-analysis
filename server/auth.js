const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dbHelper = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'flashlite-student-portal-super-secret-key-2026';

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      studentId: user.student_id,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Extract token from Authorization header or query param
function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  if (req.query && req.query.token) {
    return req.query.token;
  }
  return null;
}

// Middleware: Authenticate any user
function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Session expired or invalid token. Please log in again.' });
  }
}

// Middleware: Enforce Teacher role strictly
function requireTeacher(req, res, next) {
  authenticate(req, res, () => {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Teacher role required for this action.'
      });
    }
    next();
  });
}

// Middleware: Enforce Student role strictly
function requireStudent(req, res, next) {
  authenticate(req, res, () => {
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Student role required for this action.'
      });
    }
    if (!req.user.studentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID not associated with this account.'
      });
    }
    next();
  });
}

module.exports = {
  JWT_SECRET,
  generateToken,
  authenticate,
  requireTeacher,
  requireStudent
};
