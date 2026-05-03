// =============================================
// Rajan's Hub - app.js
// =============================================

const state = {
  baseCrs: 409,
  deadlines: {
    h1b: '2026-09-30',
    eca: '2026-12-31',
    cap: '2027-05-15',
  },
};

const SHEET_KEY = 'prSheetConfig';

if (window.RajanAuth) {
  window.RajanAuth.requireAuth();
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => window.RajanAuth.logout());
  }
}

// ---- THEME TOGGLE ----
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

// ---- GOOGLE SHEETS SYNC ----
function extractSheetId(url) {
  const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function parseGvizResponse(text) {
  const start = text.indexOf('(');
  const end = text.lastIndexOf(');');
  if (start === -1 || end === -1) {
    throw new Error('Invalid Google Sheets response format.');
  }
  const json = text.slice(start + 1, end);
  return JSON.parse(json);
}

function tableRowsToConfig(rows) {
  const config = {};
  rows.forEach((row) => {
    const keyCell = row.c && row.c[0] ? row.c[0].v : null;
    const valueCell = row.c && row.c[1] ? row.c[1].v : null;
    if (!keyCell || valueCell === null || valueCell === undefined) return;
    config[String(keyCell).trim()] = String(valueCell).trim();
  });
  return config;
}

function applyRemoteConfig(config) {
  const nameEl = document.getElementById('profileName');
  const subtitleEl = document.getElementById('profileSubtitle');
  const footerLine = document.getElementById('footerLine');

  if (config.full_name && nameEl) nameEl.textContent = config.full_name;
  if (config.subtitle && subtitleEl) subtitleEl.textContent = config.subtitle;
  if (config.footer_note && footerLine) footerLine.textContent = config.footer_note;

  if (config.crs_score) {
    const score = Number(config.crs_score);
    if (!Number.isNaN(score) && score > 0) {
      state.baseCrs = score;
    }
  }

  if (config.h1b_expiry) state.deadlines.h1b = config.h1b_expiry;
  if (config.eca_expiry) state.deadlines.eca = config.eca_expiry;
  if (config.cap_expiry) state.deadlines.cap = config.cap_expiry;

  const crsDisplay = document.getElementById('crsDisplay');
  const scoreNumber = document.getElementById('scoreNumber');
  if (crsDisplay) crsDisplay.textContent = String(state.baseCrs);
  if (scoreNumber) scoreNumber.textContent = String(state.baseCrs);

  updateSimulator();
  animateRing();
  updateCountdowns();
}

async function fetchSheetConfig(sheetId, tabName) {
  const effectiveTab = tabName || 'Config';
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(effectiveTab)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Unable to fetch sheet. Check if the sheet is shared publicly.');
  }
  const text = await response.text();
  const parsed = parseGvizResponse(text);
  const rows = parsed.table && parsed.table.rows ? parsed.table.rows : [];
  if (!rows.length) {
    throw new Error('Sheet tab is empty. Add key/value rows.');
  }
  return tableRowsToConfig(rows);
}

function setSheetStatus(message, isError) {
  const status = document.getElementById('sheetStatus');
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? '#B71C1C' : '#2E7D32';
}

async function connectSheet() {
  const urlInput = document.getElementById('sheetUrlInput');
  const tabInput = document.getElementById('sheetTabInput');
  if (!urlInput) return;

  const sheetUrl = urlInput.value.trim();
  const tabName = tabInput ? tabInput.value.trim() : 'Config';
  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) {
    setSheetStatus('Invalid Google Sheet link. Please paste a correct URL.', true);
    return;
  }

  setSheetStatus('Connecting to Google Sheet...', false);
  try {
    const config = await fetchSheetConfig(sheetId, tabName || 'Config');
    localStorage.setItem(SHEET_KEY, JSON.stringify({ sheetUrl, tabName: tabName || 'Config' }));
    applyRemoteConfig(config);
    setSheetStatus('Connected. Latest values loaded from Google Sheets.', false);
  } catch (error) {
    setSheetStatus(error.message, true);
  }
}

function disconnectSheet() {
  localStorage.removeItem(SHEET_KEY);
  const urlInput = document.getElementById('sheetUrlInput');
  const tabInput = document.getElementById('sheetTabInput');
  if (urlInput) urlInput.value = '';
  if (tabInput) tabInput.value = '';
  setSheetStatus('Disconnected. Using local values.', false);
}

