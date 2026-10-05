const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const refreshKey = 'racehorse.refreshToken';
let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

type Envelope<T> = { data: T; message?: string; errors?: unknown };

async function refresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const token = sessionStorage.getItem(refreshKey);
      if (!token) return false;
      try {
        const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: token }),
        });
        if (!response.ok) throw new Error();
        const result = await response.json();
        accessToken = result.data?.accessToken;
        if (result.data?.refreshToken) sessionStorage.setItem(refreshKey, result.data.refreshToken);
        return Boolean(accessToken);
      } catch {
        accessToken = null;
        sessionStorage.removeItem(refreshKey);
        return false;
      }
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function login(email: string, password: string) {
  const result = await request<{ accessToken: string; refreshToken: string; user: User }>(
    '/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false,
  );
  accessToken = result.accessToken;
  sessionStorage.setItem(refreshKey, result.refreshToken);
  return result.user;
}

export type User = { id: string; email: string; fullName: string; role: string };

export async function restoreSession(): Promise<User | null> {
  if (!await refresh()) return null;
  try { return await api<User>('/api/v1/auth/me'); }
  catch { accessToken = null; sessionStorage.removeItem(refreshKey); return null; }
}

export async function logout() {
  try { await request('/api/v1/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: sessionStorage.getItem(refreshKey) }) }); }
  finally { accessToken = null; sessionStorage.removeItem(refreshKey); }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (response.status === 401 && retry && await refresh()) return request<T>(path, init, false);
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.message ?? body?.errors?.[0]?.message ?? `Request failed (${response.status})`;
    throw new ApiError(detail, response.status);
  }
  return (body && 'data' in body ? body.data : body) as T;
}

export const api = <T>(path: string, init?: RequestInit) => request<T>(path, init);
export const json = (method: string, value?: unknown): RequestInit => ({
  method, ...(value === undefined ? {} : { body: JSON.stringify(value) }),
});
