const AuthStore = {
  credential: 'rsh_credential_v1',
  username: 'rsh_username_v1',
  session: 'rsh_session_v1',
};

const AuthConfig = {
  iterations: 250000,
  sessionHours: 12,
  tokenPrefix: 'RSH_AUTH_OK',
};

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(password, saltBytes, iterations) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptToken(password, token, iterations) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt, iterations);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(token)
  );
  return {
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    cipher: bytesToBase64(new Uint8Array(cipherBuffer)),
    iterations,
  };
}

async function decryptToken(password, payload) {
  const decoder = new TextDecoder();
  const saltBytes = base64ToBytes(payload.salt);
  const ivBytes = base64ToBytes(payload.iv);
  const cipherBytes = base64ToBytes(payload.cipher);
  const key = await deriveAesKey(password, saltBytes, payload.iterations || AuthConfig.iterations);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    cipherBytes
  );
  return decoder.decode(plainBuffer);
}

function hasCredentials() {
  return Boolean(localStorage.getItem(AuthStore.credential) && localStorage.getItem(AuthStore.username));
}

async function setupCredentials(username, password) {
  const safeUser = String(username || '').trim();
  if (!safeUser || !password) {
    throw new Error('Username and password are required.');
  }

  const token = `${AuthConfig.tokenPrefix}:${safeUser}:${Date.now()}`;
  const encrypted = await encryptToken(password, token, AuthConfig.iterations);
  localStorage.setItem(AuthStore.username, safeUser);
  localStorage.setItem(AuthStore.credential, JSON.stringify(encrypted));
  createSession(safeUser);
}

async function verifyCredentials(username, password) {
  const savedUser = localStorage.getItem(AuthStore.username);
  const payloadRaw = localStorage.getItem(AuthStore.credential);
  if (!savedUser || !payloadRaw) return false;
  if (String(username || '').trim() !== savedUser) return false;

  try {
    const payload = JSON.parse(payloadRaw);
    const plainToken = await decryptToken(password, payload);
    return plainToken.startsWith(`${AuthConfig.tokenPrefix}:${savedUser}:`);
  } catch (error) {
    return false;
  }
}

function createSession(username) {
  const expiresAt = Date.now() + AuthConfig.sessionHours * 60 * 60 * 1000;
  sessionStorage.setItem(
    AuthStore.session,
    JSON.stringify({ username, expiresAt })
  );
}

function getSession() {
  const sessionRaw = sessionStorage.getItem(AuthStore.session);
  if (!sessionRaw) return null;
  try {
    const session = JSON.parse(sessionRaw);
    if (!session.expiresAt || Date.now() > session.expiresAt) {
      sessionStorage.removeItem(AuthStore.session);
      return null;
    }
    return session;
  } catch (error) {
    sessionStorage.removeItem(AuthStore.session);
    return null;
  }
}

function isAuthenticated() {
  return Boolean(getSession());
}

function logout() {
  sessionStorage.removeItem(AuthStore.session);
  window.location.href = 'login.html';
}

function requireAuth() {
  if (!isAuthenticated()) {
    const next = encodeURIComponent(window.location.pathname.split('/').pop() || 'index.html');
    window.location.href = `login.html?next=${next}`;
  }
}

window.RajanAuth = {
  hasCredentials,
  setupCredentials,
  verifyCredentials,
  createSession,
  getSession,
  isAuthenticated,
  logout,
  requireAuth,
};
