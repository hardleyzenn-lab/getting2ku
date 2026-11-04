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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const passwordHash = await hashSecret(crypto.randomBytes(32).toString('base64url'));
    const recoveryHash = await hashSecret(crypto.randomBytes(32).toString('base64url'));
    const { rows } = await client.query(
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
      await client.query('COMMIT');
      response.status(409).json({ error: 'The demo account email is already used by a non-demo account.' });
      return;
    }

    await client.query(`
      DELETE FROM account_room_history history
      USING auth_users users
      WHERE history.user_id = users.id AND users.is_demo = TRUE
    `);
    const sessionToken = await createAuthSession(client, rows[0].id);
    await client.query('COMMIT');

    setAuthSessionCookie(response, sessionToken);
    response.json({ user: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(rollbackError => {
      console.error('Unable to rollback demo account reset:', rollbackError);
    });
    handleAuthRouteError(response, error);
  } finally {
    client.release();
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
      `SELECT history.room_code, history.round_index, history.question_id,
              history.prompt, history.category, history.own_answer,
              history.partner_answer, history.player_name, history.partner_name,
              history.partner_id,
              COALESCE(names.room_name, 'Room #' || history.room_code) AS room_name,
              history.session_created_at, history.session_completed,
              history.answered_at, history.created_at
         FROM account_room_history history
         LEFT JOIN account_room_names names
           ON names.user_id = history.user_id
          AND names.room_code = history.room_code
        WHERE history.user_id = $1
        ORDER BY COALESCE(history.session_created_at, history.created_at) DESC,
                 history.room_code, history.round_index DESC
        LIMIT 200`,
      [user.id]
    );
    response.json({ history: rows });
  } catch (error) {
    handleAuthRouteError(response, error);
  }
});

app.get('/api/auth/rooms/:roomCode/name', async (request, response) => {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      clearAuthSessionCookie(response);
      response.status(401).json({ error: 'Sign in to view your private room name.' });
      return;
    }

    const roomCode = request.params.roomCode.toUpperCase();
    if (!ROOM_CODE_PATTERN.test(roomCode)) {
      response.status(400).json({ error: 'Enter a valid room code.' });
      return;
    }

    const { rows } = await pool.query(
      `SELECT COALESCE(names.room_name, 'Room #' || rooms.code) AS room_name
         FROM rooms
         LEFT JOIN account_room_names names
           ON names.room_code = rooms.code AND names.user_id = $2
        WHERE rooms.code = $1
          AND (rooms.host_user_id = $2 OR rooms.guest_user_id = $2)`,
      [roomCode, user.id]
    );
    if (rows.length === 0) {
      response.status(404).json({ error: 'This room is not linked to your account.' });
      return;
    }
    response.json({ roomName: rows[0].room_name });
  } catch (error) {
    handleAuthRouteError(response, error);
  }
});

