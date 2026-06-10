import { AuthMetadata } from '../types';

export type AuthSession = { token: string; metadata: AuthMetadata };

const TOKEN_STORAGE_KEY = 'water-monitoring:auth_token';
const USER_STORAGE_KEY = 'water-monitoring:auth_meta';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/').replace(/\/$/, '');

let memoryToken: string | null = null;
let memoryMetadata: AuthMetadata | null = null;

const getStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch (error) {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }
};

const persistMetadata = (meta: AuthMetadata | null) => {
  memoryMetadata = meta;
  const storage = getStorage();
  try {
    if (meta) {
      storage?.setItem(USER_STORAGE_KEY, JSON.stringify(meta));
    } else {
      storage?.removeItem(USER_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors (e.g., disabled cookies)
  }
};

const normalizeNamedRef = (value: any): { id: number; name: string } | null => {
  if (!value || typeof value !== 'object') return null;
  const id = Number(value.id);
  const name = typeof value.name === 'string' ? value.name : '';
  if (!Number.isFinite(id) || !name) return null;
  return { id, name };
};

export const authMetadataFromPayload = (payload: any): AuthMetadata => ({
  userId: payload?.user_id ?? payload?.id ?? payload?.userId,
  username: payload?.username,
  email: payload?.email,
  firstName: payload?.first_name ?? payload?.firstName,
  lastName: payload?.last_name ?? payload?.lastName,
  phone: payload?.phone,
  permissions: Array.isArray(payload?.permissions) ? payload.permissions : undefined,
  isSuperuser: Boolean(payload?.is_superuser ?? payload?.isSuperuser),
  isStaff: Boolean(payload?.is_staff ?? payload?.isStaff),
  company: normalizeNamedRef(payload?.company),
  group: normalizeNamedRef(payload?.group),
});

export const saveAuthMetadata = (meta: AuthMetadata | null) => {
  persistMetadata(meta);
};

export const getAuthToken = (): string | null => {
  if (memoryToken) return memoryToken;
  const storage = getStorage();
  const token = storage?.getItem(TOKEN_STORAGE_KEY) || null;
  memoryToken = token;
  return token;
};

export const saveAuthToken = (token: string) => {
  memoryToken = token;
  const storage = getStorage();
  try {
    storage?.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage write errors (e.g., disabled cookies)
  }
};

export const getAuthMetadata = (): AuthMetadata | null => {
  if (memoryMetadata) return memoryMetadata;
  const storage = getStorage();
  const raw = storage?.getItem(USER_STORAGE_KEY) || null;
  if (!raw) return null;
  try {
    const parsed: AuthMetadata = JSON.parse(raw);
    memoryMetadata = parsed;
    return parsed;
  } catch {
    return null;
  }
};

export const clearAuthToken = () => {
  memoryToken = null;
  const storage = getStorage();
  try {
    storage?.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
  persistMetadata(null);
};

export class AuthError extends Error {
  code: string;
  status?: number;

  constructor(code: string, message?: string, status?: number) {
    super(message || code);
    this.code = code;
    this.status = status;
  }
}

export const login = async (
  username: string,
  password: string
): Promise<AuthSession> => {
  const response = await fetch(`${API_BASE_URL}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      response.status === 401
        ? 'Invalid username or password'
        : payload?.detail || 'Unable to sign in right now';
    throw new AuthError(response.status === 401 ? 'INVALID_CREDENTIALS' : 'LOGIN_FAILED', message, response.status);
  }

  const token = payload?.token || payload?.access;
  if (!token) {
    throw new AuthError('TOKEN_MISSING', 'Token was not returned by the server', response.status);
  }

  const metadata = authMetadataFromPayload(payload);

  saveAuthToken(token);
  persistMetadata(metadata);

  return { token, metadata };
};

export const authFetch = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  options?: { skipAuth?: boolean }
): Promise<Response> => {
  const headers = new Headers(init.headers || {});
  if (!options?.skipAuth) {
    const token = getAuthToken();
    if (token) {
      headers.set('Authorization', `Token ${token}`);
    }
  }

  const response = await fetch(input, { ...init, headers });

  // Auto-clear stale token on unauthorized to force re-login.
  if (response.status === 401) {
    const hadToken = Boolean(getAuthToken());
    clearAuthToken();
    if (hadToken && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('auth:logout'));
    }
  }

  return response;
};

export const isAuthenticated = () => Boolean(getAuthToken());
