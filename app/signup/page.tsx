"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { SignUpResponse } from "../lib/types";

export default function SignupPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch<SignUpResponse>("/api/auth/signup", {
        method: "POST",
        body: { email, password, nickname },
        auth: false,
      });
      // 가입 후 자동 로그인
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "회원가입에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-narrow">
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div className="brand" style={{ fontSize: 28 }}>
          twogetter
        </div>
        <p className="subtitle" style={{ marginTop: 8 }}>
          지금 가입하고 최애를 구독하세요
        </p>
      </div>
      <div className="card">
        <h2>회원가입</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>이메일</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="field">
            <label>닉네임</label>
            <input
              className="input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="응원명"
              required
            />
          </div>
          <div className="field">
            <label>비밀번호</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8자 이상"
              required
            />
          </div>
          <button className="btn btn-primary btn-block" disabled={busy} type="submit">
            {busy ? "가입 중…" : "가입하고 시작하기"}
          </button>
        </form>
      </div>
      <p className="muted" style={{ textAlign: "center", marginTop: 18 }}>
        이미 계정이 있으신가요?{" "}
        <Link href="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
          로그인
        </Link>
      </p>
    </div>
  );
}
