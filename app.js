// =============================================
// Canada PR Tracker — app.js
// =============================================

// ---- THEME TOGGLE ----
const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('prTheme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('prTheme', next);
});

// ---- COUNTDOWN TIMERS ----
function getDaysRemaining(targetDate) {
  const now = new Date();
  const target = new Date(targetDate);
  const diff = target - now;
  if (diff <= 0) return { days: 0, text: 'EXPIRED', expired: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);
  const remDays = days % 30;
  if (months > 0) {
    return { days, text: `${months}m ${remDays}d remaining`, expired: false };
  }
  return { days, text: `${days} days remaining`, expired: false };
}

function updateCountdowns() {
  const countdowns = [
    { id: 'h1bCountdown',  date: '2026-09-30', cardId: 'h1bCard' },
    { id: 'ecaCountdown',  date: '2026-12-31', cardId: 'ecaCard' },
    { id: 'capCountdown',  date: '2027-05-15', cardId: 'capCard' },
  ];

  countdowns.forEach(({ id, date, cardId }) => {
    const el = document.getElementById(id);
    const card = document.getElementById(cardId);
    const result = getDaysRemaining(date);
    el.textContent = result.text;

    if (result.expired) {
      el.style.color = '#999';
    } else if (result.days <= 90) {
      el.style.color = '#D32F2F';
      card.classList.add('urgent');
      card.classList.remove('warning');
    } else if (result.days <= 270) {
      el.style.color = '#F57F17';
    }
  });
}

updateCountdowns();
setInterval(updateCountdowns, 60000);

// ---- CRS SIMULATOR ----
const BASE_CRS = 409;

function updateSimulator() {
  const checkboxes = document.querySelectorAll('.simulator input[type="checkbox"]');
  let total = BASE_CRS;
  let addedItems = [];

  checkboxes.forEach(cb => {
    if (cb.checked) {
      const pts = parseInt(cb.getAttribute('data-pts'));
      total += pts;
      addedItems.push(pts);
    }
  });

  const simScoreEl = document.getElementById('simScore');
  const simDrawsEl = document.getElementById('simDraws');
  simScoreEl.textContent = total;

  let drawsText = '';
  let color = '#D32F2F';

  if (total >= 802) {
    drawsText = '🏆 Qualifies for PNP draws (800+)!';
    color = '#2E7D32';
  } else if (total >= 515) {
    drawsText = '✅ Qualifies for CEC draws (cutoff ~507–515)!';
    color = '#2E7D32';
  } else if (total >= 459) {
    drawsText = '🇫🇷 Qualifies for ALL 2026 French draws (cutoff ~393–419)!';
    color = '#1565C0';
  } else if (total >= 420) {
    drawsText = '🇫🇷 Likely qualifies for most French draws';
    color = '#E65100';
  } else if (total > BASE_CRS) {
    drawsText = `+${total - BASE_CRS} pts gain — keep improving!`;
    color = '#F57F17';
  } else {
    drawsText = 'Select improvements above to simulate';
    color = '#607D8B';
  }

  simDrawsEl.textContent = drawsText;
  simDrawsEl.style.color = color;
  simScoreEl.style.color = total > BASE_CRS ? '#2E7D32' : '#D32F2F';
}

updateSimulator();

// ---- CRS RING ANIMATION ----
function animateRing() {
  const arc = document.getElementById('scoreArc');
  if (!arc) return;
  const circumference = 2 * Math.PI * 65; // 408.41
  const pct = 409 / 1200;
  const offset = circumference * (1 - pct);
  // Animate from full offset to calculated
  arc.style.strokeDashoffset = circumference;
  arc.style.transition = 'stroke-dashoffset 1.5s ease';
  setTimeout(() => {
    arc.style.strokeDashoffset = offset;
  }, 300);
}

animateRing();

// ---- DOCUMENTS CHECKLIST ----
const documents = [
  { id: 'doc_ielts',    label: 'IELTS Results',                status: 'ready',    statusLabel: '✅ Ready' },
  { id: 'doc_eca',      label: 'WES ECA',                      status: 'ready',    statusLabel: '✅ Ready' },
  { id: 'doc_medical',  label: 'Medical Exam (IME + UMI)',      status: 'ready',    statusLabel: '✅ Ready' },
  { id: 'doc_ee',       label: 'Express Entry Profile',         status: 'ready',    statusLabel: '✅ Ready' },
  { id: 'doc_passport', label: 'Passport (Indian)',             status: 'ready',    statusLabel: '✅ Ready' },
  { id: 'doc_fbi',      label: 'FBI PCC',                      status: 'progress', statusLabel: '🔄 In Progress' },
  { id: 'doc_india',    label: 'India PCC',                    status: 'urgent',   statusLabel: '❗ Not Applied' },
  { id: 'doc_travel',   label: 'Travel History (IMM 5562)',     status: 'urgent',   statusLabel: '❗ Not Prepared' },
  { id: 'doc_bank',     label: 'Bank Statements (6 months)',   status: 'urgent',   statusLabel: '❗ Not Downloaded' },
];

