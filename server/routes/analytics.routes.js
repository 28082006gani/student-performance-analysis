const express = require('express');
const router = express.Router();
const { requireTeacher, requireStudent } = require('../auth');
const analytics = require('../analytics');
const dbHelper = require('../db');

// GET /api/analytics/dashboard - Teacher only
router.get('/analytics/dashboard', requireTeacher, (req, res) => {
  const data = analytics.calculateClassAnalytics();
  res.json({ success: true, ...data });
});

// GET /api/student/analytics - Student only
router.get('/student/analytics', requireStudent, (req, res) => {
  const studentId = req.user.studentId;
  const student = dbHelper.getStudentMarksRecord(studentId);
  const classAnalytics = analytics.calculateClassAnalytics();

  // Personal insights
  const insights = [];
  const subjects = ['Mathematics', 'Science', 'English'];

  let personalStrengths = [];
  let personalWeaknesses = [];

  subjects.forEach(sub => {
    const mark = student.marks[sub];
    const classAvg = classAnalytics.subjectStats[sub] ? classAnalytics.subjectStats[sub].average : 0;
    if (typeof mark === 'number') {
      if (mark < 40) {
        personalWeaknesses.push(`${sub} (${mark} - Below passing threshold 40)`);
      } else if (mark >= classAvg) {
        personalStrengths.push(`${sub} (${mark} vs Class Avg ${classAvg})`);
      } else {
        personalWeaknesses.push(`${sub} (${mark} - Below class average ${classAvg})`);
      }
    }
  });

  if (personalStrengths.length > 0) {
    insights.push({
      type: 'success',
      title: 'Academic Strengths',
      text: `You excelled above the class benchmark in: ${personalStrengths.join(', ')}.`
    });
  }

  if (personalWeaknesses.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Growth Opportunities',
      text: `Focused practice recommended in: ${personalWeaknesses.join(', ')}.`
    });
  }

  if (student.result === 'Pass') {
    insights.push({
      type: 'info',
      title: 'Status: Good Standing',
      text: 'You satisfied the requirement of scoring at least 40 marks in every subject.'
    });
  } else {
    insights.push({
      type: 'danger',
      title: 'Status: Action Required',
      text: 'One or more subjects scored below 40 marks. Please consult your instructor for remedial support.'
    });
  }

  res.json({
    success: true,
    student,
    benchmarks: {
      classAverage: classAnalytics.overallAverage,
      subjectStats: classAnalytics.subjectStats
    },
    insights
  });
});

module.exports = router;
