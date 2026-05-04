// =============================================
// Daily Hub — daily-hub.js
// Key Points + Custom Links stored in Firestore (with localStorage fallback)
// =============================================

// ---- PROFILE DEFAULTS (your personal immigration profile) ----
const MY_PROFILE = {
  crs: 409,
  h1bExpiry: '2026-09-30',
  ecaExpiry: '2026-12-31',
  capExpiry: '2027-05-15',
};

// ---- SMART BRIEF ----
const IRCC_DRAWS_URL =
  'https://www.canada.ca/content/dam/ircc/documents/json/ee_rounds_123_en.json';

function daysUntil(dateStr) {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function parseIrccDate(str) {
  // IRCC returns dates like "May 1, 2026" — convert to YYYY-MM-DD
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toISOString().split('T')[0];
}

async function fetchLatestDraw() {
  const res = await fetch(IRCC_DRAWS_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const rounds = data.rounds || [];
  if (!rounds.length) throw new Error('No draw data returned');
  return rounds[0]; // latest draw is first
}

function buildSmartAlerts(cutoff, profile) {
  const alerts = [];
  const gap = cutoff - profile.crs;
  const h1bDays = daysUntil(profile.h1bExpiry);
  const ecaDays = daysUntil(profile.ecaExpiry);
  const capDays = daysUntil(profile.capExpiry);

  // --- CRS gap vs latest cutoff ---
  if (gap <= 0) {
    alerts.push({
      type: 'success', icon: '🎉',
      title: `You qualify for this draw! Your CRS (${profile.crs}) ≥ cutoff (${cutoff})`,
      msg: 'Your score meets or exceeds the latest draw cutoff. Make sure your profile is active in the Express Entry pool.',
    });
  } else if (gap <= 20) {
    alerts.push({
      type: 'warning', icon: '🔥',
      title: `Only ${gap} points away from the latest cutoff!`,
      msg: `Latest cutoff: ${cutoff} | Your CRS: ${profile.crs}. You are extremely close. A new job offer, PNP nomination, or French language score could push you over.`,
    });
  } else if (gap <= 50) {
    alerts.push({
      type: 'warning', icon: '⚡',
      title: `${gap} points to close — French language boost recommended`,
      msg: `Latest cutoff: ${cutoff} | Your CRS: ${profile.crs}. Achieving French CLB 9+ can add up to 50 CRS points. Consider NCLC prep immediately.`,
    });
  } else {
    alerts.push({
      type: 'info', icon: '📊',
      title: `${gap}-point gap to latest cutoff (${cutoff})`,
      msg: `Your CRS: ${profile.crs}. Priority boosts: (1) French language CLB 9+ = +50 pts, (2) Provincial Nomination (PNP) = +600 pts, (3) Job offer = +50–200 pts.`,
    });
  }

  // --- H1B expiry ---
  if (h1bDays <= 0) {
    alerts.push({
      type: 'danger', icon: '🚨',
      title: 'H1B has expired!',
      msg: `Your H1B expired on ${profile.h1bExpiry}. Consult your immigration attorney immediately.`,
    });
  } else if (h1bDays <= 60) {
    alerts.push({
      type: 'danger', icon: '🚨',
      title: `H1B expires in ${h1bDays} days — urgent action needed`,
      msg: `Expiry: ${profile.h1bExpiry}. File H1B extension or ensure your Canada PR process is on track before this deadline.`,
    });
  } else if (h1bDays <= 120) {
    alerts.push({
      type: 'warning', icon: '⚠️',
      title: `H1B expires in ${h1bDays} days`,
      msg: `Expiry: ${profile.h1bExpiry}. Start your H1B extension process now — filing takes 2–3 months. Also track your EE profile as a backup plan.`,
    });
  }

  // --- ECA expiry ---
  if (ecaDays <= 90) {
    alerts.push({
      type: 'warning', icon: '📋',
      title: `ECA expires in ${ecaDays} days`,
      msg: `Expiry: ${profile.ecaExpiry}. Your Educational Credential Assessment is required for Express Entry. Renew it before it expires or your EE profile becomes invalid.`,
    });
  } else if (ecaDays <= 180) {
    alerts.push({
      type: 'info', icon: '📋',
      title: `ECA expires in ${ecaDays} days — plan renewal`,
      msg: `Expiry: ${profile.ecaExpiry}. Begin the renewal process ~90 days before expiry to avoid any gap in your Express Entry eligibility.`,
    });
  }

  // --- Work permit cap ---
  if (capDays > 0 && capDays <= 180) {
    alerts.push({
      type: 'info', icon: '🗓️',
      title: `Work permit cap deadline in ${capDays} days`,
      msg: `Cap date: ${profile.capExpiry}. Ensure all documentation is in order well before this date.`,
    });
  }

  return alerts;
}

function renderSmartBrief(draw, profile) {
  const container = document.getElementById('smartBriefContainer');
  if (!container) return;

  const cutoff = Number(draw.drawCRS);
  const gap = cutoff - profile.crs;
  const drawDateISO = parseIrccDate(draw.drawDateFull || draw.drawDate);

  // Predict next draw (~14 days after last)
  const lastDrawDate = new Date(drawDateISO);
  const expectedNext = new Date(lastDrawDate);
  expectedNext.setDate(expectedNext.getDate() + 14);
  const nextDays = daysUntil(expectedNext.toISOString().split('T')[0]);
  const nextDaysLabel = nextDays > 0
    ? `📅 Next draw expected in ~${nextDays} day${nextDays !== 1 ? 's' : ''} (draws are ~every 2 weeks)`
    : '📅 A new draw may be due any day now';

  const gapClass = gap <= 0 ? 'stat-green' : gap <= 30 ? 'stat-orange' : 'stat-red';
  const gapLabel = gap <= 0 ? `+${Math.abs(gap)} above` : `${gap} below`;

  const alerts = buildSmartAlerts(cutoff, profile);
  const alertsHtml = alerts.map((a) => `
    <div class="smart-alert smart-alert-${a.type}">
      <span class="smart-alert-icon">${a.icon}</span>
      <div>
        <strong>${escapeHtml(a.title)}</strong>
        <p>${escapeHtml(a.msg)}</p>
      </div>
    </div>
  `).join('');

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  container.innerHTML = `
    <div class="card" style="margin-bottom:1rem">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem">
        <h3 class="resource-category-title" style="margin-bottom:0">📊 Latest Express Entry Draw — #${escapeHtml(String(draw.drawNumber))}</h3>
        <button class="btn" id="smartRefreshBtn" type="button" style="font-size:0.78rem;padding:5px 12px">🔄 Refresh</button>
      </div>
      <div class="smart-draw-grid">
        <div class="smart-stat">
          <span class="smart-stat-label">Draw Date</span>
          <span class="smart-stat-val">${escapeHtml(draw.drawDate)}</span>
        </div>
        <div class="smart-stat">
          <span class="smart-stat-label">CRS Cutoff</span>
          <span class="smart-stat-val">${cutoff}</span>
        </div>
        <div class="smart-stat">
          <span class="smart-stat-label">Invitations</span>
          <span class="smart-stat-val">${Number(draw.drawSize).toLocaleString()}</span>
        </div>
        <div class="smart-stat">
          <span class="smart-stat-label">Program</span>
          <span class="smart-stat-val" style="font-size:0.85rem">${escapeHtml(draw.drawName)}</span>
        </div>
        <div class="smart-stat">
          <span class="smart-stat-label">Your CRS</span>
          <span class="smart-stat-val ${gapClass}">${profile.crs}</span>
        </div>
        <div class="smart-stat">
          <span class="smart-stat-label">Your Gap</span>
          <span class="smart-stat-val ${gapClass}">${gapLabel}</span>
        </div>
      </div>
      <p class="card-sub" style="margin-top:0.75rem">${nextDaysLabel}</p>
    </div>
    <div class="smart-alerts">${alertsHtml}</div>
    <div class="smart-brief-footer">
      <span class="smart-fetch-time">Last updated: ${now} · Data source: IRCC Canada</span>
    </div>
  `;

  const refreshBtn = document.getElementById('smartRefreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadSmartBrief);
  }
}

async function loadSmartBrief() {
  const container = document.getElementById('smartBriefContainer');
  if (!container) return;
  container.innerHTML = `<div class="card"><p class="card-sub">⏳ Loading latest Express Entry data from IRCC...</p></div>`;
  try {
    const draw = await fetchLatestDraw();
    renderSmartBrief(draw, MY_PROFILE);
  } catch (err) {
    container.innerHTML = `
      <div class="card">
        <div class="smart-error">
          ⚠️ Could not load live IRCC data. Check your internet connection or try refreshing.
          <br><br>
          <button class="btn" id="smartRetryBtn" type="button">🔄 Retry</button>
          <br><br>
          <small>You can also check directly: <a href="https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations.html" target="_blank" rel="noopener noreferrer">IRCC Draw Results →</a></small>
        </div>
      </div>`;
    const retryBtn = document.getElementById('smartRetryBtn');
    if (retryBtn) retryBtn.addEventListener('click', loadSmartBrief);
  }
}


const LINKS_LS_KEY = 'dailyHubLinks';

let db = null;
let currentUser = null;
let pointsCache = [];
let linksCache = [];

// ---- THEME ----
function applyTheme() {
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
}

// ---- STATUS ----
function setStatus(elementId, message, isError) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? '#B71C1C' : '#2E7D32';
  setTimeout(() => { if (el.textContent === message) el.textContent = ''; }, 2500);
}

// ---- FIRESTORE PATHS ----
function pointsRef() {
  return db.collection('users').doc(currentUser.uid).collection('dailyPoints');
}
function linksRef() {
  return db.collection('users').doc(currentUser.uid).collection('dailyLinks');
}

// ---- KEY POINTS ----
function renderPoints() {
  const list = document.getElementById('pointsList');
  if (!list) return;

  if (!pointsCache.length) {
    list.innerHTML = '<p class="card-sub">No key points yet. Add your first one above.</p>';
    return;
  }

  const sorted = [...pointsCache].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  list.innerHTML = sorted.map((point) => `
    <div class="point-row" data-id="${point.id}">
      <span class="point-bullet">•</span>
      <span class="point-text">${escapeHtml(point.text)}</span>
      <button class="subtab-delete" data-delete-point="${point.id}" type="button" aria-label="Delete">x</button>
    </div>
  `).join('');

  list.querySelectorAll('[data-delete-point]').forEach((btn) => {
    btn.addEventListener('click', () => deletePoint(btn.getAttribute('data-delete-point')));
  });
}

async function addPoint() {
  const input = document.getElementById('newPointInput');
  const text = input.value.trim();
  if (!text) { setStatus('pointsStatus', 'Enter a key point.', true); return; }

  const id = String(Date.now());
  const now = Date.now();
  const data = { text, createdAt: now };

  try {
    if (db && currentUser) {
      await pointsRef().doc(id).set(data);
    } else {
      pointsCache.push({ id, ...data });
      localStorage.setItem(POINTS_LS_KEY, JSON.stringify(pointsCache));
    }
    pointsCache.push({ id, ...data });
    input.value = '';
    renderPoints();
    setStatus('pointsStatus', 'Key point saved.', false);
  } catch {
    setStatus('pointsStatus', 'Unable to save key point.', true);
  }
}

async function deletePoint(id) {
  try {
    if (db && currentUser) {
      await pointsRef().doc(id).delete();
    }
    pointsCache = pointsCache.filter((p) => p.id !== id);
    if (!db || !currentUser) {
      localStorage.setItem(POINTS_LS_KEY, JSON.stringify(pointsCache));
    }
    renderPoints();
    setStatus('pointsStatus', 'Key point deleted.', false);
  } catch {
    setStatus('pointsStatus', 'Unable to delete.', true);
  }
}

async function loadPoints() {
  if (db && currentUser) {
    try {
      const snap = await pointsRef().get();
      pointsCache = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch {
      pointsCache = JSON.parse(localStorage.getItem(POINTS_LS_KEY) || '[]');
    }
  } else {
    pointsCache = JSON.parse(localStorage.getItem(POINTS_LS_KEY) || '[]');
  }
  renderPoints();
}

// ---- CUSTOM LINKS ----
function renderCustomLinks() {
  const list = document.getElementById('customLinksList');
  if (!list) return;

  if (!linksCache.length) {
    list.innerHTML = '<p class="card-sub">No custom links yet.</p>';
    return;
  }

  const sorted = [...linksCache].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  list.innerHTML = sorted.map((link) => `
    <div class="resource-link custom-link-item" style="position:relative">
      <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:inherit;display:block">
        <span class="resource-name">${escapeHtml(link.name)}</span>
        <span class="resource-desc">${escapeHtml(link.url)}</span>
      </a>
      <button class="subtab-delete custom-link-delete" data-delete-link="${link.id}" type="button" aria-label="Delete">x</button>
    </div>
  `).join('');

  list.querySelectorAll('[data-delete-link]').forEach((btn) => {
    btn.addEventListener('click', () => deleteCustomLink(btn.getAttribute('data-delete-link')));
  });
}

async function addCustomLink() {
  const nameInput = document.getElementById('customLinkName');
  const urlInput = document.getElementById('customLinkUrl');
  const name = nameInput.value.trim();
  let url = urlInput.value.trim();
  if (!name || !url) { setStatus('linksStatus', 'Enter both a label and URL.', true); return; }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  const id = String(Date.now());
  const now = Date.now();
  const data = { name, url, createdAt: now };

  try {
    if (db && currentUser) {
      await linksRef().doc(id).set(data);
    } else {
      linksCache.push({ id, ...data });
      localStorage.setItem(LINKS_LS_KEY, JSON.stringify(linksCache));
    }
    linksCache.push({ id, ...data });
    nameInput.value = '';
    urlInput.value = '';
    renderCustomLinks();
    setStatus('linksStatus', 'Link saved.', false);
  } catch {
    setStatus('linksStatus', 'Unable to save link.', true);
  }
}

async function deleteCustomLink(id) {
  try {
    if (db && currentUser) {
      await linksRef().doc(id).delete();
    }
    linksCache = linksCache.filter((l) => l.id !== id);
    if (!db || !currentUser) {
      localStorage.setItem(LINKS_LS_KEY, JSON.stringify(linksCache));
    }
    renderCustomLinks();
    setStatus('linksStatus', 'Link removed.', false);
  } catch {
    setStatus('linksStatus', 'Unable to delete.', true);
  }
}

async function loadCustomLinks() {
  if (db && currentUser) {
    try {
      const snap = await linksRef().get();
      linksCache = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch {
      linksCache = JSON.parse(localStorage.getItem(LINKS_LS_KEY) || '[]');
    }
  } else {
    linksCache = JSON.parse(localStorage.getItem(LINKS_LS_KEY) || '[]');
  }
  renderCustomLinks();
}

// ---- UTIL ----
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- INIT ----
async function init() {
  applyTheme();

  await window.RajanAuth.requireAuth();
  currentUser = await window.RajanAuth.onAuthReady();

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => window.RajanAuth.logout());

  if (window.firebase && window.firebase.firestore && currentUser) {
    db = window.firebase.firestore();
  }

  document.getElementById('addPointBtn').addEventListener('click', addPoint);
  document.getElementById('newPointInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addPoint(); }
  });

  document.getElementById('addCustomLinkBtn').addEventListener('click', addCustomLink);
  document.getElementById('customLinkUrl').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addCustomLink(); }
  });

  await Promise.all([loadPoints(), loadCustomLinks()]);
  loadSmartBrief();
}

init();
