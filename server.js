const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { promisify } = require('node:util');
const express = require('express');
const { Pool } = require('pg');
const { WebSocket, WebSocketServer } = require('ws');

const port = Number(process.env.PORT || 3000);
const databaseUrl = process.env.DATABASE_URL;
const scrypt = promisify(crypto.scrypt);
const AUTH_CODE_TTL_MINUTES = 10;
const AUTH_CODE_MAX_ATTEMPTS = 5;
const AUTH_SESSION_TTL_DAYS = 30;
const AUTH_PASSWORD_MIN_LENGTH = 12;
const AUTH_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Configure a Render PostgreSQL database before starting the server.');
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

const app = express();
const server = http.createServer(app);
app.use(express.json({ limit: '16kb' }));
const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
const roomSockets = new Map();
const ROOM_CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PLAYER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;
const MAX_ANSWER_LENGTH = 1000;

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1');
    response.json({ status: 'ok' });
  } catch (error) {
    console.error('Health check failed:', error);
    response.status(503).json({ status: 'unavailable' });
  }
});

app.use('/api/auth', (request, response, next) => {
  const origin = request.get('origin');
  if (origin && new URL(origin).host !== request.get('host')) {
    response.status(403).json({ error: 'Request origin is not allowed.' });
    return;
  }
  next();
});

app.post('/api/auth/register/request', async (request, response) => {
  try {
    const { name, email, dob, password, securityQuestion, securityAnswer } = request.body || {};
    const normalizedEmail = normalizeEmail(email);
    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100 ||
        !normalizedEmail || !AUTH_EMAIL_PATTERN.test(normalizedEmail) ||
        typeof dob !== 'string' || !isValidDate(dob) ||
        !isValidPassword(password) ||
        !['pet', 'city', 'car'].includes(securityQuestion) ||
        typeof securityAnswer !== 'string' || securityAnswer.trim().length < 1 ||
        securityAnswer.trim().length > 200) {
      response.status(400).json({ error: 'Check the account details and password requirements.' });
      return;
    }

    if (!isEmailConfigured()) {
      response.status(503).json({ error: 'Email verification is not configured on the server yet.' });
      return;
    }

    const passwordHash = await hashSecret(password);
    const securityAnswerHash = await hashSecret(securityAnswer.trim().toLowerCase());
    await createAuthEmailCode({
      email: normalizedEmail,
      purpose: 'register',
      payload: {
        name: name.trim(),
        email: normalizedEmail,
        dob,
        passwordHash,
        securityQuestion,
        securityAnswerHash
      }
    });

    response.json({ message: 'A verification code has been sent to your email.' });
  } catch (error) {
    handleAuthRouteError(response, error);
  }
});

