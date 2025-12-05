const TOKEN_STORAGE_KEY = 'hydromonitor:auth_token';
const STATIC_TOKEN = 'bdec6a5cc4e7594efce83fd40de1e879db45c7a6';
const API_BASE_URL = "https://8de77a78ce9b.ngrok-free.app";

let memoryToken: string | null = null;

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

export const clearAuthToken = () => {
  memoryToken = null;
  const storage = getStorage();
  try {
    storage?.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
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

export const login = async (username: string, password: string): Promise<string> => {
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

  const token = payload?.token || payload?.access || STATIC_TOKEN;
  if (!token) {
    throw new AuthError('TOKEN_MISSING', 'Token was not returned by the server', response.status);
  }

  saveAuthToken(token);
  return token;
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
