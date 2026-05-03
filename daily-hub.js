// =============================================
// Daily Hub — daily-hub.js
// Key Points + Custom Links stored in Firestore (with localStorage fallback)
// =============================================

const POINTS_LS_KEY = 'dailyHubPoints';
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
}

init();
