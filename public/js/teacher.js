/**
 * TEACHER DASHBOARD LOGIC
 */

// Verify Teacher role access
if (!api.requireRole('teacher', '/teacher/login')) {
  // Redirect initiated by api.requireRole
}

let classStudents = [];
let subjectChartInstance = null;
let passFailChartInstance = null;
let studentAveragesChartInstance = null;

// Modal management
window.openModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
};

window.closeModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
};

// Document ready
document.addEventListener('DOMContentLoaded', () => {
  setupUserHeader();
  setupTabs();
  setupModals();
  setupUploadZone();
  loadDashboardData();
  loadAttendanceData();

  // Search and filter listeners
  document.getElementById('gradebook-search').addEventListener('input', renderGradebookTable);
  document.getElementById('gradebook-filter').addEventListener('change', renderGradebookTable);
  document.getElementById('btn-refresh-gradebook').addEventListener('click', () => {
    loadDashboardData();
    window.showToast('Gradebook refreshed', 'info');
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', () => {
    api.logout('/');
  });
});

function setupUserHeader() {
  const user = api.getUser();
  if (user) {
    document.getElementById('user-display-name').textContent = user.name || 'Faculty Member';
    document.getElementById('user-display-email').textContent = user.email || 'teacher@portal.edu';
  }
}

function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.dataset.tab;
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });
}

function setupModals() {
  // Add marks modal
  document.getElementById('btn-open-add-modal').addEventListener('click', () => {
    document.getElementById('form-save-marks').reset();
    document.getElementById('input-student-id').disabled = false;
    window.openModal('modal-add-marks');
  });

  // Attendance modal
  document.getElementById('btn-open-attendance-modal').addEventListener('click', () => {
    populateAttendanceStudentSelect();
    window.openModal('modal-attendance');
  });

  // Close modals on overlay backdrop click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });

  // Form submit: Save Marks
  document.getElementById('form-save-marks').addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = document.getElementById('input-student-id').value;
    const studentName = document.getElementById('input-student-name').value;
    const mathematics = document.getElementById('input-math').value;
    const science = document.getElementById('input-science').value;
    const english = document.getElementById('input-english').value;

    const btnSubmit = document.getElementById('btn-save-marks-submit');
    btnSubmit.disabled = true;

    try {
      const data = await api.request('/api/marks', {
        method: 'POST',
        body: JSON.stringify({ studentId, studentName, mathematics, science, english })
      });

      window.showToast(data.message || 'Marks saved successfully', 'success');
      window.closeModal('modal-add-marks');
      loadDashboardData();
    } catch (err) {
      window.showToast(err.message || 'Failed to save marks', 'error');
    } finally {
      btnSubmit.disabled = false;
    }
  });

  // Form submit: Save Attendance
  document.getElementById('form-save-attendance').addEventListener('submit', async (e) => {
    e.preventDefault();
    const studentId = document.getElementById('att-student-id').value;
    const percentage = document.getElementById('att-percentage').value;
    const presentDays = document.getElementById('att-present').value;
    const totalDays = document.getElementById('att-total').value;
    const notes = document.getElementById('att-notes').value;

    try {
      const data = await api.request('/api/attendance', {
        method: 'POST',
        body: JSON.stringify({ studentId, percentage, presentDays, totalDays, notes })
      });

      window.showToast(data.message || 'Attendance logged', 'success');
      window.closeModal('modal-attendance');
      loadAttendanceData();
    } catch (err) {
      window.showToast(err.message || 'Failed to save attendance', 'error');
    }
  });
}

