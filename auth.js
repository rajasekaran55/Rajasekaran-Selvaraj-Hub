(function bootstrapAuth() {
  const cfg = window.RajanFirebaseConfig || {};
  if (!cfg.firebaseConfig) {
    throw new Error('Missing Firebase config. Update firebase-config.js');
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(cfg.firebaseConfig);
  }

  const auth = firebase.auth();

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function allowedEmail() {
    return normalizeEmail(cfg.allowedEmail || '');
  }

  function isAllowedUser(user) {
    if (!user || !user.email) return false;
    const allowed = allowedEmail();
    if (!allowed) return false;
    return normalizeEmail(user.email) === allowed;
  }

  function getNextTarget() {
    const next = encodeURIComponent(window.location.pathname.split('/').pop() || 'index.html');
    return `login.html?next=${next}`;
  }

  function redirectLogin() {
    if (!window.location.pathname.endsWith('login.html')) {
      window.location.href = getNextTarget();
    }
  }

  async function loginWithEmail(email, password) {
    const normalized = normalizeEmail(email);
    if (normalized !== allowedEmail()) {
      throw new Error('This email is not allowed for this site.');
    }

    const result = await auth.signInWithEmailAndPassword(normalized, password);
    if (!isAllowedUser(result.user)) {
      await auth.signOut();
      throw new Error('This account is not authorized.');
    }
    return result.user;
  }

  async function logout() {
    await auth.signOut();
    window.location.href = 'login.html';
  }

  function isAuthenticated() {
    const user = auth.currentUser;
    return Boolean(user && isAllowedUser(user));
  }

  function onAuthReady() {
    return new Promise((resolve) => {
      const unsub = auth.onAuthStateChanged((user) => {
        unsub();
        resolve(user);
      });
    });
  }

  async function requireAuth() {
    const user = await onAuthReady();
    if (!isAllowedUser(user)) {
      if (user) {
        await auth.signOut();
      }
      redirectLogin();
    }
  }

  async function sendReset(email) {
    const normalized = normalizeEmail(email);
    if (normalized !== allowedEmail()) {
      throw new Error('Use your allowed account email only.');
    }
    await auth.sendPasswordResetEmail(normalized);
  }

  window.RajanAuth = {
    loginWithEmail,
    logout,
    isAuthenticated,
    requireAuth,
    sendReset,
    allowedEmail,
    onAuthReady,
  };
})();
