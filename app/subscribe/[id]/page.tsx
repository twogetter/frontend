"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Guard from "../../components/Guard";
import { apiData, apiFetch, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { ApiResponse, OrderResult, PaymentMethod } from "../../lib/types";
import { won } from "../../lib/format";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function Subscribe({ pid }: { pid: number }) {
  const router = useRouter();
  const q = useSearchParams();
  const { user } = useAuth();
  const name = q.get("name") ?? "구독권";
  const price = Number(q.get("price") ?? 0);

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<OrderResult | null>(null);

  useEffect(() => {
    if (!user) return;
    apiData<PaymentMethod[]>(`/api/payments/methods/${user.memberId}`)
      .then((all) => {
        // 정기 구독은 BILLING 으로 지정된 카드만 승인된다(payment-service BillingService).
        const m = all.filter((x) => x.type === "BILLING");
        setMethods(m);
        const def = m.find((x) => x.isDefault) ?? m[0];
        if (def) setSelected(def.id);
      })
      .catch(() => setMethods([]))
      .finally(() => setLoading(false));
  }, [user]);

  async function subscribe() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<ApiResponse<OrderResult>>("/api/orders/subscriptions", {
        method: "POST",
        headers: { "Idempotency-Key": uuid() },
        body: { productId: pid, paymentMethodId: selected },
      });
      setDone(res.data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "구독 신청에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="container-narrow">
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>🎉</div>
          <h2>구독 신청이 접수되었어요</h2>
          <p className="subtitle">
            결제가 확인되면 채팅이 열립니다. 잠시 후 내 구독에서 상태를 확인하세요.
          </p>
          <div className="stack">
            <button className="btn btn-primary" onClick={() => router.push("/mypage/subscriptions")}>
              내 구독 보기
            </button>
            <button className="btn btn-ghost" onClick={() => router.push("/")}>
              계속 둘러보기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-narrow">
      <h1>구독 확인</h1>
      <p className="subtitle">아래 내용으로 매월 정기 결제됩니다.</p>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="between" style={{ marginBottom: 10 }}>
          <span className="muted">상품</span>
          <span style={{ fontWeight: 700 }}>{name}</span>
        </div>
        <div className="between">
          <span className="muted">월 구독료</span>
          <span style={{ fontSize: 20, fontWeight: 800 }}>{won(price)}</span>
        </div>
      </div>

      <h2>결제수단</h2>
      {loading ? (
        <div className="spinner" />
      ) : methods.length === 0 ? (
        <>
          <div className="alert alert-info">
            정기결제로 지정된 카드가 없습니다. 결제수단 화면에서 카드를 등록하고 정기결제로 지정한 뒤
            다시 시도해 주세요.
          </div>
          <button
            className="btn btn-ghost btn-block"
            style={{ marginBottom: 20 }}
            onClick={() => router.push("/mypage/payment-methods")}
          >
            결제수단 관리로 이동
          </button>
        </>
      ) : (
        <div className="stack" style={{ marginBottom: 20 }}>
          {methods.map((m) => (
            <label
              key={m.id}
              className="card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
                borderColor: selected === m.id ? "var(--primary)" : "var(--border)",
                padding: 16,
              }}
            >
              <input
                type="radio"
                name="pm"
                checked={selected === m.id}
                onChange={() => setSelected(m.id)}
              />
              <div className="row-main">
                <div className="row-title">{m.displayName || m.provider}</div>
                <div className="row-sub">{m.maskedNumber}</div>
              </div>
              {m.isDefault && <span className="badge badge-muted">기본</span>}
            </label>
          ))}
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      <button
        className="btn btn-primary btn-block"
        disabled={busy || !selected}
        onClick={subscribe}
      >
        {busy ? "신청 중…" : `${won(price)} 구독 시작`}
      </button>
    </div>
  );
}

export default function SubscribePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Guard>
      <Subscribe pid={Number(id)} />
    </Guard>
  );
}