app.post('/api/auth/register/complete', async (request, response) => {
  const email = normalizeEmail(request.body?.email);
  const code = request.body?.code;
  if (!email || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    response.status(400).json({ error: 'Enter the email address and six-digit verification code.' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const challenge = await getValidAuthCode(client, email, 'register', code);
    if (!challenge) {
      await client.query('COMMIT');
      response.status(400).json({ error: 'The code is incorrect. Check your email and try again.' });
      return;
    }
    const payload = challenge.payload;
    const { rows } = await client.query(
      `INSERT INTO auth_users
         (name, email, date_of_birth, password_hash, security_question, security_answer_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, tier`,
      [payload.name, payload.email, payload.dob, payload.passwordHash,
        payload.securityQuestion, payload.securityAnswerHash]
    );
    await client.query(
      'DELETE FROM auth_email_codes WHERE email = $1 AND purpose = $2',
      [email, 'register']
    );
    const sessionToken = await createAuthSession(client, rows[0].id);
    await client.query('COMMIT');

    setAuthSessionCookie(response, sessionToken);
    response.status(201).json({ user: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(rollbackError => {
      console.error('Unable to rollback account registration:', rollbackError);
    });
    handleAuthRouteError(response, error);
  } finally {
    client.release();
  }
});

app.post('/api/auth/login', async (request, response) => {
  const email = normalizeEmail(request.body?.email);
  const password = request.body?.password;
  if (!email || typeof password !== 'string' || password.length > 200) {
    response.status(400).json({ error: 'Enter your email and password.' });
    return;
  }

  try {
    await assertLoginNotLocked(email);
    const { rows } = await pool.query(
      'SELECT id, name, email, password_hash, tier FROM auth_users WHERE email = $1',
      [email]
    );
    const user = rows[0];
    if (!user || !(await verifySecret(password, user.password_hash))) {
      await recordFailedLogin(email);
      response.status(401).json({ error: 'Email or password is incorrect.' });
      return;
    }

    await pool.query('DELETE FROM auth_login_limits WHERE email = $1', [email]);
    const sessionToken = await createAuthSession(pool, user.id);
    setAuthSessionCookie(response, sessionToken);
    response.json({ user: { id: user.id, name: user.name, email: user.email, tier: user.tier } });
  } catch (error) {
    handleAuthRouteError(response, error);
  }
});

app.get('/api/auth/demo-accounts', (_request, response) => {
  if (!areDemoAccountsEnabled()) {
    response.sendStatus(404);
    return;
  }

  response.json({
    accounts: [
      { id: 'free', name: 'Demo Free', tier: 'free' },
      { id: 'unlocked', name: 'Demo Premium', tier: 'unlocked' }
    ]
  });
});

app.post('/api/auth/demo-login', async (request, response) => {
  if (!areDemoAccountsEnabled()) {
    response.sendStatus(404);
    return;
  }

  const demoAccounts = {
    free: { name: 'Demo Free', email: 'demo-free@g2ku.test', tier: 'free' },
    unlocked: { name: 'Demo Premium', email: 'demo-premium@g2ku.test', tier: 'unlocked' }
  };
  const accountId = request.body?.accountId;
  const account = accountId === 'free' || accountId === 'unlocked'
    ? demoAccounts[accountId]
    : null;
  if (!account) {
    response.status(400).json({ error: 'Choose a valid demo account.' });
    return;
  }

  try {
    const passwordHash = await hashSecret(crypto.randomBytes(32).toString('base64url'));
    const recoveryHash = await hashSecret(crypto.randomBytes(32).toString('base64url'));
    const { rows } = await pool.query(
      `INSERT INTO auth_users
         (name, email, date_of_birth, password_hash, security_question,
          security_answer_hash, tier, is_demo)
       VALUES ($1, $2, DATE '2000-01-01', $3, 'pet', $4, $5, TRUE)
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name, tier = EXCLUDED.tier
         WHERE auth_users.is_demo = TRUE
       RETURNING id, name, email, tier`,
      [account.name, account.email, passwordHash, recoveryHash, account.tier]
    );
    if (!rows[0]) {
      response.status(409).json({ error: 'The demo account email is already used by a non-demo account.' });
      return;
    }

    const sessionToken = await createAuthSession(pool, rows[0].id);
    setAuthSessionCookie(response, sessionToken);
    response.json({ user: rows[0] });
  } catch (error) {
    handleAuthRouteError(response, error);
  }
});

app.post('/api/auth/recovery/request', async (request, response) => {
  try {
    const email = normalizeEmail(request.body?.email);
    const dob = request.body?.dob;
    const securityQuestion = request.body?.securityQuestion;
    const securityAnswer = request.body?.securityAnswer;
    if (!email || !AUTH_EMAIL_PATTERN.test(email) || typeof dob !== 'string' ||
        !isValidDate(dob) || !['pet', 'city', 'car'].includes(securityQuestion) ||
        typeof securityAnswer !== 'string' || !securityAnswer.trim()) {
      response.status(400).json({ error: 'Enter the registered email and recovery details.' });
      return;
    }
    if (!isEmailConfigured()) {
      response.status(503).json({ error: 'Email verification is not configured on the server yet.' });
      return;
    }

    await assertLoginNotLocked(email);
    const { rows } = await pool.query(
      `SELECT security_answer_hash
         FROM auth_users
        WHERE email = $1 AND date_of_birth = $2 AND security_question = $3`,
      [email, dob, securityQuestion]
    );
    if (!rows[0] || !(await verifySecret(securityAnswer.trim().toLowerCase(), rows[0].security_answer_hash))) {
      await recordFailedLogin(email);
      response.status(400).json({ error: 'The recovery details did not match this account.' });
      return;
    }

    await createAuthEmailCode({ email, purpose: 'reset' });
    await pool.query('DELETE FROM auth_login_limits WHERE email = $1', [email]);
    response.json({ message: 'A password reset code has been sent to the registered email.' });
  } catch (error) {
    handleAuthRouteError(response, error);
  }
});

app.post('/api/auth/recovery/complete', async (request, response) => {
  const email = normalizeEmail(request.body?.email);
  const code = request.body?.code;
  const password = request.body?.password;
  if (!email || typeof code !== 'string' || !/^\d{6}$/.test(code) ||
      !isValidPassword(password)) {
    response.status(400).json({
      error: `Enter the six-digit code and a password of at least ${AUTH_PASSWORD_MIN_LENGTH} characters.`
    });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const challenge = await getValidAuthCode(client, email, 'reset', code);
    if (!challenge) {
      await client.query('COMMIT');
      response.status(400).json({ error: 'The code is incorrect. Check your email and try again.' });
      return;
    }
    const passwordHash = await hashSecret(password);
    const { rowCount } = await client.query(
      'UPDATE auth_users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
      [passwordHash, email]
    );
    if (rowCount !== 1) {
      throw new AuthError(400, 'The reset code is invalid or expired.');
    }
    await client.query('DELETE FROM auth_email_codes WHERE email = $1 AND purpose = $2', [email, 'reset']);
    await client.query('DELETE FROM auth_sessions WHERE user_id = (SELECT id FROM auth_users WHERE email = $1)', [email]);
    await client.query('DELETE FROM auth_login_limits WHERE email = $1', [email]);
    await client.query('COMMIT');

    clearAuthSessionCookie(response);
    response.json({ message: 'Password reset. You can now sign in with your new password.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(rollbackError => {
      console.error('Unable to rollback password reset:', rollbackError);
    });
    handleAuthRouteError(response, error);
  } finally {
    client.release();
  }
});

app.get('/api/auth/session', async (request, response) => {
  try {
    const token = getAuthSessionToken(request);
    if (!token) {
      response.status(401).json({ error: 'Sign in is required.' });
      return;
    }

    const { rows } = await pool.query(
      `SELECT users.id, users.name, users.email, users.tier
         FROM auth_sessions sessions
         JOIN auth_users users ON users.id = sessions.user_id
        WHERE sessions.token_hash = $1 AND sessions.expires_at > NOW()`,
      [hashToken(token)]
    );
    if (!rows[0]) {
      clearAuthSessionCookie(response);
      response.status(401).json({ error: 'Your session expired. Please sign in again.' });
      return;
    }

    response.json({ user: rows[0] });
  } catch (error) {
    handleAuthRouteError(response, error);
  }
});

app.get('/api/auth/history', async (request, response) => {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      clearAuthSessionCookie(response);
      response.status(401).json({ error: 'Sign in to view your saved history.' });
      return;
    }

    const { rows } = await pool.query(
      `SELECT room_code, round_index, question_id, prompt, own_answer,
              partner_answer, private_vibe_check, created_at
         FROM account_room_history
        WHERE user_id = $1
        ORDER BY created_at DESC, room_code, round_index DESC
        LIMIT 200`,
      [user.id]
    );
    response.json({ history: rows });
  } catch (error) {
    handleAuthRouteError(response, error);
  }
});

app.get('/api/auth/rooms', async (request, response) => {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      clearAuthSessionCookie(response);
      response.status(401).json({ error: 'Sign in to view your rooms.' });
      return;
    }

    const { rows } = await pool.query(
      `SELECT code AS room_code, tier, round_index,
              CASE WHEN host_user_id = $1 THEN 'host' ELSE 'guest' END AS role,
              (guest_player_id IS NOT NULL) AS paired,
              created_at
         FROM rooms
        WHERE (host_user_id = $1 OR guest_user_id = $1)
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 25`,
      [user.id]
    );
    response.json({
      rooms: rows.map(room => ({
        ...room,
        card_limit: getRoomCardLimit(room.tier),
        status: !room.paired
          ? 'waiting'
          : room.round_index >= getRoomCardLimit(room.tier)
            ? 'completed'
            : 'paired'
      }))
    });
  } catch (error) {
    handleAuthRouteError(response, error);
  }
});

