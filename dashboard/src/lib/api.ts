export const BASE = (import.meta.env.VITE_API_URL as string) || "";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

let accessToken: string | null = localStorage.getItem("sv_access");
let refreshToken: string | null = localStorage.getItem("sv_refresh");
let refreshPromise: Promise<string> | null = null;

export function setTokens(tokens: AuthTokens | null) {
  accessToken = tokens?.accessToken ?? null;
  refreshToken = tokens?.refreshToken ?? null;
  if (tokens) {
    localStorage.setItem("sv_access", tokens.accessToken);
    localStorage.setItem("sv_refresh", tokens.refreshToken);
  } else {
    localStorage.removeItem("sv_access");
    localStorage.removeItem("sv_refresh");
  }
}

export function getTokens() {
  return { accessToken, refreshToken };
}

export function hasToken() {
  return Boolean(accessToken);
}

async function refreshAccessToken(): Promise<string> {
  if (!refreshToken) throw new ApiError(401, "No refresh token");
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) throw new ApiError(401, body?.message ?? "Session expired");
      setTokens({ accessToken: body.data.accessToken, refreshToken: body.data.refreshToken });
      return body.data.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function request<T = unknown>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401 && !retried) {
    try {
      const next = await refreshAccessToken();
      headers.Authorization = `Bearer ${next}`;
      const res2 = await fetch(`${BASE}${path}`, { ...options, headers });
      return handle(res2);
    } catch {
      setTokens(null);
      throw new ApiError(401, "Session expired. Please login again.");
    }
  }
  return handle(res);
}

async function handle<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.message || `Request failed (${res.status})`);
  }
  return body?.data as T;
}

export const api = {
  get: <T = unknown>(path: string, params?: Record<string, string | number | boolean | undefined>) => {
    const qs = params
      ? "?" +
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== "")
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join("&")
      : "";
    return request<T>(`${path}${qs}`);
  },
  post: <T = unknown>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: <T = unknown>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  patch: <T = unknown>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  del: <T = unknown>(path: string) => request<T>(path, { method: "DELETE" }),
};