"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  apiFetch,
  clearToken,
  decodeJwt,
  getToken,
  setToken,
} from "./api";
import type { TokenResponse } from "./types";

export interface CurrentUser {
  memberId: number;
  role: string;
  nickname: string;
}

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function userFromToken(): CurrentUser | null {
  const t = getToken();
  if (!t) return null;
  const claims = decodeJwt(t);
  if (!claims) return null;
  if (claims.exp * 1000 < Date.now()) return null;
  return {
    memberId: Number(claims.sub),
    role: claims.role,
    nickname: claims.nickname,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(() => {
    setUser(userFromToken());
  }, []);

  useEffect(() => {
    refreshUser();
    setLoading(false);
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<TokenResponse>("/api/auth/login", {
        method: "POST",
        body: { email, password },
        auth: false,
      });
      setToken(res.accessToken);
      setUser(userFromToken());
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch<void>("/api/auth/logout", { method: "POST", auth: false });
    } catch {
      // 서버 로그아웃 실패해도 로컬 세션은 정리
    }
    clearToken();
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
