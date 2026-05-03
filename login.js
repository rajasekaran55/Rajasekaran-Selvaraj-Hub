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
  msg.style.color = isError ? '#ffb3b3' : '#b8ffd1';
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    setMessage('Enter email and password.', true);
    return;
  }

  try {
    await window.RajanAuth.loginWithEmail(email, password);
    setMessage('Login successful. Redirecting...', false);
    window.location.href = getNextPage();
  } catch (error) {
    setMessage(error.message || 'Login failed.', true);
  }
}

async function handleReset() {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  if (!email) {
    setMessage('Enter your email first, then click reset.', true);
    return;
  }

  try {
    await window.RajanAuth.sendReset(email);
    setMessage('Password reset email sent.', false);
  } catch (error) {
    setMessage(error.message || 'Reset failed.', true);
  }
}

window.RajanAuth.onAuthReady().then((user) => {
  if (user && window.RajanAuth.isAuthenticated()) {
    window.location.href = 'index.html';
  }
});

const allowed = window.RajanAuth.allowedEmail();
if (allowed) {
  const emailInput = document.getElementById('loginEmail');
  emailInput.value = allowed;
}

document.getElementById('loginForm').addEventListener('submit', handleLogin);
document.getElementById('resetPasswordBtn').addEventListener('click', handleReset);