app.patch('/api/auth/rooms/:roomCode/name', async (request, response) => {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      clearAuthSessionCookie(response);
      response.status(401).json({ error: 'Sign in to save your private room name.' });
      return;
    }

    const roomCode = request.params.roomCode.toUpperCase();
    const requestedName = request.body?.roomName;
    if (!ROOM_CODE_PATTERN.test(roomCode) ||
        typeof requestedName !== 'string' || requestedName.trim().length > 100) {
      response.status(400).json({ error: 'Enter a room name of 100 characters or fewer.' });
      return;
    }

    const roomName = requestedName.trim() || `Room #${roomCode}`;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT 1 FROM rooms
          WHERE code = $1 AND (host_user_id = $2 OR guest_user_id = $2)
          FOR UPDATE`,
        [roomCode, user.id]
      );
      let isAuthorized = rows.length > 0;
      if (!isAuthorized) {
        const { rows: historyRows } = await client.query(
          `SELECT 1 FROM account_room_history
            WHERE room_code = $1 AND user_id = $2
            LIMIT 1`,
          [roomCode, user.id]
        );
        isAuthorized = historyRows.length > 0;
      }
      if (!isAuthorized) {
        await client.query('ROLLBACK');
        response.status(404).json({ error: 'This room is not linked to your account history.' });
        return;
      }

      await client.query(
        `INSERT INTO account_room_names (user_id, room_code, room_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, room_code) DO UPDATE
           SET room_name = EXCLUDED.room_name, updated_at = NOW()`,
        [user.id, roomCode, roomName]
      );
      await client.query(
        'UPDATE account_room_history SET room_name = $1 WHERE user_id = $2 AND room_code = $3',
        [roomName, user.id, roomCode]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    response.json({ roomName });
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
  await pool.query('DELETE FROM auth_users WHERE is_demo = TRUE');

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
      room_name TEXT NOT NULL DEFAULT '',
      host_player_id TEXT NOT NULL,
      guest_player_id TEXT,
      host_user_id BIGINT REFERENCES auth_users(id) ON DELETE SET NULL,
      guest_user_id BIGINT REFERENCES auth_users(id) ON DELETE SET NULL,
      tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'tier_30_day', 'unlocked')),
      round_index INTEGER NOT NULL DEFAULT 0 CHECK (round_index >= 0),
      answering_role TEXT NOT NULL DEFAULT 'host'
        CHECK (answering_role IN ('host', 'guest', 'completed')),
      pass_start_index INTEGER NOT NULL DEFAULT 0 CHECK (pass_start_index >= 0),
      ad_bonus_cards INTEGER NOT NULL DEFAULT 0 CHECK (ad_bonus_cards >= 0),
      ad_bonus_cycle_cards INTEGER NOT NULL DEFAULT 0 CHECK (ad_bonus_cycle_cards >= 0),
      ad_reward_cooldown_until TIMESTAMPTZ,
      ad_reward_started_at TIMESTAMPTZ,
      ad_reward_duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (ad_reward_duration_seconds >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days'
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS room_tictactoe_matches (
      id UUID PRIMARY KEY,
      room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
      state JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS room_tictactoe_matches_room_created_idx
      ON room_tictactoe_matches (room_code, created_at DESC)
  `);
  await pool.query(`
    ALTER TABLE rooms
      ADD COLUMN IF NOT EXISTS room_name TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS host_user_id BIGINT REFERENCES auth_users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS guest_user_id BIGINT REFERENCES auth_users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'
        CHECK (tier IN ('free', 'tier_30_day', 'unlocked')),
      ADD COLUMN IF NOT EXISTS answering_role TEXT NOT NULL DEFAULT 'host'
        CHECK (answering_role IN ('host', 'guest', 'completed')),
      ADD COLUMN IF NOT EXISTS pass_start_index INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ad_bonus_cards INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ad_bonus_cycle_cards INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ad_reward_cooldown_until TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS ad_reward_started_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS ad_reward_duration_seconds INTEGER NOT NULL DEFAULT 0
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS account_room_names (
      user_id BIGINT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      room_code TEXT NOT NULL,
      room_name TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, room_code)
    )
  `);
  await pool.query(`
    UPDATE rooms
       SET answering_role = 'completed'
     WHERE answering_role = 'host'
       AND round_index >= CASE tier
         WHEN 'tier_30_day' THEN 15
         WHEN 'unlocked' THEN 50
         ELSE 5
       END
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS room_answers (
      room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
      round_index INTEGER NOT NULL,
      player_id TEXT NOT NULL,
      answer TEXT NOT NULL,
      question_id TEXT NOT NULL DEFAULT '',
      prompt TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (room_code, round_index, player_id)
    )
  `);
  await pool.query(`
    ALTER TABLE room_answers
      ADD COLUMN IF NOT EXISTS question_id TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS prompt TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT ''
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS account_room_history (
      user_id BIGINT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      room_code TEXT NOT NULL,
      round_index INTEGER NOT NULL CHECK (round_index >= 0),
      question_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      own_answer TEXT NOT NULL,
      partner_answer TEXT NOT NULL,
      player_name TEXT NOT NULL DEFAULT 'Player 1',
      partner_name TEXT NOT NULL DEFAULT 'Player 2',
      partner_id TEXT NOT NULL DEFAULT 'PartnerIDunknown',
      room_name TEXT NOT NULL DEFAULT '',
      session_created_at TIMESTAMPTZ,
      session_completed BOOLEAN NOT NULL DEFAULT FALSE,
      answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, room_code, round_index)
    )
  `);
  await pool.query(`
    ALTER TABLE account_room_history
      ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS player_name TEXT NOT NULL DEFAULT 'Player 1',
      ADD COLUMN IF NOT EXISTS partner_name TEXT NOT NULL DEFAULT 'Player 2',
      ADD COLUMN IF NOT EXISTS partner_id TEXT NOT NULL DEFAULT 'PartnerIDunknown',
      ADD COLUMN IF NOT EXISTS room_name TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS session_created_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS session_completed BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await pool.query(`
    DELETE FROM account_room_history history
    USING auth_users users
    WHERE history.user_id = users.id AND users.is_demo = TRUE
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

async function backfillRoomHistoryForUser(client, roomCode, userId) {
  if (!userId) return;
  const { rows: roomRows } = await client.query(
    `SELECT rooms.host_player_id, rooms.guest_player_id,
            rooms.host_user_id, rooms.guest_user_id,
            rooms.created_at, host_user.name AS host_name,
            guest_user.name AS guest_name
       FROM rooms
       LEFT JOIN auth_users host_user ON host_user.id = rooms.host_user_id
       LEFT JOIN auth_users guest_user ON guest_user.id = rooms.guest_user_id
      WHERE rooms.code = $1`,
    [roomCode]
  );
  const room = roomRows[0];
  if (!room || !room.guest_player_id) return;

  const isHost = String(room.host_user_id) === String(userId);
  const isGuest = String(room.guest_user_id) === String(userId);
  if (!isHost && !isGuest) return;

  const userPlayerId = isHost ? room.host_player_id : room.guest_player_id;
  const partnerPlayerId = isHost ? room.guest_player_id : room.host_player_id;
  const playerName = isHost ? room.host_name || 'Player 1' : room.guest_name || 'Player 2';
  const partnerName = isHost ? room.guest_name || 'Player 2' : room.host_name || 'Player 1';
  const partnerId = isHost ? room.guest_name : room.host_name;

  const { rows: roundRows } = await client.query(
    `SELECT DISTINCT round_index FROM room_answers WHERE room_code = $1`,
    [roomCode]
  );

  for (const { round_index } of roundRows) {
    const { rows: ansRows } = await client.query(
      `SELECT player_id, answer, question_id, prompt, category, submitted_at
         FROM room_answers
        WHERE room_code = $1 AND round_index = $2`,
      [roomCode, round_index]
    );
    const own = ansRows.find(a => a.player_id === userPlayerId);
    const partner = ansRows.find(a => a.player_id === partnerPlayerId);
    if (own && partner) {
      await client.query(
        `INSERT INTO account_room_history
           (user_id, room_code, round_index, question_id, prompt, category,
            own_answer, partner_answer, player_name, partner_name, partner_id,
            room_name, session_created_at, answered_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (user_id, room_code, round_index) DO UPDATE
           SET question_id = EXCLUDED.question_id,
               prompt = EXCLUDED.prompt,
               category = EXCLUDED.category,
               own_answer = EXCLUDED.own_answer,
               partner_answer = EXCLUDED.partner_answer,
               player_name = EXCLUDED.player_name,
               partner_name = EXCLUDED.partner_name,
               partner_id = EXCLUDED.partner_id,
               room_name = EXCLUDED.room_name,
               session_created_at = EXCLUDED.session_created_at,
               answered_at = EXCLUDED.answered_at`,
        [userId, roomCode, round_index, own.question_id, own.prompt, own.category,
          own.answer, partner.answer, playerName, partnerName,
          partnerId || 'PartnerIDunknown', `Room #${roomCode}`,
          room.created_at, new Date(Math.max(
            new Date(own.submitted_at).getTime(),
            new Date(partner.submitted_at).getTime()
          ))]
      );
    }
  }
}

function getRoomCardLimit(tier) {
  if (tier === 'tier_30_day') return 15;
  if (tier === 'unlocked') return 50;
  return 5;
}

function getRoomCardLimitWithAdBonus(tier, adBonusCards = 0) {
  return Math.min(50, getRoomCardLimit(tier) + adBonusCards);
}

async function getRoomState(code, playerId, userId) {
  const { rows } = await pool.query(
    `SELECT rooms.code, rooms.host_player_id, rooms.guest_player_id,
            rooms.host_user_id, rooms.guest_user_id, rooms.tier, rooms.round_index,
            rooms.pass_start_index, rooms.answering_role, rooms.ad_bonus_cards,
            rooms.ad_bonus_cycle_cards, rooms.ad_reward_cooldown_until,
            host_user.name AS host_name, host_user.tier AS host_tier,
            guest_user.name AS guest_name
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
    `SELECT player_id, answer, question_id, prompt
       FROM room_answers
      WHERE room_code = $1 AND round_index = $2`,
    [code, room.round_index]
  );
  const paired = Boolean(room.guest_player_id);
  const revealed = paired && room.answering_role === 'guest' && answerRows.length === 2;
  const completed = room.answering_role === 'completed';
  const cardLimit = getRoomCardLimitWithAdBonus(room.tier, room.ad_bonus_cards);
  const playerOneTier = room.host_tier || 'free';
  const adRewardCooldownExpired = room.ad_reward_cooldown_until &&
    new Date(room.ad_reward_cooldown_until).getTime() <= Date.now();

  return {
    roomCode: room.code,
    status: completed ? 'completed' : paired ? 'paired' : 'waiting',
    role: isHost ? 'host' : 'guest',
    tier: room.tier,
    playerOneTier,
    answeringRole: room.answering_role,
    isMyTurn: room.answering_role === (isHost ? 'host' : 'guest'),
    playerName: isHost ? room.host_name : room.guest_name,
    partnerName: isHost ? room.guest_name : room.host_name,
    isSignedIn: Boolean(userId),
    hostIsSignedIn: Boolean(room.host_user_id),
    roundIndex: room.round_index,
    cardLimit,
    passStartIndex: room.pass_start_index,
    resumeAvailable: completed && isHost &&
      getRoomCardLimit(playerOneTier) > room.round_index,
    adRewardAvailable: completed && isHost && playerOneTier === 'free' && cardLimit < 50,
    adRewardCanWatch: completed && isHost && playerOneTier === 'free' &&
      cardLimit < 50 &&
      (room.ad_bonus_cycle_cards < 15 ||
        adRewardCooldownExpired),
    adRewardCooldownUntil: room.ad_reward_cooldown_until,
    adBonusCycleCards: adRewardCooldownExpired ? 0 : room.ad_bonus_cycle_cards,
    answerCount: answerRows.length,
    hasSubmitted: answerRows.some(answer => answer.player_id === playerId),
    revealedAnswers: revealed
      ? answerRows.map(answer => ({
          role: answer.player_id === room.host_player_id ? 'host' : 'guest',
          answer: answer.answer,
          questionId: answer.question_id,
          prompt: answer.prompt
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

const TICTACTOE_TOKEN_PAIRS = [
  ['🚩', '🟢'],
  ['💍', '👻'],
  ['🍕', '🥑'],
  ['🐸', '🦋'],
  ['🌙', '☀️']
];
const TICTACTOE_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

async function getTicTacToeRoomPlayer(client, webSocket) {
  const code = webSocket.roomCode;
  const playerId = webSocket.playerId;
  if (!code || !playerId) throw new Error('Join a room before playing Tic-Tac-Toe.');

  const { rows } = await client.query(
    `SELECT host_player_id, guest_player_id, host_user_id, guest_user_id,
            host_user.name AS host_name, guest_user.name AS guest_name
       FROM rooms
       LEFT JOIN auth_users host_user ON host_user.id = rooms.host_user_id
       LEFT JOIN auth_users guest_user ON guest_user.id = rooms.guest_user_id
      WHERE rooms.code = $1 AND rooms.expires_at > NOW()
      FOR UPDATE OF rooms`,
    [code]
  );
  const room = rows[0];
  if (!room) throw new Error('Room not found or expired.');

  const role = room.host_player_id === playerId
    ? 'host'
    : room.guest_player_id === playerId
      ? 'guest'
      : null;
  if (!role) throw new Error('This player is not a member of that room.');

  const expectedUserId = role === 'host' ? room.host_user_id : room.guest_user_id;
  if (expectedUserId && String(expectedUserId) !== String(webSocket.authUserId)) {
    throw new Error('Sign in to the account that joined this room.');
  }
  if (!room.guest_player_id) throw new Error('Invite your partner to the room before starting Tic-Tac-Toe.');

  return {
    role,
    roomCode: code,
    hostPlayerId: room.host_player_id,
    guestPlayerId: room.guest_player_id,
    hostName: room.host_name || 'Player 1',
    guestName: room.guest_name || 'Player 2'
  };
}

function createTicTacToeState(room, id) {
  const pair = TICTACTOE_TOKEN_PAIRS[crypto.randomInt(TICTACTOE_TOKEN_PAIRS.length)];
  return {
    id,
    roomCode: room.roomCode,
    players: {
      host: { id: room.hostPlayerId, name: room.hostName, token: pair[0] },
      guest: { id: room.guestPlayerId, name: room.guestName, token: pair[1] }
    },
    wins: { host: 0, guest: 0 },
    comebackCandidates: { host: false, guest: false },
    points: { host: 0, guest: 0 },
    badges: { host: [], guest: [] },
    roundNumber: 1,
    status: 'active',
    seriesWinner: null,
    currentRound: {
      board: Array(9).fill(null),
      starter: 'host',
      turn: 'host',
      status: 'active',
      winner: null,
      clutchPlayers: [],
      result: null
    }
  };
}

function getTicTacToeWinningCells(board, role) {
  const winningCells = new Set();
  for (const [first, second, third] of TICTACTOE_LINES) {
    const cells = [board[first], board[second], board[third]];
    if (cells.filter(cell => cell === role).length === 2 &&
        cells.filter(cell => cell === null).length === 1) {
      winningCells.add([first, second, third][cells.indexOf(null)]);
    }
  }
  return winningCells;
}

function getTicTacToeWinner(board) {
  for (const role of ['host', 'guest']) {
    if (TICTACTOE_LINES.some(line => line.every(cell => board[cell] === role))) {
      return role;
    }
  }
  return null;
}

async function publishTicTacToeState(code, state) {
  const sockets = roomSockets.get(code);
  if (!sockets) return;
  for (const webSocket of sockets) {
    const myRole = state.players.host.id === webSocket.playerId ? 'host' : 'guest';
    send(webSocket, { type: 'tictactoe_state', state, myRole });
  }
}

async function publishLatestTicTacToeState(code) {
  const { rows } = await pool.query(
    `SELECT state FROM room_tictactoe_matches
      WHERE room_code = $1
      ORDER BY created_at DESC LIMIT 1`,
    [code]
  );
  if (rows[0]) await publishTicTacToeState(code, rows[0].state);
}

async function getTicTacToeHistory(code, queryable = pool) {
  const { rows } = await queryable.query(
    `SELECT id, state, created_at, updated_at
       FROM room_tictactoe_matches
      WHERE room_code = $1
      ORDER BY created_at DESC
      LIMIT 25`,
    [code]
  );
  return rows.map(match => ({
    id: match.id,
    status: match.state.status,
    roundNumber: match.state.roundNumber,
    wins: match.state.wins,
    points: match.state.points,
    seriesWinner: match.state.seriesWinner,
    players: match.state.players,
    createdAt: match.created_at,
    updatedAt: match.updated_at
  }));
}

async function listTicTacToeHistory(webSocket, requestId) {
  const client = await pool.connect();
  let room;
  let matches;
  try {
    await client.query('BEGIN');
    room = await getTicTacToeRoomPlayer(client, webSocket);
    matches = await getTicTacToeHistory(room.roomCode, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  respond(webSocket, requestId, 'tictactoe_history_loaded', {
    roomCode: room.roomCode,
    matches
  });
}

async function loadTicTacToe(webSocket, requestId, message) {
  const client = await pool.connect();
  let room;
  let state;
  try {
    await client.query('BEGIN');
    room = await getTicTacToeRoomPlayer(client, webSocket);
    const matchId = message.matchId ?? null;
    if (matchId !== null && (typeof matchId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(matchId))) {
      throw new Error('Invalid Tic-Tac-Toe series ID.');
    }
    const { rows } = await client.query(
      `SELECT state FROM room_tictactoe_matches
        WHERE room_code = $1 AND ($2::uuid IS NULL OR id = $2::uuid)
        ORDER BY created_at DESC LIMIT 1`,
      [room.roomCode, matchId]
    );
    state = rows[0]?.state || null;
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  respond(webSocket, requestId, 'tictactoe_loaded', { state, myRole: room.role });
  if (state) await publishTicTacToeState(room.roomCode, state);
}

async function startTicTacToe(webSocket, requestId) {
  const client = await pool.connect();
  let room;
  let state;
  try {
    await client.query('BEGIN');
    room = await getTicTacToeRoomPlayer(client, webSocket);
    const { rows } = await client.query(
      `SELECT id, state FROM room_tictactoe_matches
        WHERE room_code = $1
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [room.roomCode]
    );
    const latest = rows[0];
    if (latest?.state.status === 'active') {
      state = latest.state;
    } else {
      const id = crypto.randomUUID();
      state = createTicTacToeState(room, id);
      await client.query(
        'INSERT INTO room_tictactoe_matches (id, room_code, state) VALUES ($1, $2, $3)',
        [id, room.roomCode, state]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  respond(webSocket, requestId, 'tictactoe_started', { state, myRole: room.role });
  await publishTicTacToeState(room.roomCode, state);
}

async function makeTicTacToeMove(webSocket, requestId, message) {
  const cellIndex = message.cellIndex;
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex > 8) {
    throw new Error('Choose a valid board cell.');
  }

  const client = await pool.connect();
  let room;
  let state;
  try {
    await client.query('BEGIN');
    room = await getTicTacToeRoomPlayer(client, webSocket);
    const matchId = typeof message.matchId === 'string' ? message.matchId : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(matchId)) {
      throw new Error('Invalid Tic-Tac-Toe series ID.');
    }
    const { rows } = await client.query(
      `SELECT state FROM room_tictactoe_matches
        WHERE id = $1 AND room_code = $2 FOR UPDATE`,
      [matchId, room.roomCode]
    );
    if (!rows[0]) throw new Error('Tic-Tac-Toe series not found.');
    state = rows[0].state;
    const round = state.currentRound;
    if (state.status !== 'active' || round.status !== 'active') {
      throw new Error('This round is over.');
    }
    if (round.turn !== room.role) throw new Error('It is your partner’s turn.');
    if (round.board[cellIndex] !== null) throw new Error('That cell is already taken.');

    const opponent = room.role === 'host' ? 'guest' : 'host';
    const threatCells = getTicTacToeWinningCells(round.board, opponent);
    round.board[cellIndex] = room.role;
    if (threatCells.size === 1 && threatCells.has(cellIndex) &&
        !getTicTacToeWinner(round.board) &&
        !round.clutchPlayers.includes(room.role)) {
      round.clutchPlayers.push(room.role);
    }

    const winner = getTicTacToeWinner(round.board);
    if (winner) {
      round.status = 'complete';
      round.winner = winner;
      if (state.wins[winner] === 0 && state.wins[opponent] === 2) {
        state.comebackCandidates[winner] = true;
      }
      state.wins[winner] += 1;
      state.points[winner] += 10;

      const winningTokenCount = round.board.filter(cell => cell === winner).length;
      if (winningTokenCount === 3 && !state.badges[winner].includes('Strategist')) {
        state.badges[winner].push('Strategist');
      }

      if (state.wins[winner] === 3) {
        state.status = 'complete';
        state.seriesWinner = winner;
        state.points[winner] += 35;
        if (state.wins[opponent] === 0) state.points[winner] += 20;
        if (state.comebackCandidates[winner] &&
            !state.badges[winner].includes('Series MVP')) {
          state.badges[winner].push('Series MVP');
        }
      }
      round.result = {
        winner,
        message: `${state.players[winner].name} wins Round ${state.roundNumber}!`
      };
    } else if (round.board.every(cell => cell !== null)) {
      round.status = 'complete';
      round.winner = null;
      state.points.host += 2;
      state.points.guest += 2;
      for (const role of round.clutchPlayers) {
        if (!state.badges[role].includes('Clutch Block')) {
          state.badges[role].push('Clutch Block');
        }
      }
      round.result = { winner: null, message: `Round ${state.roundNumber} is a draw.` };
    } else {
      round.turn = opponent;
    }

    if (round.status === 'complete' && state.status === 'active' &&
        state.roundNumber === 5) {
      state.status = 'complete';
      state.seriesWinner = null;
    }

    await client.query(
      'UPDATE room_tictactoe_matches SET state = $2, updated_at = NOW() WHERE id = $1',
      [state.id, state]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  respond(webSocket, requestId, 'tictactoe_move', { state, myRole: room.role });
  await publishTicTacToeState(room.roomCode, state);
}

async function advanceTicTacToeRound(webSocket, requestId, message) {
  const client = await pool.connect();
  let room;
  let state;
  try {
    await client.query('BEGIN');
    room = await getTicTacToeRoomPlayer(client, webSocket);
    const matchId = typeof message.matchId === 'string' ? message.matchId : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(matchId)) {
      throw new Error('Invalid Tic-Tac-Toe series ID.');
    }
    const { rows } = await client.query(
      `SELECT state FROM room_tictactoe_matches
        WHERE id = $1 AND room_code = $2 FOR UPDATE`,
      [matchId, room.roomCode]
    );
    if (!rows[0]) throw new Error('Tic-Tac-Toe series not found.');
    state = rows[0].state;
    if (state.status !== 'active') throw new Error('The Division Series is complete.');
    if (state.currentRound.status === 'complete') {
      const previousStarter = state.currentRound.starter;
      state.roundNumber += 1;
      const starter = previousStarter === 'host' ? 'guest' : 'host';
      state.currentRound = {
        board: Array(9).fill(null),
        starter,
        turn: starter,
        status: 'active',
        winner: null,
        clutchPlayers: [],
        result: null
      };
      await client.query(
        'UPDATE room_tictactoe_matches SET state = $2, updated_at = NOW() WHERE id = $1',
        [state.id, state]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  respond(webSocket, requestId, 'tictactoe_round_advanced', { state, myRole: room.role });
  await publishTicTacToeState(room.roomCode, state);
}

async function createRoom(webSocket, requestId, message) {
  if (!validatePlayerId(message.playerId)) throw new Error('Invalid player ID.');

  await pool.query(`DELETE FROM rooms WHERE expires_at <= NOW()`);

  let code;
  for (let attempt = 0; attempt < 5; attempt++) {
    code = generateRoomCode();
    try {
      await pool.query(
        `INSERT INTO rooms (code, room_name, host_player_id, host_user_id, tier)
         VALUES ($1, $2, $3, $4, $5)`,
        [code, `Room #${code}`, message.playerId,
          webSocket.authUserId, webSocket.authUserTier]
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
    await backfillRoomHistoryForUser(client, code, webSocket.authUserId);
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
  await publishLatestTicTacToeState(code);
}

async function resumeRoom(webSocket, requestId, message) {
  const code = typeof message.roomCode === 'string' ? message.roomCode.toUpperCase() : '';
  if (!ROOM_CODE_PATTERN.test(code)) throw new Error('Enter a valid 8-character room code.');
  if (!validatePlayerId(message.playerId)) throw new Error('Invalid player ID.');

  let playerId = message.playerId;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (webSocket.authUserId) {
      await client.query(
        `UPDATE rooms
            SET host_user_id = $3
          WHERE code = $1 AND host_player_id = $2 AND host_user_id IS NULL
            AND (guest_user_id IS NULL OR guest_user_id <> $3)`,
        [code, message.playerId, webSocket.authUserId]
      );
      await client.query(
        `UPDATE rooms
            SET guest_user_id = $3
          WHERE code = $1 AND guest_player_id = $2 AND guest_user_id IS NULL
            AND (host_user_id IS NULL OR host_user_id <> $3)`,
        [code, message.playerId, webSocket.authUserId]
      );
      const { rows: roomRows } = await client.query(
        `SELECT rooms.host_player_id, rooms.guest_player_id,
                rooms.host_user_id, rooms.guest_user_id, rooms.round_index,
                rooms.tier, rooms.answering_role, rooms.pass_start_index,
                rooms.ad_bonus_cards,
                host_user.tier AS host_tier
           FROM rooms
           LEFT JOIN auth_users host_user ON host_user.id = rooms.host_user_id
          WHERE rooms.code = $1 AND rooms.expires_at > NOW()
            AND (rooms.host_user_id = $2 OR rooms.guest_user_id = $2)
          FOR UPDATE OF rooms`,
        [code, webSocket.authUserId]
      );
      const room = roomRows[0];
      if (room) {
        const isHost = String(room.host_user_id) === String(webSocket.authUserId);
        playerId = isHost ? room.host_player_id : room.guest_player_id;
        const playerOneCardLimit = getRoomCardLimit(room.host_tier || 'free');
        if (isHost && room.answering_role === 'completed' &&
            playerOneCardLimit > room.round_index) {
          await client.query(
            `UPDATE rooms
                SET tier = $2, pass_start_index = round_index, answering_role = 'host'
              WHERE code = $1`,
            [code, room.host_tier]
          );
          await client.query(
            'UPDATE account_room_history SET session_completed = FALSE WHERE room_code = $1',
            [code]
          );
        }
      }
    }
    await backfillRoomHistoryForUser(client, code, webSocket.authUserId);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const state = await getRoomState(code, playerId, webSocket.authUserId);
  attachSocket(webSocket, code, playerId);
  respond(webSocket, requestId, 'room_resumed', { state });
  await publishRoomState(code);
  await publishLatestTicTacToeState(code);
}

async function startAdReward(webSocket, requestId, message) {
  const code = webSocket.roomCode;
  const playerId = webSocket.playerId;
  const durationSeconds = Number(message.durationSeconds);
  if (!code || !playerId) throw new Error('Join a room before starting an ad reward.');
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 1800) {
    throw new Error('The ad video duration is invalid.');
  }

  const { rows } = await pool.query(
    `UPDATE rooms
        SET ad_bonus_cycle_cards =
              CASE WHEN ad_reward_cooldown_until <= NOW() THEN 0
                   ELSE ad_bonus_cycle_cards END,
            ad_reward_cooldown_until =
              CASE WHEN ad_reward_cooldown_until <= NOW() THEN NULL
                   ELSE ad_reward_cooldown_until END,
            ad_reward_started_at = NOW(),
            ad_reward_duration_seconds = $3
      WHERE code = $1 AND host_player_id = $2 AND answering_role = 'completed'
        AND expires_at > NOW() AND ad_bonus_cards < 45
        AND (ad_bonus_cycle_cards < 15 OR ad_reward_cooldown_until <= NOW())
        AND (ad_reward_cooldown_until IS NULL OR ad_reward_cooldown_until <= NOW())
        AND (host_user_id IS NULL OR host_user_id = $4)
        AND COALESCE(
          (SELECT tier FROM auth_users WHERE id = rooms.host_user_id), 'free'
        ) = 'free'
      RETURNING ad_reward_duration_seconds`,
    [code, playerId, durationSeconds, webSocket.authUserId || null]
  );
  if (!rows[0]) {
    throw new Error('This room is not eligible to start an ad reward.');
  }

  respond(webSocket, requestId, 'ad_reward_started', {
    durationSeconds: rows[0].ad_reward_duration_seconds
  });
}

async function claimAdReward(webSocket, requestId) {
  const code = webSocket.roomCode;
  const playerId = webSocket.playerId;
  if (!code || !playerId) throw new Error('Join a room before claiming an ad reward.');

  let bonusCards = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT rooms.host_player_id, rooms.host_user_id, rooms.tier,
              rooms.round_index, rooms.answering_role, rooms.ad_bonus_cards,
              rooms.ad_bonus_cycle_cards, rooms.ad_reward_cooldown_until,
              rooms.ad_reward_started_at, rooms.ad_reward_duration_seconds,
              (rooms.ad_reward_started_at <= NOW() -
                rooms.ad_reward_duration_seconds * INTERVAL '1 second') AS ad_reward_elapsed,
              host_user.tier AS host_tier
         FROM rooms
         LEFT JOIN auth_users host_user ON host_user.id = rooms.host_user_id
        WHERE rooms.code = $1 AND rooms.expires_at > NOW()
        FOR UPDATE OF rooms`,
      [code]
    );
    const room = rows[0];
    if (!room) throw new Error('Room not found or expired.');
    if (room.host_player_id !== playerId) {
      throw new Error('Only Player 1 can claim an ad reward.');
    }
    if (room.host_user_id && String(room.host_user_id) !== String(webSocket.authUserId)) {
      throw new Error('Sign in to the account that created this room.');
    }
    if (room.answering_role !== 'completed') {
      throw new Error('Complete the current card pass before claiming another ad reward.');
    }
    if (!room.ad_reward_started_at || !room.ad_reward_duration_seconds) {
      throw new Error('Watch the full video before claiming this reward.');
    }
    if (!room.ad_reward_elapsed) {
      throw new Error('Watch the full video before claiming this reward.');
    }
    if ((room.host_tier || 'free') !== 'free') {
      throw new Error('Ad rewards are only available for free-tier Player 1 accounts.');
    }
    if (room.ad_reward_cooldown_until &&
        new Date(room.ad_reward_cooldown_until).getTime() > Date.now()) {
      throw new Error('The ad reward cooldown is still active.');
    }
    if (room.ad_bonus_cycle_cards >= 15) {
      throw new Error('The 15-card ad reward limit has been reached. Wait seven days before watching more ads.');
    }

    const currentLimit = getRoomCardLimitWithAdBonus(room.tier, room.ad_bonus_cards);
    if (currentLimit >= 50) {
      throw new Error('This room has reached its 50-card limit.');
    }

    bonusCards = Math.min(5, 15 - room.ad_bonus_cycle_cards, 50 - currentLimit);
    await client.query(
      `UPDATE rooms
          SET ad_bonus_cards = ad_bonus_cards + $2,
              ad_bonus_cycle_cards = ad_bonus_cycle_cards + $2,
              ad_reward_cooldown_until =
                CASE WHEN ad_bonus_cycle_cards + $2 >= 15
                     THEN NOW() + INTERVAL '7 days'
                     ELSE ad_reward_cooldown_until END,
              pass_start_index = round_index,
              answering_role = 'host',
              ad_reward_started_at = NULL,
              ad_reward_duration_seconds = 0
        WHERE code = $1`,
      [code, bonusCards]
    );
    await client.query(
      'UPDATE account_room_history SET session_completed = FALSE WHERE room_code = $1',
      [code]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  respond(webSocket, requestId, 'ad_reward_claimed', { bonusCards });
  await publishRoomState(code);
}

async function submitAnswer(webSocket, requestId, message) {
  const code = webSocket.roomCode;
  const playerId = webSocket.playerId;
  if (!code || !playerId) throw new Error('Join a room before submitting an answer.');

  const answersList = Array.isArray(message.answers) ? message.answers : [message];

  for (const item of answersList) {
    if (typeof item.answer !== 'string' || !item.answer.trim() ||
        item.answer.length > MAX_ANSWER_LENGTH) {
      throw new Error(`Answer must contain 1 to ${MAX_ANSWER_LENGTH} characters.`);
    }
    if (typeof item.questionId !== 'string' || !item.questionId.trim() ||
        item.questionId.length > 200 ||
        typeof item.prompt !== 'string' || !item.prompt.trim() ||
        item.prompt.length > 2000 ||
        (item.category !== undefined &&
          (typeof item.category !== 'string' || item.category.length > 100))) {
      throw new Error('The current question is invalid. Refresh the room and try again.');
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: rooms } = await client.query(
      `SELECT host_player_id, guest_player_id, host_user_id, guest_user_id,
              round_index, tier, answering_role
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
    const playerRole = isHost ? 'host' : 'guest';
    if (room.answering_role !== playerRole) {
      throw new Error(playerRole === 'guest'
        ? 'Wait for Player 1 to finish all questions before answering.'
        : 'Player 1 has finished. Wait for Player 2 to answer.');
    }

    const expectedUserId = isHost ? room.host_user_id : room.guest_user_id;
    if (expectedUserId && String(expectedUserId) !== String(webSocket.authUserId)) {
      throw new Error('Sign in to the account that joined this room.');
    }

    for (const item of answersList) {
      const targetRoundIndex = typeof item.roundIndex === 'number' ? item.roundIndex : room.round_index;

      await client.query(
        `INSERT INTO room_answers
           (room_code, round_index, player_id, answer, question_id, prompt, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (room_code, round_index, player_id) DO UPDATE
           SET answer = EXCLUDED.answer,
               question_id = EXCLUDED.question_id,
               prompt = EXCLUDED.prompt,
               category = EXCLUDED.category,
               submitted_at = NOW()`,
        [code, targetRoundIndex, playerId, item.answer.trim(),
          item.questionId, item.prompt, item.category?.trim() || 'Uncategorized']
      );
    }

    await backfillRoomHistoryForUser(client, code, room.host_user_id);
    await backfillRoomHistoryForUser(client, code, room.guest_user_id);
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

async function advanceRound(webSocket, requestId) {
  const code = webSocket.roomCode;
  if (!code || !webSocket.playerId) throw new Error('Join a room before advancing.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT host_player_id, guest_player_id, host_user_id, round_index, tier,
              pass_start_index, answering_role, ad_bonus_cards
         FROM rooms WHERE code = $1 AND expires_at > NOW() FOR UPDATE`,
      [code]
    );
    const room = rows[0];
    if (!room) throw new Error('Room not found or expired.');
    if (!room.guest_player_id) throw new Error('Wait for the other player to join.');
    
    const isHost = room.host_player_id === webSocket.playerId;
    const isGuest = room.guest_player_id === webSocket.playerId;
    if (!isHost && !isGuest) throw new Error('This player is not a member of that room.');
    
    const playerRole = isHost ? 'host' : 'guest';
    if (room.answering_role !== playerRole) {
      throw new Error(playerRole === 'guest'
        ? 'Wait for Player 1 to finish all questions before answering.'
        : 'Player 1 has finished. Wait for Player 2 to answer.');
    }

    const cardLimit = getRoomCardLimitWithAdBonus(room.tier, room.ad_bonus_cards);
    if (room.round_index >= cardLimit) {
      throw new Error('This room has completed its card pass.');
    }

    const nextRoundIndex = Math.min(room.round_index + 5, cardLimit);

    if (nextRoundIndex < cardLimit) {
      await client.query(
        'UPDATE rooms SET round_index = $1 WHERE code = $2',
        [nextRoundIndex, code]
      );
    } else if (playerRole === 'host') {
      await client.query(
        `UPDATE rooms
            SET round_index = $2, answering_role = 'guest'
          WHERE code = $1`,
        [code, room.pass_start_index]
      );
    } else {
      await client.query(
        `UPDATE rooms
            SET round_index = $1, answering_role = 'completed'
          WHERE code = $2`,
        [cardLimit, code]
      );
      await client.query(
        'UPDATE account_room_history SET session_completed = TRUE WHERE room_code = $1',
        [code]
      );
    }

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

async function goBackQuestion(webSocket, requestId) {
  const code = webSocket.roomCode;
  const playerId = webSocket.playerId;
  if (!code || !playerId) throw new Error('Join a room before going back.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT host_player_id, guest_player_id, round_index, answering_role
         FROM rooms
        WHERE code = $1 AND expires_at > NOW()
        FOR UPDATE`,
      [code]
    );
    const room = rows[0];
    if (!room) throw new Error('Room not found or expired.');
    const isHost = room.host_player_id === playerId;
    const isGuest = room.guest_player_id === playerId;
    if (!isHost && !isGuest) throw new Error('This player is not a member of that room.');
    const playerRole = isHost ? 'host' : 'guest';
    if (room.answering_role !== playerRole) {
      throw new Error('It is not your turn to answer questions.');
    }
    if (room.round_index <= 0) throw new Error('You are already on the first question.');

    await client.query(
      'UPDATE rooms SET round_index = round_index - 1 WHERE code = $1',
      [code]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  respond(webSocket, requestId, 'question_backed');
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
      case 'claim_ad_reward':
        await claimAdReward(webSocket, requestId);
        break;
      case 'start_ad_reward':
        await startAdReward(webSocket, requestId, message);
        break;
      case 'submit_answer':
        await submitAnswer(webSocket, requestId, message);
        break;
            case 'advance_round':
        await advanceRound(webSocket, requestId);
        break;
      case 'back_question':
        await goBackQuestion(webSocket, requestId);
        break;
      case 'load_tictactoe':
        await loadTicTacToe(webSocket, requestId, message);
        break;
      case 'list_tictactoe_history':
        await listTicTacToeHistory(webSocket, requestId);
        break;
      case 'start_tictactoe':
        await startTicTacToe(webSocket, requestId);
        break;
      case 'tictactoe_move':
        await makeTicTacToeMove(webSocket, requestId, message);
        break;
      case 'advance_tictactoe_round':
        await advanceTicTacToeRound(webSocket, requestId, message);
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