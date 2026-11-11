import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { argon2id, hash, verify } from "argon2";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { trustedCloudflareIp } from "@/lib/client-ip";
import { getDb } from "@/lib/db";
import { applicationOrigin } from "@/lib/embeds";
import passwordDenylist from "@/lib/auth-password-denylist.json";

const SESSION_COOKIE = "widget_admin_session";
const SESSION_TTL = 8 * 60 * 60 * 1000;
const ATTEMPT_WINDOW = 60 * 1000;
const ATTEMPTS_PER_SOURCE = 12;
const MAX_CONCURRENT_VERIFICATIONS = 2;

const HASH_OPTIONS = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

// Supplement the NCSC snapshot with a few well-known and project-specific choices.
const BLOCKED_PASSWORDS = new Set([
  "123456",
  "123456789012345",
  "1234567890123456",
  "12345678901234567890",
  "1234567812345678",
  "qwertyuiopasdfgh",
  "qwertyuiopasdfghjkl",
  "passwordpassword",
  "passwordpassword1",
  "passwordpassword123",
  "correcthorsebatterystaple",
  "iloveyouiloveyou",
  "letmeinletmeinletmein",
  "administrator123",
  "administrator1234",
  "changemechangeme",
  "thisismypassword",
  "mysecurepassword",
  "supersecurepassword",
  "widgetconsole123",
  "widgetconsoleadmin",
]);
const BLOCKED_PASSWORD_HASHES = new Set(passwordDenylist.hashes);

type AdminRow = { username: string; password_hash: string };

const initialized = new WeakSet<object>();
let configuredAdmin: Promise<AdminRow | null> | undefined;
const processState = globalThis as typeof globalThis & {
  widgetConsoleAuth?: { activeVerifications: number };
};
const authRuntime = processState.widgetConsoleAuth ??= { activeVerifications: 0 };

