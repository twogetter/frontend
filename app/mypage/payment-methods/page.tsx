"use client";

import { useCallback, useEffect, useState } from "react";
import Guard from "../../components/Guard";
import { apiData, apiFetch, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { PaymentMethod } from "../../lib/types";

// 브랜드페이 등록 화면은 payment-service 가 서버렌더하므로 게이트웨이(프록시)를 거치지 않고 직접 연다.
const PAYMENT_URL = process.env.NEXT_PUBLIC_PAYMENT_URL ?? "http://localhost:8300";

function PaymentMethods() {
  const { user } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setMethods(await apiData<PaymentMethod[]>(`/api/payments/methods/${user.memberId}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "결제수단을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  function openBrandpay() {
    if (!user) return;
    window.open(`${PAYMENT_URL}/brandpay/checkout?userId=${user.memberId}`, "_blank");
  }

  // 카드 등록은 별도 창에서 진행되므로, 돌아온 뒤 토스에 등록된 결제수단을 끌어온다.
  async function sync() {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const fresh = await apiData<PaymentMethod[]>("/api/payments/methods/sync", { method: "POST" });
      setMethods(fresh);
      setNotice(
        fresh.length === 0
          ? "토스에 등록된 카드가 없습니다. 브랜드페이 창에서 카드를 먼저 등록해 주세요."
          : `결제수단 ${fresh.length}건을 불러왔습니다.`
      );
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? "브랜드페이 연결 이력이 없습니다. 먼저 카드 등록을 진행해 주세요."
          : e instanceof Error
            ? e.message
            : "결제수단 동기화에 실패했습니다."
      );
    } finally {
      setSyncing(false);
    }
  }

  // 구독 주문은 BILLING 타입 결제수단만 받는다(payment-service BillingService).
  async function designateBilling(id: number) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/payments/methods/${id}/billing`, { method: "POST" });
      await load();
      setNotice("정기결제 카드로 지정되었습니다. 이제 구독을 진행할 수 있어요.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "정기결제 카드 지정에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="container-narrow">
      <h1>결제수단</h1>
      <p className="subtitle">정기 구독 결제에 사용할 카드입니다.</p>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-info">{notice}</div>}

      <div className="stack" style={{ marginBottom: 20 }}>
        <button className="btn btn-primary btn-block" onClick={openBrandpay}>
          카드 등록 · 약관동의 (브랜드페이)
        </button>
        <button className="btn btn-ghost btn-block" onClick={sync} disabled={syncing}>
          {syncing ? "불러오는 중…" : "등록한 카드 불러오기"}
        </button>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : methods.length === 0 ? (
        <div className="empty">
          <div className="emoji">💳</div>
          <p>등록된 결제수단이 없어요.</p>
        </div>
      ) : (
        <div className="card">
          {methods.map((m) => (
            <div className="row" key={m.id}>
              <span className="avatar" style={{ background: "var(--bg-elev)", color: "var(--text-dim)" }}>
                💳
              </span>
              <div className="row-main">
                <div className="row-title">{m.displayName || m.provider}</div>
                <div className="row-sub">
                  {m.maskedNumber} · {m.status}
                </div>
              </div>
              {m.type === "BILLING" ? (
                <span className="badge badge-active">정기결제</span>
              ) : (
                <button
                  className="btn btn-sm"
                  disabled={busyId === m.id}
                  onClick={() => designateBilling(m.id)}
                >
                  {busyId === m.id ? "지정 중…" : "정기결제로 지정"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="alert alert-info" style={{ marginTop: 20 }}>
        <strong>구독까지 3단계</strong>
        <br />
        1. 브랜드페이 창에서 <b>결제수단추가</b> → 카드 등록
        <br />
        2. 같은 창에서 <b>정기 자동결제 약관동의</b>
        <br />
        3. 이 화면으로 돌아와 <b>등록한 카드 불러오기</b> → <b>정기결제로 지정</b>
      </div>
    </div>
  );
}

export default function PaymentMethodsPage() {
  return (
    <Guard>
      <PaymentMethods />
    </Guard>
  );
}