function setupUploadZone() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-upload-input');
  const processBtn = document.getElementById('btn-process-upload');
  const statusDiv = document.getElementById('upload-file-status');
  let selectedFile = null;

  document.getElementById('btn-open-upload-modal').addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    processBtn.disabled = true;
    statusDiv.style.display = 'none';
    window.openModal('modal-upload');
  });

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFileSelected(fileInput.files[0]);
    }
  });

  function handleFileSelected(file) {
    selectedFile = file;
    processBtn.disabled = false;
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = `
      <div style="padding:0.75rem; background:rgba(0, 240, 255, 0.08); border:1px solid rgba(0, 240, 255, 0.25); border-radius:8px;">
        📄 <strong>Selected:</strong> ${file.name} (${(file.size / 1024).toFixed(1)} KB)
      </div>
    `;
  }

  processBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    processBtn.disabled = true;
    processBtn.textContent = 'Processing...';

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const data = await api.request('/api/marks/upload', {
        method: 'POST',
        body: formData
      });

      statusDiv.innerHTML = `
        <div style="padding:0.75rem; background:rgba(16, 185, 129, 0.15); border:1px solid #10b981; border-radius:8px; color:#34d399;">
          ✓ ${data.message} ${data.errorsCount > 0 ? `(${data.errorsCount} row warnings)` : ''}
        </div>
      `;
      window.showToast(`Imported ${data.importedCount} student records!`, 'success');
      loadDashboardData();

      setTimeout(() => {
        window.closeModal('modal-upload');
      }, 1400);

    } catch (err) {
      statusDiv.innerHTML = `
        <div style="padding:0.75rem; background:rgba(244, 63, 94, 0.15); border:1px solid #f43f5e; border-radius:8px; color:#fb7185;">
          ✕ Error: ${err.message}
        </div>
      `;
    } finally {
      processBtn.disabled = false;
      processBtn.textContent = 'Process Import';
    }
  });
}

// Fetch all dashboard & analytics data
async function loadDashboardData() {
  try {
    const analytics = await api.request('/api/analytics/dashboard');

    // Update KPIs
    document.getElementById('kpi-total-students').textContent = analytics.totalStudents;
    document.getElementById('tab-student-count').textContent = analytics.totalStudents;
    document.getElementById('kpi-overall-average').textContent = `${analytics.overallAverage}%`;
    document.getElementById('kpi-pass-rate').textContent = `${analytics.passPercentage}%`;
    document.getElementById('kpi-passed-count').textContent = analytics.studentsPassed;
    document.getElementById('kpi-failed-count').textContent = analytics.studentsFailed;

    if (analytics.highestScore) {
      document.getElementById('kpi-highest-score').textContent = analytics.highestScore.marks;
      document.getElementById('kpi-highest-holder').textContent = `${analytics.highestScore.studentName} (${analytics.highestScore.subject})`;
    }

    if (analytics.lowestScore) {
      document.getElementById('kpi-lowest-score').textContent = analytics.lowestScore.marks;
      document.getElementById('kpi-lowest-holder').textContent = `${analytics.lowestScore.studentName} (${analytics.lowestScore.subject})`;
    }

    // Save students and render gradebook
    classStudents = analytics.students || [];
    renderGradebookTable();

    // Render Charts
    renderCharts(analytics);

    // Render Recommendations
    renderRecommendations(analytics.recommendations || []);

  } catch (err) {
    console.error('Failed to load analytics:', err);
    window.showToast('Failed to load dashboard metrics: ' + err.message, 'error');
  }
}

