import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const TOKEN_KEY = "portal_auth_token";
const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface AuthCtx {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  updateToken: (token: string) => void;
}

const AuthContext = createContext<AuthCtx>({
  isAuthenticated: false,
  isLoading: true,
  login: async () => ({ ok: false }),
  logout: () => {},
  updateToken: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Verify stored token on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setIsLoading(false);
      return;
    }
    fetch(`${base}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then(r => r.json())
      .then((data: { ok: boolean }) => {
        setIsAuthenticated(data.ok === true);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (password: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const resp = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await resp.json() as { ok?: boolean; token?: string; error?: string };
      if (data.ok && data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        setIsAuthenticated(true);
        return { ok: true };
      }
      return { ok: false, error: data.error ?? "密码错误" };
    } catch {
      return { ok: false, error: "网络错误，请重试" };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setIsAuthenticated(false);
  }, []);

  const updateToken = useCallback((token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    setIsAuthenticated(true);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout, updateToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
