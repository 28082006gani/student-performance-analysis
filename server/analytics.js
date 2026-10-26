const xlsx = require('xlsx');
const dbHelper = require('./db');

function calculateClassAnalytics() {
  const classMarks = dbHelper.getAllClassMarks();
  const totalStudents = classMarks.length;

  if (totalStudents === 0) {
    return {
      totalStudents: 0,
      overallAverage: 0,
      highestScore: { marks: 0, subject: 'N/A', studentName: 'N/A', studentId: null },
      lowestScore: { marks: 0, subject: 'N/A', studentName: 'N/A', studentId: null },
      studentsPassed: 0,
      studentsFailed: 0,
      passPercentage: 0,
      subjectStats: {},
      students: [],
      topPerformers: [],
      needsSupport: [],
      recommendations: []
    };
  }

  let totalAllMarks = 0;
  let totalMarkCount = 0;
  let highestScore = { marks: -Infinity, subject: '', studentName: '', studentId: null };
  let lowestScore = { marks: Infinity, subject: '', studentName: '', studentId: null };

  const subjects = ['Mathematics', 'Science', 'English'];
  const subjectAggregates = {};
  subjects.forEach(sub => {
    subjectAggregates[sub] = {
      total: 0,
      count: 0,
      highest: -Infinity,
      highestStudent: '',
      lowest: Infinity,
      lowestStudent: '',
      passCount: 0
    };
  });

  let studentsPassed = 0;
  let studentsFailed = 0;

  classMarks.forEach(s => {
    if (s.result === 'Pass') {
      studentsPassed++;
    } else {
      studentsFailed++;
    }

    subjects.forEach(sub => {
      const mark = s.marks[sub];
      if (typeof mark === 'number') {
        totalAllMarks += mark;
        totalMarkCount++;

        // Track overall highest
        if (mark > highestScore.marks) {
          highestScore = { marks: mark, subject: sub, studentName: s.studentName, studentId: s.studentId };
        }
        // Track overall lowest
        if (mark < lowestScore.marks) {
          lowestScore = { marks: mark, subject: sub, studentName: s.studentName, studentId: s.studentId };
        }

        // Subject level stats
        const agg = subjectAggregates[sub];
        agg.total += mark;
        agg.count++;
        if (mark >= 40) agg.passCount++;

        if (mark > agg.highest) {
          agg.highest = mark;
          agg.highestStudent = s.studentName;
        }
        if (mark < agg.lowest) {
          agg.lowest = mark;
          agg.lowestStudent = s.studentName;
        }
      }
    });
  });

  const overallAverage = totalMarkCount > 0 ? parseFloat((totalAllMarks / totalMarkCount).toFixed(2)) : 0;
  const passPercentage = totalStudents > 0 ? parseFloat(((studentsPassed / totalStudents) * 100).toFixed(2)) : 0;

  const subjectStats = {};
  subjects.forEach(sub => {
    const agg = subjectAggregates[sub];
    subjectStats[sub] = {
      subject: sub,
      average: agg.count > 0 ? parseFloat((agg.total / agg.count).toFixed(2)) : 0,
      highest: agg.highest === -Infinity ? 0 : agg.highest,
      highestStudent: agg.highestStudent,
      lowest: agg.lowest === Infinity ? 0 : agg.lowest,
      lowestStudent: agg.lowestStudent,
      passRate: agg.count > 0 ? parseFloat(((agg.passCount / agg.count) * 100).toFixed(1)) : 0
    };
  });

  // Sort students by average descending for rankings
  const rankedStudents = [...classMarks].sort((a, b) => b.averageMarks - a.averageMarks);

  // Top performers: average >= 80% & passed
  const topPerformers = rankedStudents.filter(s => s.result === 'Pass' && s.averageMarks >= 80);

  // Needs support: failed OR average < 50%
  const needsSupport = rankedStudents.filter(s => s.result === 'Fail' || s.averageMarks < 50);

  // Automated recommendations based on data findings (matching README page 4 & 5)
  const recommendations = [];

  // Subject comparison finding
  const sortedSubjects = Object.values(subjectStats).sort((a, b) => a.average - b.average);
  if (sortedSubjects.length > 0) {
    const lowestSub = sortedSubjects[0];
    const highestSub = sortedSubjects[sortedSubjects.length - 1];
    recommendations.push({
      type: 'warning',
      title: `${lowestSub.subject} Requires Targeted Interventions`,
      text: `${lowestSub.subject} recorded the lowest class average (${lowestSub.average}%), compared to ${highestSub.subject} (${highestSub.average}%). Consider remedial tutorials and problem-solving workshops.`
    });
  }

  // Struggling students finding
  if (needsSupport.length > 0) {
    const studentNames = needsSupport.map(s => s.studentName).join(', ');
    recommendations.push({
      type: 'danger',
      title: `Academic Support for ${needsSupport.length} Student(s)`,
      text: `${studentNames} scored below the passing threshold of 40 in one or more subjects. Schedule one-on-one mentoring and diagnostic review.`
    });
  }

  // High performers finding
  if (topPerformers.length > 0) {
    const topNames = topPerformers.slice(0, 3).map(s => `${s.studentName} (${s.averageMarks}%)`).join(', ');
    recommendations.push({
      type: 'success',
      title: 'Advanced Enrichment for High Achievers',
      text: `Top performing students (${topNames}) demonstrated mastery above 80%. Provide advanced exploratory projects to maintain momentum.`
    });
  }

  recommendations.push({
    type: 'info',
    title: 'Regular Performance Tracking',
    text: 'Monitor student performance regularly through continuous assessments to identify learning gaps early.'
  });

  return {
    totalStudents,
    overallAverage,
    highestScore: highestScore.marks === -Infinity ? { marks: 0, subject: 'N/A', studentName: 'N/A' } : highestScore,
    lowestScore: lowestScore.marks === Infinity ? { marks: 0, subject: 'N/A', studentName: 'N/A' } : lowestScore,
    studentsPassed,
    studentsFailed,
    passPercentage,
    subjectStats,
    students: rankedStudents,
    topPerformers,
    needsSupport,
    recommendations
  };
}