// Render Gradebook Table
function renderGradebookTable() {
  const tbody = document.getElementById('gradebook-tbody');
  const search = document.getElementById('gradebook-search').value.toLowerCase().trim();
  const filter = document.getElementById('gradebook-filter').value;

  const filtered = classStudents.filter(s => {
    const matchesSearch = s.studentName.toLowerCase().includes(search) || String(s.studentId).includes(search);
    const matchesFilter = filter === 'all' || s.result === filter;
    return matchesSearch && matchesFilter;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding: 2.5rem; color: var(--text-dim);">
          No student records matching your query.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const math = s.marks.Mathematics !== undefined ? s.marks.Mathematics : '-';
    const sci = s.marks.Science !== undefined ? s.marks.Science : '-';
    const eng = s.marks.English !== undefined ? s.marks.English : '-';

    const resultBadge = s.result === 'Pass' 
      ? '<span class="badge badge-pass">✓ Pass</span>' 
      : '<span class="badge badge-fail">✕ Fail</span>';

    return `
      <tr>
        <td class="table-num" style="color:var(--accent-cyan); font-weight:700;">#${s.studentId}</td>
        <td>
          <strong>${s.studentName}</strong>
          ${s.email ? `<div style="font-size:0.75rem; color:var(--text-dim);">${s.email}</div>` : ''}
        </td>
        <td class="table-num" style="${math < 40 ? 'color:#fb7185; font-weight:bold;' : ''}">${math}</td>
        <td class="table-num" style="${sci < 40 ? 'color:#fb7185; font-weight:bold;' : ''}">${sci}</td>
        <td class="table-num" style="${eng < 40 ? 'color:#fb7185; font-weight:bold;' : ''}">${eng}</td>
        <td class="table-num" style="font-weight:700;">${s.totalMarks}</td>
        <td class="table-num" style="font-weight:700; color:#fff;">${s.averageMarks}%</td>
        <td>${resultBadge}</td>
        <td>
          <div style="display:flex; gap:0.4rem;">
            <button class="btn btn-secondary btn-sm" onclick="editStudentMarks(${s.studentId})" title="Edit Marks">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteStudentRecord(${s.studentId})" title="Delete Record">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Edit student marks helper
window.editStudentMarks = function (studentId) {
  const student = classStudents.find(s => s.studentId === studentId);
  if (!student) return;

  document.getElementById('input-student-id').value = student.studentId;
  document.getElementById('input-student-id').disabled = true; // Prevent changing ID on edit
  document.getElementById('input-student-name').value = student.studentName;
  document.getElementById('input-math').value = student.marks.Mathematics || '';
  document.getElementById('input-science').value = student.marks.Science || '';
  document.getElementById('input-english').value = student.marks.English || '';

  window.openModal('modal-add-marks');
};

// Delete student record
window.deleteStudentRecord = async function (studentId) {
  if (!confirm(`Are you sure you want to remove Student #${studentId} and all their marks?`)) {
    return;
  }

  try {
    const data = await api.request(`/api/marks/${studentId}`, { method: 'DELETE' });
    window.showToast(data.message || 'Student record deleted', 'info');
    loadDashboardData();
  } catch (err) {
    window.showToast(err.message || 'Failed to delete student', 'error');
  }
};

// Populate student dropdown in attendance modal
function populateAttendanceStudentSelect() {
  const select = document.getElementById('att-student-id');
  select.innerHTML = classStudents.map(s => `
    <option value="${s.studentId}">#${s.studentId} - ${s.studentName}</option>
  `).join('');
}

// Load attendance registry
async function loadAttendanceData() {
  try {
    const data = await api.request('/api/attendance');
    const tbody = document.getElementById('attendance-tbody');

    if (!data.attendance || data.attendance.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-dim);">No attendance records found.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.attendance.map(a => {
      const rate = a.attendance_percentage || 0;
      const isGood = rate >= 85;
      const badge = isGood 
        ? `<span class="badge badge-pass">${rate}% Regular</span>` 
        : `<span class="badge badge-fail">${rate}% Warning</span>`;

      return `
        <tr>
          <td class="table-num" style="color:var(--accent-cyan); font-weight:700;">#${a.student_id}</td>
          <td><strong>${a.name}</strong></td>
          <td>${a.period || 'Current Semester'}</td>
          <td class="table-num">${a.present_days} / ${a.total_days} days</td>
          <td>${badge}</td>
          <td style="color:var(--text-muted); font-size:0.84rem;">${a.notes || 'Normal'}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="quickEditAttendance(${a.student_id}, ${rate}, ${a.present_days}, ${a.total_days}, '${encodeURIComponent(a.notes || '')}')">Update</button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load attendance:', err);
  }
}

window.quickEditAttendance = function (id, pct, present, total, notesEnc) {
  populateAttendanceStudentSelect();
  document.getElementById('att-student-id').value = id;
  document.getElementById('att-percentage').value = pct;
  document.getElementById('att-present').value = present;
  document.getElementById('att-total').value = total;
  document.getElementById('att-notes').value = decodeURIComponent(notesEnc);
  window.openModal('modal-attendance');
};

// Render Insights & Recommendations
function renderRecommendations(recommendations) {
  const container = document.getElementById('insights-container');
  if (recommendations.length === 0) {
    container.innerHTML = `<p style="color:var(--text-dim);">No recommendations generated yet.</p>`;
    return;
  }

  container.innerHTML = recommendations.map(r => `
    <div class="insight-card insight-${r.type} torch-target">
      <div class="insight-icon" style="font-size:1.4rem;">
        ${r.type === 'danger' ? '⚠️' : r.type === 'warning' ? '💡' : r.type === 'success' ? '🌟' : 'ℹ️'}
      </div>
      <div>
        <h4 style="font-size:1rem; margin-bottom:0.25rem;">${r.title}</h4>
        <p style="font-size:0.88rem; color:var(--text-muted); line-height:1.5;">${r.text}</p>
      </div>
    </div>
  `).join('');
}

// Render dynamic Chart.js charts
function renderCharts(analytics) {
  // Chart 1: Subject Averages
  const ctxSubjects = document.getElementById('chart-subject-averages').getContext('2d');
  const subs = Object.values(analytics.subjectStats || {});
  const subLabels = subs.map(s => s.subject);
  const subAverages = subs.map(s => s.average);

  if (subjectChartInstance) subjectChartInstance.destroy();

  subjectChartInstance = new Chart(ctxSubjects, {
    type: 'bar',
    data: {
      labels: subLabels,
      datasets: [{
        label: 'Subject Average (%)',
        data: subAverages,
        backgroundColor: [
          'rgba(0, 240, 255, 0.45)',
          'rgba(139, 92, 246, 0.45)',
          'rgba(16, 185, 129, 0.45)'
        ],
        borderColor: [
          '#00f0ff',
          '#8b5cf6',
          '#10b981'
        ],
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#fff',
          bodyColor: '#00f0ff',
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

  // Chart 2: Pass vs Fail Distribution
  const ctxPassFail = document.getElementById('chart-pass-fail').getContext('2d');
  if (passFailChartInstance) passFailChartInstance.destroy();

  passFailChartInstance = new Chart(ctxPassFail, {
    type: 'doughnut',
    data: {
      labels: ['Passed (≥ 40 all subjects)', 'Failed (< 40 in any subject)'],
      datasets: [{
        data: [analytics.studentsPassed, analytics.studentsFailed],
        backgroundColor: [
          'rgba(16, 185, 129, 0.65)',
          'rgba(244, 63, 94, 0.65)'
        ],
        borderColor: ['#10b981', '#f43f5e'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', padding: 15, font: { size: 12 } }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 10
        }
      }
    }
  });

  // Chart 3: Student Leaderboard Averages
  const ctxStudentAverages = document.getElementById('chart-student-averages').getContext('2d');
  if (studentAveragesChartInstance) studentAveragesChartInstance.destroy();

  const sortedStudents = [...(analytics.students || [])].sort((a, b) => b.averageMarks - a.averageMarks);
  const studentNames = sortedStudents.map(s => `${s.studentName} (#${s.studentId})`);
  const studentAvgScores = sortedStudents.map(s => s.averageMarks);
  const barColors = sortedStudents.map(s => s.result === 'Pass' ? 'rgba(0, 240, 255, 0.5)' : 'rgba(244, 63, 94, 0.5)');
  const borderColors = sortedStudents.map(s => s.result === 'Pass' ? '#00f0ff' : '#f43f5e');

  studentAveragesChartInstance = new Chart(ctxStudentAverages, {
    type: 'bar',
    data: {
      labels: studentNames,
      datasets: [{
        label: 'Average Score (%)',
        data: studentAvgScores,
        backgroundColor: barColors,
        borderColor: borderColors,
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1
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
          ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 }
        }
      }
    }
  });
}
