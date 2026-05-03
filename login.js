function getNextPage() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  if (!next) return 'index.html';
  if (next.includes('http://') || next.includes('https://') || next.includes('..')) return 'index.html';
  return next;
}

function setMessage(message, isError) {
  const msg = document.getElementById('authMessage');
  msg.textContent = message;
  msg.style.color = isError ? '#B71C1C' : '#2E7D32';
}

function toggleSections() {
  const hasCred = window.RajanAuth.hasCredentials();
  const setup = document.getElementById('setupSection');
  const login = document.getElementById('loginSection');
  setup.style.display = hasCred ? 'none' : 'block';
  login.style.display = hasCred ? 'block' : 'none';
}

async function handleSetup(event) {
  event.preventDefault();
  const username = document.getElementById('setupUsername').value.trim();
  const password = document.getElementById('setupPassword').value;

  if (password.length < 8) {
    setMessage('Use at least 8 characters for password.', true);
    return;
  }

  try {
    await window.RajanAuth.setupCredentials(username, password);
    setMessage('Credential created. Redirecting...', false);
    window.location.href = getNextPage();
  } catch (error) {
    setMessage(error.message, true);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  const ok = await window.RajanAuth.verifyCredentials(username, password);
  if (!ok) {
    setMessage('Invalid username or password.', true);
    return;
  }

  window.RajanAuth.createSession(username);
  setMessage('Login successful. Redirecting...', false);
  window.location.href = getNextPage();
}

if (window.RajanAuth.isAuthenticated()) {
  window.location.href = 'index.html';
}

toggleSections();
document.getElementById('setupForm').addEventListener('submit', handleSetup);
document.getElementById('loginForm').addEventListener('submit', handleLogin);
