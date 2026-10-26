/**
 * STUDENT DASHBOARD LOGIC
 */

// Verify Student role access strictly
if (!api.requireRole('student', '/student/login')) {
  // Redirect handled by requireRole
}

let benchmarkChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  setupUserHeader();
  loadStudentData();
  loadStudentAttendance();
  loadStudentAnalytics();

  document.getElementById('btn-student-logout').addEventListener('click', () => {
    api.logout('/');
  });
});

function setupUserHeader() {
  const user = api.getUser();
  if (user) {
    document.getElementById('student-name-display').textContent = user.name || 'Student';
    document.getElementById('student-id-badge').textContent = `ID: #${user.studentId || '--'}`;
    document.getElementById('student-email-display').textContent = user.email || 'student@portal.edu';
  }
}

async function loadStudentData() {
  try {
    const data = await api.request('/api/student/marks');
    const student = data.student;
    const benchmark = data.benchmark;

    if (!student) {
      window.showToast('No marks record found for your account', 'warning');
      return;
    }

    renderResultBanner(student);
    renderSubjectCards(student, benchmark);
    renderBenchmarkChart(student, benchmark);

  } catch (err) {
    console.error('Failed to load student data:', err);
    window.showToast('Failed to load academic data: ' + err.message, 'error');
  }
}

// Render Result Status Banner
function renderResultBanner(student) {
  const banner = document.getElementById('result-status-banner');
  const isPass = student.result === 'Pass';

  if (isPass) {
    banner.style.borderLeft = '6px solid var(--accent-emerald)';
    banner.style.background = 'rgba(16, 185, 129, 0.08)';
    banner.innerHTML = `
      <div>
        <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.35rem;">
          <span class="badge badge-pass" style="font-size:0.88rem; padding:0.35rem 0.8rem;">✓ Academic Status: Passed</span>
          <span style="font-size:0.82rem; color:var(--text-muted);">Criteria: ≥ 40 marks in all subjects</span>
        </div>
        <p style="font-size:0.92rem; color:#fff;">
          Congratulations! You have successfully passed all course requirements for this semester.
        </p>
      </div>
      <div style="display:flex; gap:1.5rem; text-align:right;">
        <div>
          <div style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase;">Total Marks</div>
          <div style="font-size:1.8rem; font-weight:800; font-family:var(--font-heading); color:#fff;">${student.totalMarks} <span style="font-size:0.9rem; color:var(--text-dim);">/ 300</span></div>
        </div>
        <div>
          <div style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase;">Average Marks</div>
          <div style="font-size:1.8rem; font-weight:800; font-family:var(--font-heading); color:var(--accent-emerald);">${student.averageMarks}%</div>
        </div>
      </div>
    `;
  } else {
    banner.style.borderLeft = '6px solid var(--accent-rose)';
    banner.style.background = 'rgba(244, 63, 94, 0.08)';
    banner.innerHTML = `
      <div>
        <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.35rem;">
          <span class="badge badge-fail" style="font-size:0.88rem; padding:0.35rem 0.8rem;">⚠️ Academic Status: Action Required</span>
          <span style="font-size:0.82rem; color:var(--text-muted);">Criteria: ≥ 40 marks in all subjects</span>
        </div>
        <p style="font-size:0.92rem; color:#fff;">
          You scored below 40 marks in one or more subjects. Please contact your instructor for remediation.
        </p>
      </div>
      <div style="display:flex; gap:1.5rem; text-align:right;">
        <div>
          <div style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase;">Total Marks</div>
          <div style="font-size:1.8rem; font-weight:800; font-family:var(--font-heading); color:#fff;">${student.totalMarks} <span style="font-size:0.9rem; color:var(--text-dim);">/ 300</span></div>
        </div>
        <div>
          <div style="font-size:0.75rem; color:var(--text-dim); text-transform:uppercase;">Average Marks</div>
          <div style="font-size:1.8rem; font-weight:800; font-family:var(--font-heading); color:var(--accent-rose);">${student.averageMarks}%</div>
        </div>
      </div>
    `;
  }
}

