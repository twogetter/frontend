"use client";

import { useEffect, useState } from "react";
import Guard from "../../components/Guard";
import { apiData } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { PaymentMethod } from "../../lib/types";

function PaymentMethods() {
  const { user } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    apiData<PaymentMethod[]>(`/api/payments/methods/${user.memberId}`)
      .then(setMethods)
      .catch((e) => setError(e instanceof Error ? e.message : "결제수단을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="container-narrow">
      <h1>결제수단</h1>
      <p className="subtitle">정기 구독 결제에 사용할 카드입니다.</p>

      {error && <div className="alert alert-error">{error}</div>}

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
              {m.isDefault && <span className="badge badge-active">기본 결제</span>}
            </div>
          ))}
        </div>
      )}

      <div className="alert alert-info" style={{ marginTop: 20 }}>
        새 카드 등록(토스 브랜드페이)은 준비 중입니다.
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