app.post('/api/auth/logout', async (request, response) => {
  try {
    const token = getAuthSessionToken(request);
    if (token) {
      await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [hashToken(token)]);
    }
    clearAuthSessionCookie(response);
    response.sendStatus(204);
  } catch (error) {
    handleAuthRouteError(response, error);
  }
});

app.use((request, response, next) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const segments = pathname.split('/').filter(Boolean);
  const privateFiles = new Set(['server.js', 'package.json', 'package-lock.json']);

  if (segments.some(segment => segment === 'node_modules' || segment === '.git') ||
      segments.some(segment => privateFiles.has(segment))) {
    response.sendStatus(404);
    return;
  }

  next();
});

app.use(express.static(__dirname, { dotfiles: 'deny', extensions: ['html'] }));

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const origin = request.headers.origin;

  if (pathname !== '/ws' ||
      (origin && new URL(origin).host !== request.headers.host)) {
    socket.destroy();
    return;
  }

  void (async () => {
    try {
      const user = await getAuthenticatedUser(request);
      webSocketServer.handleUpgrade(request, socket, head, webSocket => {
        webSocket.authUserId = user?.id || null;
        webSocket.authUserTier = user?.tier || 'free';
        webSocketServer.emit('connection', webSocket, request);
      });
    } catch (error) {
      console.error('Unable to authenticate a room connection:', error);
      socket.destroy();
    }
  })();
});

