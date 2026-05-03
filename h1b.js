const STORAGE_KEY = 'h1bApplications';
const EDIT_KEY = 'h1bEditId';

const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('prTheme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
if (themeToggle) {
  themeToggle.textContent = savedTheme === 'dark' ? 'Light' : 'Dark';
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    themeToggle.textContent = next === 'dark' ? 'Light' : 'Dark';
    localStorage.setItem('prTheme', next);
  });
}

function getJobs() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

function saveJobs(jobs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

function setFormStatus(msg) {
  const status = document.getElementById('formStatus');
  status.textContent = msg;
  setTimeout(() => {
    status.textContent = '';
  }, 1800);
}

function resetForm() {
  document.getElementById('jobForm').reset();
  localStorage.removeItem(EDIT_KEY);
}

function statusClass(status) {
  if (status === 'Offer') return 'tag-green';
  if (status.includes('Interview') || status === 'Recruiter Call') return 'tag-orange';
  if (status === 'Rejected') return 'tag-red';
  if (status === 'On Hold') return 'tag-gray';
  return 'tag-yellow';
}

function renderJobs() {
  const body = document.getElementById('jobsBody');
  const filter = document.getElementById('statusFilter').value;
  const jobs = getJobs().sort((a, b) => (a.appliedDate < b.appliedDate ? 1 : -1));
  body.innerHTML = '';

  jobs.forEach((job) => {
    if (filter !== 'All' && job.status !== filter) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${job.company}</strong></td>
      <td>${job.role}</td>
      <td>${job.appliedDate}</td>
      <td><span class="tag ${statusClass(job.status)}">${job.status}</span></td>
      <td>${job.reminderDate || '-'}</td>
      <td>${job.jobLink ? `<a href="${job.jobLink}" target="_blank">Open</a>` : '-'}</td>
      <td>
        <button class="btn mini-btn" data-edit="${job.id}" type="button">Edit</button>
        <button class="btn mini-btn danger-btn" data-delete="${job.id}" type="button">Delete</button>
      </td>
    `;
    body.appendChild(tr);
  });

  body.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => startEdit(btn.getAttribute('data-edit')));
  });
  body.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteJob(btn.getAttribute('data-delete')));
  });
}

function renderReminders() {
  const wrap = document.getElementById('remindersWrap');
  const jobs = getJobs();
  const today = new Date();
  const upcoming = [];

  jobs.forEach((job) => {
    if (!job.reminderDate) return;
    const date = new Date(job.reminderDate);
    const diffDays = Math.floor((date - today) / (1000 * 60 * 60 * 24));
    if (diffDays <= 3) {
      upcoming.push({ ...job, diffDays });
    }
  });

  if (!upcoming.length) {
    wrap.innerHTML = '<p class="card-sub">No reminders in the next 3 days.</p>';
    return;
  }

  wrap.innerHTML = upcoming
    .sort((a, b) => (a.reminderDate > b.reminderDate ? 1 : -1))
    .map((job) => {
      const label = job.diffDays < 0 ? 'Overdue' : job.diffDays === 0 ? 'Today' : `In ${job.diffDays} day(s)`;
      return `
        <div class="reminder-item ${job.diffDays < 0 ? 'reminder-overdue' : ''}">
          <div>
            <strong>${job.company}</strong> - ${job.role}<br/>
            <span class="card-sub">${job.status}</span>
          </div>
          <div class="reminder-date">${job.reminderDate} (${label})</div>
        </div>
      `;
    })
    .join('');
}

function deleteJob(id) {
  const jobs = getJobs().filter((job) => job.id !== id);
  saveJobs(jobs);
  renderJobs();
  renderReminders();
}

function startEdit(id) {
  const jobs = getJobs();
  const job = jobs.find((j) => j.id === id);
  if (!job) return;

  document.getElementById('company').value = job.company;
  document.getElementById('role').value = job.role;
  document.getElementById('jobLink').value = job.jobLink;
  document.getElementById('appliedDate').value = job.appliedDate;
  document.getElementById('status').value = job.status;
  document.getElementById('reminderDate').value = job.reminderDate;
  document.getElementById('notes').value = job.notes;
  localStorage.setItem(EDIT_KEY, id);
  setFormStatus('Edit mode enabled');
}

function saveFromForm(event) {
  event.preventDefault();

  const editId = localStorage.getItem(EDIT_KEY);
  const payload = {
    id: editId || String(Date.now()),
    company: document.getElementById('company').value.trim(),
    role: document.getElementById('role').value.trim(),
    jobLink: document.getElementById('jobLink').value.trim(),
    appliedDate: document.getElementById('appliedDate').value,
    status: document.getElementById('status').value,
    reminderDate: document.getElementById('reminderDate').value,
    notes: document.getElementById('notes').value.trim(),
  };

  if (!payload.company || !payload.role || !payload.appliedDate) {
    setFormStatus('Please fill required fields');
    return;
  }

  const jobs = getJobs();
  const index = jobs.findIndex((j) => j.id === payload.id);
  if (index >= 0) {
    jobs[index] = payload;
    setFormStatus('Application updated');
  } else {
    jobs.push(payload);
    setFormStatus('Application saved');
  }

  saveJobs(jobs);
  resetForm();
  renderJobs();
  renderReminders();
}

document.getElementById('jobForm').addEventListener('submit', saveFromForm);
document.getElementById('resetForm').addEventListener('click', resetForm);
document.getElementById('statusFilter').addEventListener('change', renderJobs);

renderJobs();
renderReminders();