// Generate an Excel workbook (.xlsx) matching the structure described in README.pdf
function generateExcelBuffer() {
  const analytics = calculateClassAnalytics();
  const classMarks = dbHelper.getAllClassMarks();

  // Sheet 1: Student Dataset
  const studentDataRows = classMarks.map(s => ({
    'Student ID': s.studentId,
    'Student Name': s.studentName,
    'Mathematics': s.marks.Mathematics || 0,
    'Science': s.marks.Science || 0,
    'English': s.marks.English || 0,
    'Total Marks': s.totalMarks,
    'Average Marks': s.averageMarks,
    'Result': s.result
  }));

  const wsStudents = xlsx.utils.json_to_sheet(studentDataRows);

  // Sheet 2: Subject Performance
  const subjectRows = Object.values(analytics.subjectStats).map(sub => ({
    'Subject': sub.subject,
    'Average Marks': sub.average,
    'Highest Score': sub.highest,
    'Highest Scorer': sub.highestStudent,
    'Lowest Score': sub.lowest,
    'Lowest Scorer': sub.lowestStudent,
    'Pass Rate (%)': `${sub.passRate}%`
  }));
  const wsSubjects = xlsx.utils.json_to_sheet(subjectRows);

  // Sheet 3: KPI Summary & Findings
  const kpiRows = [
    { 'Metric': 'Total Students', 'Value': analytics.totalStudents },
    { 'Metric': 'Overall Average across all subject marks', 'Value': `${analytics.overallAverage}%` },
    { 'Metric': 'Highest individual subject score', 'Value': `${analytics.highestScore.marks} (${analytics.highestScore.studentName} - ${analytics.highestScore.subject})` },
    { 'Metric': 'Lowest individual subject score', 'Value': `${analytics.lowestScore.marks} (${analytics.lowestScore.studentName} - ${analytics.lowestScore.subject})` },
    { 'Metric': 'Students Passed', 'Value': analytics.studentsPassed },
    { 'Metric': 'Students Failed', 'Value': analytics.studentsFailed },
    { 'Metric': 'Overall Pass Percentage', 'Value': `${analytics.passPercentage}%` },
    { 'Metric': 'Passing Criterion', 'Value': 'At least 40 marks in every subject' }
  ];
  const wsKpi = xlsx.utils.json_to_sheet(kpiRows);

  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, wsStudents, 'Student_Performance');
  xlsx.utils.book_append_sheet(wb, wsSubjects, 'Subject_Averages');
  xlsx.utils.book_append_sheet(wb, wsKpi, 'Dashboard_KPIs');

  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Generate CSV string matching standard spreadsheet import
function generateCsvString() {
  const classMarks = dbHelper.getAllClassMarks();
  const headers = ['Student ID', 'Student Name', 'Mathematics', 'Science', 'English', 'Total Marks', 'Average Marks', 'Result'];
  const lines = [headers.join(',')];

  classMarks.forEach(s => {
    lines.push([
      s.studentId,
      `"${s.studentName}"`,
      s.marks.Mathematics || 0,
      s.marks.Science || 0,
      s.marks.English || 0,
      s.totalMarks,
      s.averageMarks,
      s.result
    ].join(','));
  });

  return lines.join('\n');
}

module.exports = {
  calculateClassAnalytics,
  generateExcelBuffer,
  generateCsvString
};