function database() {
  const db = getDb();
  if (!initialized.has(db)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS admin_credentials (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS admin_sessions (
        token_hash TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('setup', 'admin')),
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions(expires_at);
      CREATE TABLE IF NOT EXISTS admin_auth_limits (
        bucket TEXT PRIMARY KEY,
        requests INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS admin_auth_limits_expiry ON admin_auth_limits(expires_at);
    `);
    initialized.add(db);
  }
  return db;
}

function getAdmin() {
  return database().prepare(
    "SELECT username, password_hash FROM admin_credentials WHERE id = 1",
  ).get() as AdminRow | undefined;
}

function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isAdminHost(request: Headers) {
  const host = request.get("host") ?? "";
  const origin = applicationOrigin();
  return origin !== null && host.toLowerCase() === origin.host;
}

export async function isAdminMutation() {
  const request = await headers();
  return isAdminHost(request) && request.get("origin") === applicationOrigin()?.origin;
}

export async function getSignInAvailability() {
  return isAdminHost(await headers()) && await isAdminReady();
}

function parseUsername(value: unknown) {
  if (typeof value !== "string") return null;
  const username = value.trim();
  return /^[a-z0-9][a-z0-9._-]{2,63}$/i.test(username) ? username : null;
}

function parsePassword(value: unknown) {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return null;
  const password = value.normalize("NFC");
  return Array.from(password).length <= 256 ? password : null;
}

function validateNewPassword(value: unknown) {
  const password = parsePassword(value);
  if (!password || Array.from(password).length < 15) return null;
  const normalized = password.toLowerCase();
  if (BLOCKED_PASSWORDS.has(normalized) ||
    BLOCKED_PASSWORD_HASHES.has(tokenHash(normalized)) ||
    /^(.)\1+$/su.test(password)) return null;
  return password;
}

async function matchesConfiguredCredentials(admin: AdminRow, username: string, password: string) {
  return admin.username === username && await verify(admin.password_hash, password).catch(() => false);
}

async function synchronizeConfiguredAdmin(): Promise<AdminRow | null> {
  const username = parseUsername(process.env.WIDGET_ADMIN_USERNAME);
  const password = validateNewPassword(process.env.WIDGET_ADMIN_PASSWORD);
  if (!applicationOrigin() || !username || !password) return null;

  const current = getAdmin();
  if (current && await matchesConfiguredCredentials(current, username, password)) return current;

  const passwordHash = await hash(password, HASH_OPTIONS);
  if (saveConfiguredCredentials(username, passwordHash, current)) {
    return { username, password_hash: passwordHash };
  }

  // Another startup may have initialized the same persistent database during hashing.
  const saved = getAdmin();
  return saved && await matchesConfiguredCredentials(saved, username, password) ? saved : null;
}

function saveConfiguredCredentials(username: string, passwordHash: string, previous?: AdminRow) {
  const db = database();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = previous
      ? db.prepare("UPDATE admin_credentials SET username = ?, password_hash = ? WHERE id = 1 AND username = ? AND password_hash = ?")
        .run(username, passwordHash, previous.username, previous.password_hash)
      : db.prepare("INSERT OR IGNORE INTO admin_credentials (id, username, password_hash) VALUES (1, ?, ?)")
        .run(username, passwordHash);
    if (result.changes === 1) db.exec("DELETE FROM admin_sessions; DELETE FROM admin_auth_limits;");
    db.exec("COMMIT");
    return result.changes === 1;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function getConfiguredAdmin() {
  configuredAdmin ??= synchronizeConfiguredAdmin().catch((error: unknown) => {
    configuredAdmin = undefined;
    throw error;
  });
  return configuredAdmin;
}

export async function isAdminReady() {
  const admin = await getConfiguredAdmin();
  return Boolean(admin && database().prepare(`
    SELECT 1 FROM admin_credentials WHERE id = 1 AND username = ? AND password_hash = ?
  `).get(admin.username, admin.password_hash));
}

function chargeSourceAttempt(ip: string) {
  const db = database();
  const now = Date.now();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM admin_auth_limits WHERE expires_at <= ?").run(now);
    const result = db.prepare(`
      INSERT INTO admin_auth_limits (bucket, requests, expires_at) VALUES (?, 1, ?)
      ON CONFLICT(bucket) DO UPDATE SET requests = requests + 1 WHERE requests < ?
    `).run(`source:${tokenHash(ip)}`, now + ATTEMPT_WINDOW, ATTEMPTS_PER_SOURCE);
    db.exec("COMMIT");
    return result.changes === 1;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

async function createSession(admin: AdminRow) {
  const db = database();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_TTL;
  db.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").run(Date.now());
  const insert = db.prepare(`INSERT INTO admin_sessions (token_hash, kind, expires_at)
    SELECT ?, 'admin', ? FROM admin_credentials WHERE id = 1 AND username = ? AND password_hash = ?`)
    .run(tokenHash(token), expiresAt, admin.username, admin.password_hash);
  if (insert.changes !== 1) return false;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    secure: true,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
  return true;
}

export async function getAdminSession() {
  if (!isAdminHost(await headers())) return null;
  const admin = await getConfiguredAdmin();
  if (!admin) return null;
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const sessionHash = tokenHash(token);
  const checkSession = database().prepare(`
    SELECT 1 FROM admin_sessions
    WHERE token_hash = ? AND kind = 'admin' AND expires_at > ?
      AND EXISTS (SELECT 1 FROM admin_credentials WHERE id = 1 AND username = ? AND password_hash = ?)
  `);
  const session = {
    username: admin.username,
    isActive: () => Boolean(checkSession.get(sessionHash, Date.now(), admin.username, admin.password_hash)),
  };
  return session.isActive() ? session : null;
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/sign-in");
  return session;
}

export async function signInWithPassword(form: FormData) {
  const request = await headers();
  if (!isAdminHost(request)) return "unavailable";
  const admin = await getConfiguredAdmin();
  if (!admin) return "unavailable";
  const username = parseUsername(form.get("username"));
  const password = parsePassword(form.get("password"));
  if (!username || !password) return "invalid";

  if (authRuntime.activeVerifications >= MAX_CONCURRENT_VERIFICATIONS) return "busy";
  const ip = trustedCloudflareIp(request);
  if (ip && !chargeSourceAttempt(ip)) return "throttled";

  let correctPassword: boolean;
  authRuntime.activeVerifications += 1;
  try {
    correctPassword = await verify(admin.password_hash, password);
  } finally {
    authRuntime.activeVerifications -= 1;
  }
  if (username.toLowerCase() !== admin.username.toLowerCase() || !correctPassword) return "invalid";
  if (!await createSession(admin)) return "invalid";
  return "signed-in";
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    database().prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(tokenHash(token));
  }
  jar.delete(SESSION_COOKIE);
}