async function loadSavedSheetConfig() {
  const saved = localStorage.getItem(SHEET_KEY);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    const urlInput = document.getElementById('sheetUrlInput');
    const tabInput = document.getElementById('sheetTabInput');
    if (urlInput) urlInput.value = parsed.sheetUrl || '';
    if (tabInput) tabInput.value = parsed.tabName || 'Config';

    const sheetId = extractSheetId(parsed.sheetUrl || '');
    if (!sheetId) return;

    setSheetStatus('Loading latest cloud data...', false);
    const config = await fetchSheetConfig(sheetId, parsed.tabName || 'Config');
    applyRemoteConfig(config);
    setSheetStatus('Cloud sync active. Data is updated from Google Sheets.', false);
  } catch (error) {
    setSheetStatus('Cloud sync failed. Please reconnect your sheet.', true);
  }
}

function initSheetControls() {
  const connectBtn = document.getElementById('connectSheetBtn');
  const clearBtn = document.getElementById('clearSheetBtn');
  if (connectBtn) connectBtn.addEventListener('click', connectSheet);
  if (clearBtn) clearBtn.addEventListener('click', disconnectSheet);
}

// ---- COUNTDOWN TIMERS ----
function getDaysRemaining(targetDate) {
  const now = new Date();
  const target = new Date(targetDate);
  const diff = target - now;
  if (diff <= 0) return { days: 0, text: 'Expired', expired: true };
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
    { id: 'h1bCountdown', date: state.deadlines.h1b, cardId: 'h1bCard' },
    { id: 'ecaCountdown', date: state.deadlines.eca, cardId: 'ecaCard' },
    { id: 'capCountdown', date: state.deadlines.cap, cardId: 'capCard' },
  ];

  countdowns.forEach(({ id, date, cardId }) => {
    const el = document.getElementById(id);
    const card = document.getElementById(cardId);
    if (!el || !card) return;

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
function updateSimulator() {
  const checkboxes = document.querySelectorAll('.simulator input[type="checkbox"]');
  let total = state.baseCrs;

  checkboxes.forEach((cb) => {
    if (cb.checked) {
      const pts = parseInt(cb.getAttribute('data-pts'), 10);
      if (!Number.isNaN(pts)) total += pts;
    }
  });

  const simScoreEl = document.getElementById('simScore');
  const simDrawsEl = document.getElementById('simDraws');
  if (!simScoreEl || !simDrawsEl) return;

  simScoreEl.textContent = String(total);

  let drawsText = '';
  let color = '#D32F2F';

  if (total >= 802) {
    drawsText = 'Qualifies for PNP draws (800+).';
    color = '#2E7D32';
  } else if (total >= 515) {
    drawsText = 'Qualifies for CEC draws (cutoff around 507-515).';
    color = '#2E7D32';
  } else if (total >= 459) {
    drawsText = 'Qualifies for all recent French draws (around 393-419).';
    color = '#1565C0';
  } else if (total >= 420) {
    drawsText = 'Likely qualifies for many French draws.';
    color = '#E65100';
  } else if (total > state.baseCrs) {
    drawsText = `+${total - state.baseCrs} points gain.`;
    color = '#F57F17';
  } else {
    drawsText = 'Select improvements above to simulate.';
    color = '#607D8B';
  }

  simDrawsEl.textContent = drawsText;
  simDrawsEl.style.color = color;
  simScoreEl.style.color = total > state.baseCrs ? '#2E7D32' : '#D32F2F';
}

window.updateSimulator = updateSimulator;
updateSimulator();

// ---- CRS RING ANIMATION ----
function animateRing() {
  const arc = document.getElementById('scoreArc');
  const scoreNumber = document.getElementById('scoreNumber');
  if (!arc || !scoreNumber) return;

  const circumference = 2 * Math.PI * 65;
  const pct = Math.max(0, Math.min(1, state.baseCrs / 1200));
  const offset = circumference * (1 - pct);

  scoreNumber.textContent = String(state.baseCrs);
  arc.style.strokeDashoffset = circumference;
  arc.style.transition = 'stroke-dashoffset 1.5s ease';
  setTimeout(() => {
    arc.style.strokeDashoffset = offset;
  }, 300);
}

animateRing();

// ---- DOCUMENTS CHECKLIST ----
const documents = [
  { id: 'doc_ielts', label: 'IELTS Results', status: 'ready', statusLabel: 'Ready' },
  { id: 'doc_eca', label: 'WES ECA', status: 'ready', statusLabel: 'Ready' },
  { id: 'doc_medical', label: 'Medical Exam (IME + UMI)', status: 'ready', statusLabel: 'Ready' },
  { id: 'doc_ee', label: 'Express Entry Profile', status: 'ready', statusLabel: 'Ready' },
  { id: 'doc_passport', label: 'Passport (Indian)', status: 'ready', statusLabel: 'Ready' },
  { id: 'doc_fbi', label: 'FBI PCC', status: 'progress', statusLabel: 'In Progress' },
  { id: 'doc_india', label: 'India PCC', status: 'urgent', statusLabel: 'Not Applied' },
  { id: 'doc_travel', label: 'Travel History (IMM 5562)', status: 'urgent', statusLabel: 'Not Prepared' },
  { id: 'doc_bank', label: 'Bank Statements (6 months)', status: 'urgent', statusLabel: 'Not Downloaded' },
];

function loadDocList() {
  const saved = JSON.parse(localStorage.getItem('prDocStatus') || '{}');
  const container = document.getElementById('docList');
  if (!container) return;
  container.innerHTML = '';

  let readyCount = 0;
  documents.forEach((doc) => {
    const checked = saved[doc.id] ?? doc.status === 'ready';
    if (checked) readyCount += 1;

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
  checkboxes.forEach((cb) => {
    saved[cb.getAttribute('data-id')] = cb.checked;
    if (cb.checked) readyCount += 1;
  });
  localStorage.setItem('prDocStatus', JSON.stringify(saved));
  updateDocProgress(readyCount);
}

window.saveDocStatus = saveDocStatus;

function updateDocProgress(readyCount) {
  const total = documents.length;
  const pct = (readyCount / total) * 100;
  const fill = document.getElementById('docProgressFill');
  const text = document.getElementById('docProgressText');
  if (fill) fill.style.width = `${pct}%`;
  if (text) text.textContent = `${readyCount} of ${total} ready (${Math.round(pct)}%)`;
}

loadDocList();

// ---- ACTION ITEMS ----
const actions = [
  {
    id: 'act_bc',
    title: 'Find BC Employer Actively',
    desc: 'Search LinkedIn, Indeed.ca, WorkBC.ca, Glassdoor.ca. Target Vancouver BC tech companies.',
  },
  {
    id: 'act_french',
    title: 'Start French Today - TEF Canada CLB 7',
    desc: 'French CLB 7 gives +50 CRS. Start with Duolingo and a course.',
  },
  {
    id: 'act_indiapcc',
    title: 'Apply India PCC Urgently',
    desc: 'Indian Consulate Vancouver. Processing can take 4-8 weeks.',
  },
  {
    id: 'act_fbipcc',
    title: 'Mail FBI PCC to West Virginia',
    desc: 'Send FD-258 with transmittal form by tracked post.',
  },
  {
    id: 'act_eefix',
    title: 'Fix Express Entry Profile Duties',
    desc: 'Align duties with NOC 21230 lead statement.',
  },
  {
    id: 'act_bank',
    title: 'Download Bank Statements',
    desc: 'Download 6 months statements as PDF.',
  },
  {
    id: 'act_ielts',
    title: 'Retake IELTS Target 7.0+',
    desc: 'Target CLB 9 for additional CRS points.',
  },
  {
    id: 'act_eca',
    title: 'Renew ECA Before December 2026',
    desc: 'Renew WES ECA if PR is not completed in time.',
  },
];

function loadActionList() {
  const saved = JSON.parse(localStorage.getItem('prActionStatus') || '{}');
  const container = document.getElementById('actionList');
  if (!container) return;
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
  if (item) item.classList.toggle('done', checkbox.checked);
}

window.saveActionStatus = saveActionStatus;
loadActionList();

// ---- NOTES ----
const notesArea = document.getElementById('notesArea');
if (notesArea) {
  const savedNotes = localStorage.getItem('prNotes');
  if (savedNotes) notesArea.value = savedNotes;

  notesArea.addEventListener('input', () => {
    clearTimeout(notesArea._saveTimer);
    notesArea._saveTimer = setTimeout(saveNotes, 1200);
  });
}

function saveNotes() {
  if (!notesArea) return;
  localStorage.setItem('prNotes', notesArea.value);
  const status = document.getElementById('saveStatus');
  if (status) {
    status.textContent = 'Saved';
    setTimeout(() => {
      status.textContent = '';
    }, 1600);
  }
}

window.saveNotes = saveNotes;

// ---- INIT ----
initSheetControls();
loadSavedSheetConfig();
