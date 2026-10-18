import { CONFIG } from '../../js/config.js';

const BASE = CONFIG.supabaseUrl.replace(/\/$/, '');
const KEY = CONFIG.supabaseKey;
const STORE = 'iruñartea_admin_session';

export const isConfigured = Boolean(BASE && KEY);

let session = null;
let refreshing = null;

try { session = JSON.parse(sessionStorage.getItem(STORE) || 'null'); } catch { session = null; }

function saveSession(data) {
  session = data ? {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in - 30) * 1000,
    email: data.user?.email || session?.email || ''
  } : null;
  if (session) sessionStorage.setItem(STORE, JSON.stringify(session)); else sessionStorage.removeItem(STORE);
}

export const hasSession = () => Boolean(session?.refresh_token);
export const userEmail = () => session?.email || '';

export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

async function parse(response) {
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const message = body?.msg || body?.message || body?.error_description || body?.error || `Error ${response.status}`;
    throw new ApiError(message, response.status, body?.code || body?.error_code);
  }
  return body;
}

async function auth(path, payload, method = 'POST') {
  const response = await fetch(`${BASE}/auth/v1/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', apikey: KEY, ...(method === 'PUT' ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body: JSON.stringify(payload)
  });
  return parse(response);
}

async function refresh() {
  if (!session?.refresh_token) throw new ApiError('Sesión caducada', 401);
  refreshing ||= auth('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
    .then((data) => { saveSession(data); })
    .catch((error) => { saveSession(null); throw error; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

async function token() {
  if (!session) throw new ApiError('Sin sesión', 401);
  if (Date.now() >= session.expires_at) await refresh();
  return session.access_token;
}

async function call(path, options = {}, retry = true) {
  const headers = { apikey: KEY, Authorization: `Bearer ${await token()}`, ...options.headers };
  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  if (response.status === 401 && retry) {
    await refresh();
    return call(path, options, false);
  }
  return parse(response);
}

export async function login(email, password) {
  const data = await auth('token?grant_type=password', { email, password });
  saveSession(data);
  try {
    const rows = await call('/rest/v1/admins?select=user_id');
    if (!rows.length) throw new ApiError('Esta cuenta no tiene permisos de administración.', 403);
  } catch (error) {
    await logout();
    throw error;
  }
}

export async function logout() {
  const current = session;
  saveSession(null);
  if (current) {
    fetch(`${BASE}/auth/v1/logout`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${current.access_token}` } }).catch(() => {});
  }
}

export async function verifySession() {
  if (!hasSession()) return false;
  try {
    const rows = await call('/rest/v1/admins?select=user_id');
    return rows.length === 1;
  } catch {
    saveSession(null);
    return false;
  }
}

export async function changePassword(password) {
  await token();
  await auth('user', { password }, 'PUT');
}

const json = { 'Content-Type': 'application/json' };

export const db = {
  select: (table, query = 'select=*') => call(`/rest/v1/${table}?${query}`),
  upsert: (table, rows) => call(`/rest/v1/${table}`, {
    method: 'POST', headers: { ...json, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows)
  }),
  patch: (table, filter, values) => call(`/rest/v1/${table}?${filter}`, {
    method: 'PATCH', headers: { ...json, Prefer: 'return=minimal' }, body: JSON.stringify(values)
  }),
  remove: (table, filter) => call(`/rest/v1/${table}?${filter}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
};

export async function uploadImage(blob, extension) {
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  await call(`/storage/v1/object/site-media/uploads/${name}`, {
    method: 'POST', headers: { 'Content-Type': blob.type, 'x-upsert': 'false' }, body: blob
  });
  return `uploads/${name}`;
}
