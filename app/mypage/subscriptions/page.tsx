"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Guard from "../../components/Guard";
import { apiData } from "../../lib/api";
import type { Subscription } from "../../lib/types";
import { won, formatDate, subscriptionStatusLabel } from "../../lib/format";

function Subscriptions() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiData<Subscription[]>("/api/v1/orders/subscriptions")
      .then(setSubs)
      .catch((e) => setError(e instanceof Error ? e.message : "구독을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container">
      <h1>내 구독</h1>
      <p className="subtitle">구독 중인 아티스트와 결제 상태를 확인하세요.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="spinner" />
      ) : subs.length === 0 ? (
        <div className="empty">
          <div className="emoji">💜</div>
          <p>아직 구독 중인 아티스트가 없어요.</p>
          <Link href="/" className="btn btn-primary" style={{ marginTop: 14 }}>
            구독권 둘러보기
          </Link>
        </div>
      ) : (
        <div className="card">
          {subs.map((s) => {
            const st = subscriptionStatusLabel(s.status);
            return (
              <div className="row" key={s.subscriptionId}>
                <span className="avatar">{s.productName?.[0] ?? "♪"}</span>
                <div className="row-main">
                  <div className="row-title">{s.productName}</div>
                  <div className="row-sub">
                    {won(s.amount)} / 월
                    {s.nextBillingDate ? ` · 다음 결제 ${formatDate(s.nextBillingDate)}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className={`badge ${st.cls}`}>{st.label}</span>
                  {s.status === "ACTIVE" && (
                    <Link href="/chat" className="btn btn-sm">
                      채팅
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SubscriptionsPage() {
  return (
    <Guard>
      <Subscriptions />
    </Guard>
  );
}
