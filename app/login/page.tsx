"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "로그인에 실패했습니다.");
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
          최애와 더 가까워지는 시간
        </p>
      </div>
      <div className="card">
        <h2>로그인</h2>
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
            <label>비밀번호</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button className="btn btn-primary btn-block" disabled={busy} type="submit">
            {busy ? "로그인 중…" : "로그인"}
          </button>
        </form>
      </div>
      <p className="muted" style={{ textAlign: "center", marginTop: 18 }}>
        아직 회원이 아니신가요?{" "}
        <Link href="/signup" style={{ color: "var(--primary)", fontWeight: 600 }}>
          회원가입
        </Link>
      </p>
    </div>
  );
}
