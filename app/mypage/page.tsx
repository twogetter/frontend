"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Guard from "../components/Guard";
import { apiFetch, ApiError, clearToken } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { MemberInfo } from "../lib/types";

function MyPage() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  const [info, setInfo] = useState<MemberInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    apiFetch<MemberInfo>(`/api/users/${user.memberId}`)
      .then((m) => {
        setInfo(m);
        setNickname(m.nickname);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "정보를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [user]);

  async function save() {
    if (!user) return;
    setError(null);
    setMsg(null);
    try {
      await apiFetch<void>(`/api/users/${user.memberId}/profile`, {
        method: "PATCH",
        body: { nickname },
      });
      setInfo((prev) => (prev ? { ...prev, nickname } : prev));
      setEditing(false);
      setMsg("프로필이 저장되었습니다.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "저장에 실패했습니다.");
    }
  }

  async function withdraw() {
    if (!user) return;
    if (!confirm("정말 탈퇴하시겠어요? 모든 구독이 해지되고 되돌릴 수 없습니다.")) return;
    try {
      await apiFetch<void>(`/api/users/${user.memberId}`, { method: "DELETE" });
      clearToken();
      router.push("/signup");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "탈퇴 처리에 실패했습니다.");
    }
  }

  if (loading) return <div className="spinner" />;

  return (
    <div className="container-narrow">
      <h1>마이페이지</h1>
      <p className="subtitle">계정 정보와 구독을 관리하세요.</p>

      {error && <div className="alert alert-error">{error}</div>}
      {msg && <div className="alert alert-info">{msg}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <span className="avatar" style={{ width: 56, height: 56, fontSize: 22 }}>
            {info?.nickname?.[0] ?? "U"}
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{info?.nickname}</div>
            <div className="muted">{info?.email}</div>
          </div>
        </div>

        {editing ? (
          <>
            <div className="field">
              <label>닉네임</label>
              <input
                className="input"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" onClick={save}>
                저장
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setEditing(false);
                  setNickname(info?.nickname ?? "");
                }}
              >
                취소
              </button>
            </div>
          </>
        ) : (
          <button className="btn" onClick={() => setEditing(true)}>
            프로필 수정
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <Link href="/mypage/subscriptions" className="row" style={{ cursor: "pointer" }}>
          <div className="row-main">
            <div className="row-title">내 구독</div>
            <div className="row-sub">구독 중인 아티스트 관리</div>
          </div>
          <span className="muted">→</span>
        </Link>
        <Link href="/mypage/payment-methods" className="row" style={{ cursor: "pointer" }}>
          <div className="row-main">
            <div className="row-title">결제수단</div>
            <div className="row-sub">등록된 카드 관리</div>
          </div>
          <span className="muted">→</span>
        </Link>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn btn-ghost" onClick={() => logout()}>
          로그아웃
        </button>
        <button
          className="btn btn-ghost"
          style={{ color: "var(--danger)" }}
          onClick={withdraw}
        >
          회원 탈퇴
        </button>
      </div>
    </div>
  );
}

export default function MyPageWrap() {
  return (
    <Guard>
      <MyPage />
    </Guard>
  );
}
