// 게이트웨이 경유 API 클라이언트. Bearer 토큰 주입 + 401 시 refresh 1회 재시도.
import type { JwtClaims } from "./types";

const TOKEN_KEY = "accessToken";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function decodeJwt(token: string): JwtClaims | null {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    // UTF-8 (한글 닉네임) 디코딩
    const decoded = decodeURIComponent(
      Array.from(json)
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(decoded) as JwtClaims;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function refreshToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken?: string };
    if (data.accessToken) {
      setToken(data.accessToken);
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

interface FetchOptions {
  method?: string;
  body?: unknown;
  auth?: boolean; // 기본 true
  retry?: boolean;
  headers?: Record<string, string>;
}

async function raw(path: string, opts: FetchOptions): Promise<Response> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.auth !== false) {
    const t = getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  return fetch(path, {
    method: opts.method ?? "GET",
    headers,
    credentials: "include",
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

/** 원시 JSON 응답을 반환. 실패 시 ApiError. */
export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  let res = await raw(path, opts);

  if (res.status === 401 && opts.auth !== false && opts.retry !== false) {
    const t = await refreshToken();
    if (t) {
      res = await raw(path, { ...opts, retry: false });
    } else {
      clearToken();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
      throw new ApiError(401, "인증이 필요합니다.");
    }
  }

  const text = await res.text();
  const json = text ? safeParse(text) : null;

  if (!res.ok) {
    const msg = extractMessage(json) ?? `요청 실패 (${res.status})`;
    throw new ApiError(res.status, msg, json);
  }
  return json as T;
}

/** ApiResponse<T> 래퍼를 벗겨 data 만 반환 (product/order/chat/payment). */
export async function apiData<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const wrapped = await apiFetch<{ data: T }>(path, opts);
  return wrapped.data;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractMessage(json: unknown): string | null {
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
    if (typeof o.error === "string") return o.error;
  }
  return null;
}