// Render Individual Subject Cards
function renderSubjectCards(student, benchmark) {
  const container = document.getElementById('subject-cards-container');
  const subjects = ['Mathematics', 'Science', 'English'];

  const subjectIcons = {
    Mathematics: '📐',
    Science: '🔬',
    English: '📖'
  };

  container.innerHTML = subjects.map(sub => {
    const mark = student.marks[sub] !== undefined ? student.marks[sub] : 0;
    const isSubjectPass = mark >= 40;
    const classAvg = benchmark.subjectAverages[sub] || 0;
    const diff = (mark - classAvg).toFixed(1);
    const diffText = diff >= 0 ? `+${diff}% vs class avg` : `${diff}% vs class avg`;
    const diffColor = diff >= 0 ? 'var(--accent-emerald)' : '#fb7185';

    const barColor = isSubjectPass ? 'linear-gradient(90deg, #00f0ff, #10b981)' : 'linear-gradient(90deg, #f43f5e, #e11d48)';

    return `
      <div class="torch-target subject-card">
        <div>
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.75rem;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="font-size:1.4rem;">${subjectIcons[sub] || '📚'}</span>
              <h3 style="font-size:1.15rem;">${sub}</h3>
            </div>
            ${isSubjectPass 
              ? '<span class="badge badge-pass">Pass (≥40)</span>' 
              : '<span class="badge badge-fail">Below 40</span>'}
          </div>

          <div style="display:flex; align-items:baseline; gap:0.35rem; margin:0.5rem 0;">
            <span style="font-size:2.4rem; font-weight:800; font-family:var(--font-heading); color:#fff;">${mark}</span>
            <span style="color:var(--text-dim); font-size:1rem;">/ 100</span>
          </div>

          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" style="width: ${mark}%; background: ${barColor};"></div>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; margin-top:0.75rem; padding-top:0.6rem; border-top:1px solid var(--border-subtle);">
          <span style="color:var(--text-dim);">Class Average: ${classAvg}%</span>
          <span style="color: ${diffColor}; font-weight:600;">${diffText}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Render Benchmark Comparison Chart
function renderBenchmarkChart(student, benchmark) {
  const ctx = document.getElementById('chart-student-benchmark').getContext('2d');
  const subjects = ['Mathematics', 'Science', 'English'];

  const studentMarks = subjects.map(s => student.marks[s] || 0);
  const classAverages = subjects.map(s => benchmark.subjectAverages[s] || 0);

  if (benchmarkChartInstance) benchmarkChartInstance.destroy();

  benchmarkChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: subjects,
      datasets: [
        {
          label: 'Your Score',
          data: studentMarks,
          backgroundColor: 'rgba(0, 240, 255, 0.65)',
          borderColor: '#00f0ff',
          borderWidth: 2,
          borderRadius: 6
        },
        {
          label: 'Class Benchmark Average',
          data: classAverages,
          backgroundColor: 'rgba(148, 163, 184, 0.3)',
          borderColor: '#94a3b8',
          borderWidth: 1.5,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#94a3b8', font: { size: 12 } }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { weight: '600' } }
        }
      }
    }
  });
}

// Load Attendance Summary
async function loadStudentAttendance() {
  try {
    const data = await api.request('/api/student/attendance');
    const records = data.attendance || [];
    const latest = records[0] || {
      attendance_percentage: 0,
      present_days: 0,
      total_days: 50,
      notes: 'No records available'
    };

    document.getElementById('att-display-pct').textContent = `${latest.attendance_percentage}%`;
    document.getElementById('att-display-period').textContent = `${latest.period || 'Current Semester'} Performance`;
    document.getElementById('att-display-present').textContent = latest.present_days;
    document.getElementById('att-display-total').textContent = latest.total_days;
    document.getElementById('att-display-notes').innerHTML = `
      <strong>Faculty Remark:</strong> ${latest.notes || 'Consistent class attendance record.'}
    `;

    if (latest.attendance_percentage < 85) {
      document.getElementById('att-display-pct').style.color = '#fbbf24';
    } else {
      document.getElementById('att-display-pct').style.color = 'var(--accent-emerald)';
    }

  } catch (err) {
    console.error('Failed to load student attendance:', err);
  }
}

// Load Personalized Academic Recommendations
async function loadStudentAnalytics() {
  try {
    const data = await api.request('/api/student/analytics');
    const container = document.getElementById('student-insights-container');
    const insights = data.insights || [];

    if (insights.length === 0) {
      container.innerHTML = `<p style="color:var(--text-dim);">No special recommendations generated.</p>`;
      return;
    }

    container.innerHTML = insights.map(i => `
      <div class="insight-card insight-${i.type} torch-target">
        <div class="insight-icon" style="font-size:1.35rem;">
          ${i.type === 'danger' ? '⚠️' : i.type === 'warning' ? '💡' : i.type === 'success' ? '🌟' : 'ℹ️'}
        </div>
        <div>
          <h4 style="font-size:0.98rem; margin-bottom:0.25rem;">${i.title}</h4>
          <p style="font-size:0.86rem; color:var(--text-muted); line-height:1.5;">${i.text}</p>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Failed to load student insights:', err);
  }
}
