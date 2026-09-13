import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, BASE, hasToken, setTokens, type AdminUser, type AuthTokens } from "../lib/api";

interface AuthState {
  admin: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasToken()) {
      setLoading(false);
      return;
    }
    api
      .get<{ admin: AdminUser }>("/api/auth/me")
      .then((d) => setAdmin(d.admin))
      .catch(() => {
        setTokens(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(identifier: string, password: string) {
    const body = /^\S+@\S+\.\S+$/.test(identifier) ? { email: identifier, password } : { username: identifier, password };
    const d = await api.post<{ accessToken: string; refreshToken: string; admin: AdminUser }>("/api/auth/login", body);
    setTokens({ accessToken: d.accessToken, refreshToken: d.refreshToken } satisfies AuthTokens);
    setAdmin(d.admin);
  }

  async function logout() {
    const rt = localStorage.getItem("sv_refresh");
    setTokens(null);
    setAdmin(null);
    if (rt) {
      try {
        await fetch(`${BASE}/api/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: rt }),
        });
      } catch {
        /* ignore */
      }
    }
  }

  return <AuthContext.Provider value={{ admin, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function hasPermission(permissions: string[], key: string) {
  return permissions.includes(key) || permissions.includes("dashboard");
}