webSocketServer.on('connection', webSocket => {
  webSocket.on('message', rawMessage => {
    void handleMessage(webSocket, rawMessage);
  });

  webSocket.on('close', () => {
    detachSocket(webSocket);
  });

  webSocket.on('error', error => {
    console.error('WebSocket error:', error);
    detachSocket(webSocket);
  });
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      date_of_birth DATE NOT NULL,
      password_hash TEXT NOT NULL,
      security_question TEXT NOT NULL CHECK (security_question IN ('pet', 'city', 'car')),
      security_answer_hash TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'tier_30_day', 'unlocked')),
      is_demo BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE auth_users
      ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'
        CHECK (tier IN ('free', 'tier_30_day', 'unlocked')),
      ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_email_codes (
      email TEXT NOT NULL,
      purpose TEXT NOT NULL CHECK (purpose IN ('register', 'reset')),
      code_hash TEXT NOT NULL,
      payload JSONB,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (email, purpose)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_login_limits (
      email TEXT PRIMARY KEY,
      failures INTEGER NOT NULL DEFAULT 0,
      window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      locked_until TIMESTAMPTZ
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY,
      host_player_id TEXT NOT NULL,
      guest_player_id TEXT,
      host_user_id BIGINT REFERENCES auth_users(id) ON DELETE SET NULL,
      guest_user_id BIGINT REFERENCES auth_users(id) ON DELETE SET NULL,
      tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'tier_30_day', 'unlocked')),
      round_index INTEGER NOT NULL DEFAULT 0 CHECK (round_index >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
    )
  `);
  await pool.query(`
    ALTER TABLE rooms
      ADD COLUMN IF NOT EXISTS host_user_id BIGINT REFERENCES auth_users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS guest_user_id BIGINT REFERENCES auth_users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'
        CHECK (tier IN ('free', 'tier_30_day', 'unlocked'))
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS room_answers (
      room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
      round_index INTEGER NOT NULL,
      player_id TEXT NOT NULL,
      answer TEXT NOT NULL,
      question_id TEXT NOT NULL DEFAULT '',
      prompt TEXT NOT NULL DEFAULT '',
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (room_code, round_index, player_id)
    )
  `);
  await pool.query(`
    ALTER TABLE room_answers
      ADD COLUMN IF NOT EXISTS question_id TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS prompt TEXT NOT NULL DEFAULT ''
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS account_room_history (
      user_id BIGINT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      room_code TEXT NOT NULL,
      round_index INTEGER NOT NULL CHECK (round_index >= 0),
      question_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      own_answer TEXT NOT NULL,
      partner_answer TEXT NOT NULL,
      private_vibe_check TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, room_code, round_index)
    )
  `);

  await pool.query('DELETE FROM rooms WHERE expires_at <= NOW()');
}

class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function areDemoAccountsEnabled() {
  return process.env.NODE_ENV === 'development' &&
    process.env.ENABLE_DEMO_ACCOUNTS === 'true';
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) &&
    date.toISOString().slice(0, 10) === value &&
    date <= new Date();
}

function isValidPassword(password) {
  return typeof password === 'string' &&
    password.length >= AUTH_PASSWORD_MIN_LENGTH &&
    password.length <= 200;
}

async function hashSecret(secret) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scrypt(secret, salt, 64, {
    N: 32_768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  });
  return `scrypt$32768$8$1$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
}

async function verifySecret(secret, encodedHash) {
  if (typeof encodedHash !== 'string') return false;
  const [algorithm, n, r, p, saltValue, keyValue] = encodedHash.split('$');
  if (algorithm !== 'scrypt' || n !== '32768' || r !== '8' || p !== '1' || !saltValue || !keyValue) {
    return false;
  }

  const salt = Buffer.from(saltValue, 'base64url');
  const expectedKey = Buffer.from(keyValue, 'base64url');
  if (salt.length !== 16 || expectedKey.length !== 64) return false;

  const derivedKey = await scrypt(secret, salt, expectedKey.length, {
    N: 32_768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  });
  return crypto.timingSafeEqual(derivedKey, expectedKey);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

async function sendAuthCodeEmail(email, code, purpose) {
  const subject = purpose === 'register' ? 'Your Getting2KU verification code' : 'Your Getting2KU password reset code';
  const action = purpose === 'register' ? 'verify your email and create your account' : 'reset your password';
  const result = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [email],
      subject,
      text: `Your Getting2KU code is ${code}. Enter it to ${action}. It expires in ${AUTH_CODE_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.`
    }),
    signal: AbortSignal.timeout(10_000)
  });

  if (!result.ok) {
    const responseText = await result.text();
    console.error('Resend rejected an authentication email:', result.status, responseText);
    throw new AuthError(503, 'We could not send the verification email. Please try again later.');
  }
}

async function createAuthEmailCode({ email, purpose, payload = null }) {
  const recentCode = await pool.query(
    `SELECT 1 FROM auth_email_codes
      WHERE email = $1 AND purpose = $2 AND created_at > NOW() - INTERVAL '60 seconds'`,
    [email, purpose]
  );
  if (recentCode.rowCount) {
    throw new AuthError(429, 'Please wait one minute before requesting another email code.');
  }

  const code = String(crypto.randomInt(100_000, 1_000_000));
  await pool.query(
    `INSERT INTO auth_email_codes (email, purpose, code_hash, payload, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + ($5 * INTERVAL '1 minute'))
     ON CONFLICT (email, purpose) DO UPDATE
       SET code_hash = EXCLUDED.code_hash,
           payload = EXCLUDED.payload,
           attempts = 0,
           created_at = NOW(),
           expires_at = EXCLUDED.expires_at`,
    [email, purpose, hashToken(code), payload ? JSON.stringify(payload) : null, AUTH_CODE_TTL_MINUTES]
  );

  try {
    await sendAuthCodeEmail(email, code, purpose);
  } catch (error) {
    await pool.query('DELETE FROM auth_email_codes WHERE email = $1 AND purpose = $2', [email, purpose]);
    throw error;
  }
}

async function getValidAuthCode(client, email, purpose, code) {
  const { rows } = await client.query(
    `SELECT code_hash, payload, attempts, expires_at > NOW() AS is_valid
       FROM auth_email_codes
      WHERE email = $1 AND purpose = $2
      FOR UPDATE`,
    [email, purpose]
  );
  const challenge = rows[0];
  if (!challenge || !challenge.is_valid) {
    throw new AuthError(400, 'The code is invalid or expired. Request a new one and try again.');
  }
  if (challenge.attempts >= AUTH_CODE_MAX_ATTEMPTS) {
    throw new AuthError(429, 'Too many incorrect codes. Request a new code and try again.');
  }
  if (hashToken(code) !== challenge.code_hash) {
    await client.query(
      'UPDATE auth_email_codes SET attempts = attempts + 1 WHERE email = $1 AND purpose = $2',
      [email, purpose]
    );
    return null;
  }
  return challenge;
}