function loadDocList() {
  const saved = JSON.parse(localStorage.getItem('prDocStatus') || '{}');
  const container = document.getElementById('docList');
  container.innerHTML = '';

  let readyCount = 0;
  documents.forEach(doc => {
    const checked = saved[doc.id] || doc.status === 'ready';
    if (checked) readyCount++;

    const item = document.createElement('label');
    item.className = 'doc-item';
    item.innerHTML = `
      <input type="checkbox" ${checked ? 'checked' : ''} data-id="${doc.id}" onchange="saveDocStatus()" />
      <span style="flex:1">${doc.label}</span>
      <span class="doc-status ${doc.status}">${doc.statusLabel}</span>
    `;
    container.appendChild(item);
  });

  updateDocProgress(readyCount);
}

function saveDocStatus() {
  const checkboxes = document.querySelectorAll('#docList input[type="checkbox"]');
  const saved = {};
  let readyCount = 0;
  checkboxes.forEach(cb => {
    saved[cb.getAttribute('data-id')] = cb.checked;
    if (cb.checked) readyCount++;
  });
  localStorage.setItem('prDocStatus', JSON.stringify(saved));
  updateDocProgress(readyCount);
}

function updateDocProgress(readyCount) {
  const total = documents.length;
  const pct = (readyCount / total) * 100;
  document.getElementById('docProgressFill').style.width = pct + '%';
  document.getElementById('docProgressText').textContent = `${readyCount} of ${total} ready (${Math.round(pct)}%)`;
}

loadDocList();

// ---- ACTION ITEMS ----
const actions = [
  {
    id: 'act_bc',
    title: 'Find BC Employer Actively',
    desc: 'Search LinkedIn, Indeed.ca, WorkBC.ca, Glassdoor.ca — target Vancouver BC tech companies. Keywords: BizOps Engineer, DevOps, Platform Engineer, Dashboard Developer. This is the SINGLE FASTEST path to PR.',
  },
  {
    id: 'act_french',
    title: 'Start French Today — TEF Canada CLB 7',
    desc: 'Download Duolingo (free). Register at Alliance Française Vancouver. Book TEF Canada test (tefcanada.fr, ~$400–450 CAD). French CLB 7 = +50 CRS = 459 total = qualifies EVERY 2026 French draw.',
  },
  {
    id: 'act_indiapcc',
    title: 'Apply India PCC Urgently',
    desc: 'Indian Consulate Vancouver: 604-682-7788 | 325 Howe Street, Vancouver. Takes 4–8 weeks — apply this week. Needed for any PR application.',
  },
  {
    id: 'act_fbipcc',
    title: 'Mail FBI PCC to West Virginia',
    desc: 'Print transmittal form from edo.cjis.gov. Mail FD-258 + transmittal to FBI West Virginia. Use Canada Post Xpresspost USA (~$25–35 CAD). Takes 12–16 weeks.',
  },
  {
    id: 'act_eefix',
    title: 'Fix Express Entry Profile (NOC Duties)',
    desc: 'Rewrite duties description to match NOC 21230 lead statement. This may unlock FSW eligibility and increase your CRS score options.',
  },
  {
    id: 'act_bank',
    title: 'Download Bank Statements',
    desc: 'Download last 6 months from online banking. Save as PDF — free and instant. Required for PR application.',
  },
  {
    id: 'act_ielts',
    title: 'Retake IELTS — Target 7.0+ All Bands',
    desc: 'Target CLB 9 (7.0+ in all four bands). Benefit: +20–30 CRS points + boosts SINP score. Register at ielts.org.',
  },
  {
    id: 'act_eca',
    title: 'Renew ECA Before December 2026',
    desc: 'WES ECA expires December 2026. Renew through WES (wes.org) if PR not received by then. Do not let this lapse.',
  },
];

function loadActionList() {
  const saved = JSON.parse(localStorage.getItem('prActionStatus') || '{}');
  const container = document.getElementById('actionList');
  container.innerHTML = '';

  actions.forEach((action, idx) => {
    const done = saved[action.id] || false;
    const item = document.createElement('div');
    item.className = `action-item ${done ? 'done' : ''}`;
    item.innerHTML = `
      <div class="action-num">${idx + 1}</div>
      <div class="action-body">
        <div class="action-title">${action.title}</div>
        <div class="action-desc">${action.desc}</div>
      </div>
      <input type="checkbox" class="action-check" ${done ? 'checked' : ''} data-id="${action.id}" title="Mark as done" onchange="saveActionStatus(this)" />
    `;
    container.appendChild(item);
  });
}

function saveActionStatus(checkbox) {
  const saved = JSON.parse(localStorage.getItem('prActionStatus') || '{}');
  saved[checkbox.getAttribute('data-id')] = checkbox.checked;
  localStorage.setItem('prActionStatus', JSON.stringify(saved));

  const item = checkbox.closest('.action-item');
  item.classList.toggle('done', checkbox.checked);
}

loadActionList();

// ---- NOTES ----
const notesArea = document.getElementById('notesArea');
const savedNotes = localStorage.getItem('prNotes');
if (savedNotes) notesArea.value = savedNotes;

function saveNotes() {
  localStorage.setItem('prNotes', notesArea.value);
  const status = document.getElementById('saveStatus');
  status.textContent = '✅ Saved!';
  setTimeout(() => { status.textContent = ''; }, 2000);
}

// Auto-save notes on change
notesArea.addEventListener('input', () => {
  clearTimeout(notesArea._saveTimer);
  notesArea._saveTimer = setTimeout(saveNotes, 1500);
});
