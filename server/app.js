const express = require('express');
const path = require('path');
const dbHelper = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize SQLite database
dbHelper.initDatabase();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// API routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api', require('./routes/marks.routes'));
app.use('/api', require('./routes/attendance.routes'));
app.use('/api', require('./routes/analytics.routes'));

// Clean URL routing for client-side pages
app.get('/teacher/login', (req, res) => {
  res.sendFile(path.join(publicPath, 'teacher-login.html'));
});

app.get('/student/login', (req, res) => {
  res.sendFile(path.join(publicPath, 'student-login.html'));
});

app.get('/teacher/dashboard', (req, res) => {
  res.sendFile(path.join(publicPath, 'teacher-dashboard.html'));
});

app.get('/student/dashboard', (req, res) => {
  res.sendFile(path.join(publicPath, 'student-dashboard.html'));
});

// Fallback to index.html for unknown GET requests (Express 5 compatible)
app.use((req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Start server
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Student Performance Portal running at http://localhost:${PORT}`);
    console.log(`🔦 Flashlite UI Theme Active with Spotlight Dynamic Tracking`);
    console.log(`👨‍🏫 Teacher Portal: http://localhost:${PORT}/teacher/login`);
    console.log(`🎓 Student Portal: http://localhost:${PORT}/student/login`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const fallbackPort = Number(PORT) + 1;
      console.log(`Port ${PORT} in use, retrying on port ${fallbackPort}...`);
      app.listen(fallbackPort, () => {
        console.log(`🚀 Student Performance Portal running at http://localhost:${fallbackPort}`);
      });
    } else {
      console.error('Server error:', err);
    }
  });
}

module.exports = app;