async function createAuthSession(database, userId) {
  const sessionToken = crypto.randomBytes(32).toString('base64url');
  await database.query(
    `INSERT INTO auth_sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 day'))`,
    [hashToken(sessionToken), userId, AUTH_SESSION_TTL_DAYS]
  );
  return sessionToken;
}

function getCookies(request) {
  return Object.fromEntries((request.headers.cookie || '')
    .split(';')
    .map(cookie => cookie.trim().split('='))
    .filter(([name, value]) => name && value));
}

function getAuthSessionToken(request) {
  return getCookies(request).g2ku_session;
}

async function getAuthenticatedUser(request) {
  const token = getAuthSessionToken(request);
  if (!token) return null;

  const { rows } = await pool.query(
    `SELECT users.id, users.name, users.email, users.tier
       FROM auth_sessions sessions
       JOIN auth_users users ON users.id = sessions.user_id
      WHERE sessions.token_hash = $1 AND sessions.expires_at > NOW()`,
    [hashToken(token)]
  );
  return rows[0] || null;
}

function setAuthSessionCookie(response, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader(
    'Set-Cookie',
    `g2ku_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${AUTH_SESSION_TTL_DAYS * 24 * 60 * 60}${secure}`
  );
}

function clearAuthSessionCookie(response) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('Set-Cookie', `g2ku_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
}

async function assertLoginNotLocked(email) {
  const { rows } = await pool.query(
    `SELECT locked_until > NOW() AS is_locked
       FROM auth_login_limits
      WHERE email = $1`,
    [email]
  );
  if (rows[0]?.is_locked) {
    throw new AuthError(429, 'Too many sign-in attempts. Please wait 15 minutes and try again.');
  }
}

async function recordFailedLogin(email) {
  await pool.query(
    `INSERT INTO auth_login_limits (email, failures, window_started_at)
     VALUES ($1, 1, NOW())
     ON CONFLICT (email) DO UPDATE SET
       failures = CASE
         WHEN auth_login_limits.window_started_at < NOW() - INTERVAL '15 minutes' THEN 1
         ELSE auth_login_limits.failures + 1
       END,
       window_started_at = CASE
         WHEN auth_login_limits.window_started_at < NOW() - INTERVAL '15 minutes' THEN NOW()
         ELSE auth_login_limits.window_started_at
       END,
       locked_until = CASE
         WHEN (CASE
           WHEN auth_login_limits.window_started_at < NOW() - INTERVAL '15 minutes' THEN 1
           ELSE auth_login_limits.failures + 1
         END) >= 5 THEN NOW() + INTERVAL '15 minutes'
         ELSE NULL
       END`,
    [email]
  );
}

function handleAuthRouteError(response, error) {
  if (error.code === '23505') {
    response.status(409).json({ error: 'An account already exists for that email.' });
    return;
  }
  if (error.code) {
    console.error('Authentication database request failed:', error);
    response.status(503).json({ error: 'The account service is temporarily unavailable.' });
    return;
  }
  const status = error instanceof AuthError ? error.status : 500;
  if (status === 500) console.error('Authentication request failed:', error);
  response.status(status).json({
    error: status === 500 ? 'The account request failed. Please try again later.' : error.message
  });
}

function send(webSocket, message) {
  if (webSocket.readyState === WebSocket.OPEN) {
    webSocket.send(JSON.stringify(message));
  }
}

function respond(webSocket, requestId, type, data = {}) {
  send(webSocket, { requestId, type, ...data });
}

function fail(webSocket, requestId, message) {
  respond(webSocket, requestId, 'error', { message });
}

function getRoomSockets(code) {
  let sockets = roomSockets.get(code);
  if (!sockets) {
    sockets = new Set();
    roomSockets.set(code, sockets);
  }
  return sockets;
}

function attachSocket(webSocket, code, playerId) {
  detachSocket(webSocket);
  webSocket.roomCode = code;
  webSocket.playerId = playerId;
  getRoomSockets(code).add(webSocket);
}

function detachSocket(webSocket) {
  const code = webSocket.roomCode;
  if (!code) return;

  const sockets = roomSockets.get(code);
  if (sockets) {
    sockets.delete(webSocket);
    if (sockets.size === 0) roomSockets.delete(code);
  }
  webSocket.roomCode = undefined;
  webSocket.playerId = undefined;
}

function generateRoomCode() {
  return Array.from({ length: 8 }, () =>
    ROOM_CODE_CHARACTERS[crypto.randomInt(ROOM_CODE_CHARACTERS.length)]
  ).join('');
}

function validatePlayerId(playerId) {
  return typeof playerId === 'string' && PLAYER_ID_PATTERN.test(playerId);
}

function getRoomCardLimit(tier) {
  if (tier === 'tier_30_day') return 15;
  if (tier === 'unlocked') return 50;
  return 5;
}

async function getRoomState(code, playerId, userId) {
  const { rows } = await pool.query(
    `SELECT rooms.code, rooms.host_player_id, rooms.guest_player_id,
            rooms.host_user_id, rooms.guest_user_id, rooms.tier, rooms.round_index,
            host_user.name AS host_name, guest_user.name AS guest_name
       FROM rooms
       LEFT JOIN auth_users host_user ON host_user.id = rooms.host_user_id
       LEFT JOIN auth_users guest_user ON guest_user.id = rooms.guest_user_id
      WHERE rooms.code = $1 AND rooms.expires_at > NOW()`,
    [code]
  );
  const room = rows[0];
  if (!room) throw new Error('Room not found or expired.');

  const isHost = room.host_player_id === playerId;
  const isGuest = room.guest_player_id === playerId;
  if (!isHost && !isGuest) throw new Error('This player is not a member of that room.');
  const expectedUserId = isHost ? room.host_user_id : room.guest_user_id;
  if (expectedUserId && String(expectedUserId) !== String(userId)) {
    throw new Error('Sign in to the account that joined this room.');
  }

  const { rows: answerRows } = await pool.query(
    `SELECT player_id, answer
       FROM room_answers
      WHERE room_code = $1 AND round_index = $2`,
    [code, room.round_index]
  );
  const paired = Boolean(room.guest_player_id);
  const revealed = paired && answerRows.length === 2;
  const completed = paired && room.round_index >= getRoomCardLimit(room.tier);
  const { rows: vibeRows } = userId
    ? await pool.query(
        `SELECT 1
           FROM account_room_history
          WHERE user_id = $1 AND room_code = $2 AND round_index = $3
            AND private_vibe_check IS NOT NULL`,
        [userId, code, room.round_index]
      )
    : { rows: [] };

  return {
    roomCode: room.code,
    status: completed ? 'completed' : paired ? 'paired' : 'waiting',
    role: isHost ? 'host' : 'guest',
    tier: room.tier,
    playerName: isHost ? room.host_name : room.guest_name,
    partnerName: isHost ? room.guest_name : room.host_name,
    isSignedIn: Boolean(userId),
    roundIndex: room.round_index,
    cardLimit: getRoomCardLimit(room.tier),
    answerCount: answerRows.length,
    hasSubmitted: answerRows.some(answer => answer.player_id === playerId),
    hasVibeCheck: vibeRows.length > 0,
    revealedAnswers: revealed
      ? answerRows.map(answer => ({
          role: answer.player_id === room.host_player_id ? 'host' : 'guest',
          answer: answer.answer
        }))
      : null
  };
}

async function publishRoomState(code) {
  const sockets = roomSockets.get(code);
  if (!sockets) return;

  const participants = [...sockets];
  for (const webSocket of participants) {
    try {
      const state = await getRoomState(code, webSocket.playerId, webSocket.authUserId);
      send(webSocket, { type: 'room_state', state });
    } catch (error) {
      console.error(`Unable to publish room state for ${code}:`, error);
      fail(webSocket, undefined, error.message);
    }
  }
}

async function createRoom(webSocket, requestId, message) {
  if (!validatePlayerId(message.playerId)) throw new Error('Invalid player ID.');

  await pool.query(`DELETE FROM rooms WHERE expires_at <= NOW()`);

  let code;
  for (let attempt = 0; attempt < 5; attempt++) {
    code = generateRoomCode();
    try {
      await pool.query(
        `INSERT INTO rooms (code, host_player_id, host_user_id, tier)
         VALUES ($1, $2, $3, $4)`,
        [code, message.playerId, webSocket.authUserId, webSocket.authUserTier]
      );
      break;
    } catch (error) {
      if (error.code !== '23505' || attempt === 4) throw error;
    }
  }

  attachSocket(webSocket, code, message.playerId);
  const state = await getRoomState(code, message.playerId, webSocket.authUserId);
  respond(webSocket, requestId, 'room_created', { state });
}

async function joinRoom(webSocket, requestId, message) {
  const code = typeof message.roomCode === 'string' ? message.roomCode.toUpperCase() : '';
  if (!ROOM_CODE_PATTERN.test(code)) throw new Error('Enter a valid 8-character room code.');
  if (!validatePlayerId(message.playerId)) throw new Error('Invalid player ID.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT host_player_id, guest_player_id, host_user_id, guest_user_id
         FROM rooms WHERE code = $1 AND expires_at > NOW() FOR UPDATE`,
      [code]
    );
    const room = rows[0];
    if (!room) throw new Error('Room not found or expired.');
    if (room.host_player_id === message.playerId) {
      throw new Error('This device created the room. Open the invite on the other player’s device.');
    }
    if (webSocket.authUserId && room.host_user_id &&
        String(room.host_user_id) === String(webSocket.authUserId)) {
      throw new Error('Join from a different account to play against another user.');
    }
    if (room.guest_player_id && room.guest_player_id !== message.playerId) {
      throw new Error('This room already has two players.');
    }
    if (!room.guest_player_id) {
      await client.query(
        'UPDATE rooms SET guest_player_id = $2, guest_user_id = $3 WHERE code = $1',
        [code, message.playerId, webSocket.authUserId]
      );
    } else if (webSocket.authUserId && !room.guest_user_id) {
      await client.query(
        'UPDATE rooms SET guest_user_id = $3 WHERE code = $1 AND guest_player_id = $2',
        [code, message.playerId, webSocket.authUserId]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  attachSocket(webSocket, code, message.playerId);
  const state = await getRoomState(code, message.playerId, webSocket.authUserId);
  respond(webSocket, requestId, 'room_joined', { state });
  await publishRoomState(code);
}

async function resumeRoom(webSocket, requestId, message) {
  const code = typeof message.roomCode === 'string' ? message.roomCode.toUpperCase() : '';
  if (!ROOM_CODE_PATTERN.test(code)) throw new Error('Enter a valid 8-character room code.');
  if (!validatePlayerId(message.playerId)) throw new Error('Invalid player ID.');

  let playerId = message.playerId;
  if (webSocket.authUserId) {
    await pool.query(
      `UPDATE rooms
          SET host_user_id = $3
        WHERE code = $1 AND host_player_id = $2 AND host_user_id IS NULL
          AND (guest_user_id IS NULL OR guest_user_id <> $3)`,
      [code, message.playerId, webSocket.authUserId]
    );
    await pool.query(
      `UPDATE rooms
          SET guest_user_id = $3
        WHERE code = $1 AND guest_player_id = $2 AND guest_user_id IS NULL
          AND (host_user_id IS NULL OR host_user_id <> $3)`,
      [code, message.playerId, webSocket.authUserId]
    );
    const { rows } = await pool.query(
      `SELECT host_player_id, guest_player_id, host_user_id, guest_user_id
         FROM rooms
        WHERE code = $1 AND expires_at > NOW()
          AND (host_user_id = $2 OR guest_user_id = $2)`,
      [code, webSocket.authUserId]
    );
    if (rows[0]) {
      playerId = String(rows[0].host_user_id) === String(webSocket.authUserId)
        ? rows[0].host_player_id
        : rows[0].guest_player_id;
    }
  }

  const state = await getRoomState(code, playerId, webSocket.authUserId);
  attachSocket(webSocket, code, playerId);
  respond(webSocket, requestId, 'room_resumed', { state });
  await publishRoomState(code);
}

async function submitAnswer(webSocket, requestId, message) {
  const code = webSocket.roomCode;
  const playerId = webSocket.playerId;
  if (!code || !playerId) throw new Error('Join a room before submitting an answer.');
  if (typeof message.answer !== 'string' || !message.answer.trim() ||
      message.answer.length > MAX_ANSWER_LENGTH) {
    throw new Error(`Answer must contain 1 to ${MAX_ANSWER_LENGTH} characters.`);
  }
  if (typeof message.questionId !== 'string' || !message.questionId.trim() ||
      message.questionId.length > 200 ||
      typeof message.prompt !== 'string' || !message.prompt.trim() ||
      message.prompt.length > 2000) {
    throw new Error('The current question is invalid. Refresh the room and try again.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: rooms } = await client.query(
      `SELECT host_player_id, guest_player_id, host_user_id, guest_user_id,
              round_index, tier
         FROM rooms
        WHERE code = $1 AND expires_at > NOW()
        FOR UPDATE`,
      [code]
    );
    const room = rooms[0];
    if (!room || !room.guest_player_id) {
      throw new Error('Wait for your partner to join before answering.');
    }
    const isHost = room.host_player_id === playerId;
    const isGuest = room.guest_player_id === playerId;
    if (!isHost && !isGuest) throw new Error('This player is not a member of that room.');
    if (room.round_index >= getRoomCardLimit(room.tier)) {
      throw new Error('This room has completed its card pass.');
    }
    const expectedUserId = isHost ? room.host_user_id : room.guest_user_id;
    if (expectedUserId && String(expectedUserId) !== String(webSocket.authUserId)) {
      throw new Error('Sign in to the account that joined this room.');
    }

    const { rows: previousAnswers } = await client.query(
      `SELECT question_id, prompt FROM room_answers
        WHERE room_code = $1 AND round_index = $2`,
      [code, room.round_index]
    );
    if (previousAnswers.some(answer =>
      answer.question_id !== message.questionId || answer.prompt !== message.prompt
    )) {
      throw new Error('Players received different cards. Refresh the room before answering.');
    }

    const { rows: inserted } = await client.query(
      `INSERT INTO room_answers
         (room_code, round_index, player_id, answer, question_id, prompt)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING
       RETURNING player_id`,
      [code, room.round_index, playerId, message.answer.trim(),
        message.questionId, message.prompt]
    );
    if (inserted.length === 0) {
      throw new Error('You already answered this card.');
    }

    const { rows: answerRows } = await client.query(
      `SELECT player_id, answer, question_id, prompt
         FROM room_answers
        WHERE room_code = $1 AND round_index = $2`,
      [code, room.round_index]
    );
    if (answerRows.length === 2) {
      const hostAnswer = answerRows.find(answer => answer.player_id === room.host_player_id);
      const guestAnswer = answerRows.find(answer => answer.player_id === room.guest_player_id);
      if (!hostAnswer || !guestAnswer) throw new Error('Room answers are incomplete.');

      for (const [userId, ownAnswer, partnerAnswer] of [
        [room.host_user_id, hostAnswer, guestAnswer],
        [room.guest_user_id, guestAnswer, hostAnswer]
      ]) {
        if (!userId) continue;
        await client.query(
          `INSERT INTO account_room_history
             (user_id, room_code, round_index, question_id, prompt,
              own_answer, partner_answer)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, room_code, round_index) DO NOTHING`,
          [userId, code, room.round_index, ownAnswer.question_id,
            ownAnswer.prompt, ownAnswer.answer, partnerAnswer.answer]
        );
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  respond(webSocket, requestId, 'answer_saved');
  await publishRoomState(code);
}

async function saveVibeCheck(webSocket, requestId, message) {
  const code = webSocket.roomCode;
  const playerId = webSocket.playerId;
  const userId = webSocket.authUserId;
  const choices = new Set(['Marry them ❤️', 'Ghost them 👻', 'Like & Subscribe 🔔']);
  if (!code || !playerId) throw new Error('Join a room before saving a vibe check.');
  if (!userId) throw new Error('Sign in to save a private vibe check to your history.');
  if (!Number.isInteger(message.roundIndex) || !choices.has(message.choice)) {
    throw new Error('Choose a valid private vibe check.');
  }

  const { rows } = await pool.query(
    `UPDATE account_room_history history
        SET private_vibe_check = $1
       FROM rooms
      WHERE rooms.code = $2
        AND rooms.expires_at > NOW()
        AND rooms.guest_player_id IS NOT NULL
        AND history.user_id = $3
        AND history.room_code = rooms.code
        AND history.round_index = $4
        AND history.round_index = rooms.round_index
        AND ((rooms.host_player_id = $5 AND rooms.host_user_id = $3)
          OR (rooms.guest_player_id = $5 AND rooms.guest_user_id = $3))
      RETURNING history.room_code`,
    [message.choice, code, userId, message.roundIndex, playerId]
  );
  if (rows.length === 0) {
    throw new Error('This card has no saved answer for your account.');
  }

  respond(webSocket, requestId, 'vibe_check_saved');
  await publishRoomState(code);
}

async function advanceRound(webSocket, requestId) {
  const code = webSocket.roomCode;
  if (!code || !webSocket.playerId) throw new Error('Join a room before advancing.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT host_player_id, guest_player_id, round_index, tier FROM rooms WHERE code = $1 AND expires_at > NOW() FOR UPDATE',
      [code]
    );
    const room = rows[0];
    if (!room) throw new Error('Room not found or expired.');
    if (room.host_player_id !== webSocket.playerId) throw new Error('Only the host can start the next card.');
    if (!room.guest_player_id) throw new Error('Wait for the other player to join.');

    const { rows: answerRows } = await client.query(
      'SELECT COUNT(*)::INTEGER AS count FROM room_answers WHERE room_code = $1 AND round_index = $2',
      [code, room.round_index]
    );
    if (answerRows[0].count !== 2) throw new Error('Both players must answer before continuing.');
    if (room.round_index >= getRoomCardLimit(room.tier)) {
      throw new Error('This room has completed its card pass.');
    }

    await client.query('DELETE FROM room_answers WHERE room_code = $1', [code]);
    await client.query(
      'UPDATE rooms SET round_index = round_index + 1 WHERE code = $1',
      [code]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  respond(webSocket, requestId, 'round_advanced');
  await publishRoomState(code);
}

async function handleMessage(webSocket, rawMessage) {
  let message;
  try {
    message = JSON.parse(rawMessage.toString());
  } catch {
    fail(webSocket, undefined, 'Invalid message format.');
    return;
  }

  const requestId = typeof message.requestId === 'string' ? message.requestId : undefined;
  try {
    switch (message.type) {
      case 'create_room':
        await createRoom(webSocket, requestId, message);
        break;
      case 'join_room':
        await joinRoom(webSocket, requestId, message);
        break;
      case 'resume_room':
        await resumeRoom(webSocket, requestId, message);
        break;
      case 'submit_answer':
        await submitAnswer(webSocket, requestId, message);
        break;
      case 'save_vibe_check':
        await saveVibeCheck(webSocket, requestId, message);
        break;
      case 'advance_round':
        await advanceRound(webSocket, requestId);
        break;
      default:
        throw new Error('Unknown room action.');
    }
  } catch (error) {
    if (error.code) {
      console.error('Room operation failed:', error);
      fail(webSocket, requestId, 'The room service encountered a database error. Please try again.');
      return;
    }
    fail(webSocket, requestId, error.message);
  }
}

const publicRoot = path.resolve(__dirname);
if (!fs.existsSync(path.join(publicRoot, 'index.html'))) {
  throw new Error('index.html is required in the project root.');
}

initializeDatabase()
  .then(() => {
    const cleanupTimer = setInterval(() => {
      pool.query('DELETE FROM rooms WHERE expires_at <= NOW()')
        .catch(error => console.error('Unable to remove expired rooms:', error));
    }, 60 * 60 * 1000);
    cleanupTimer.unref();

    server.listen(port, '0.0.0.0', () => {
      console.log(`Getting2KU server listening on port ${port}`);
    });
  })
  .catch(error => {
    console.error('Unable to initialize the database:', error);
    process.exitCode = 1;
  });
