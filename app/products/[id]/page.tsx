"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Guard from "../../components/Guard";
import { apiData } from "../../lib/api";
import type { ProductDetail } from "../../lib/types";
import { won, formatDate } from "../../lib/format";

function Detail({ id }: { id: string }) {
  const router = useRouter();
  const [p, setP] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiData<ProductDetail>(`/api/products/${id}`)
      .then(setP)
      .catch((e) => setError(e instanceof Error ? e.message : "상품을 찾을 수 없습니다."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="spinner" />;
  if (error || !p)
    return (
      <div className="container">
        <div className="empty">
          <div className="emoji">😢</div>
          <p>{error ?? "상품을 찾을 수 없습니다."}</p>
        </div>
      </div>
    );

  return (
    <div className="container">
      <button className="btn btn-sm btn-ghost" onClick={() => router.back()} style={{ marginBottom: 20 }}>
        ← 뒤로
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,380px) 1fr", gap: 40, alignItems: "start" }}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.imageUrl}
            alt={p.artistName}
            style={{
              width: "100%",
              aspectRatio: "1/1",
              objectFit: "cover",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--bg-elev)",
            }}
          />
        </div>
        <div>
          <div className="product-group">{p.groupName || "ARTIST"}</div>
          <h1 style={{ marginTop: 4 }}>{p.name}</h1>
          <p className="subtitle">{p.artistName}</p>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="between" style={{ marginBottom: 12 }}>
              <span className="muted">월 구독료</span>
              <span style={{ fontSize: 24, fontWeight: 800 }}>{won(p.price)}</span>
            </div>
            <div className="between">
              <span className="muted">오픈일</span>
              <span>{formatDate(p.openDate)}</span>
            </div>
          </div>

          <p style={{ color: "var(--text-dim)", whiteSpace: "pre-wrap", marginBottom: 24 }}>
            {p.description}
          </p>

          <button
            className="btn btn-primary btn-block"
            onClick={() =>
              router.push(
                `/subscribe/${p.pid}?name=${encodeURIComponent(p.name)}&price=${p.price}`
              )
            }
          >
            구독하고 채팅 시작하기
          </button>
          <p className="muted" style={{ textAlign: "center", marginTop: 12 }}>
            매월 자동 결제 · 언제든 해지 가능
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Guard>
      <Detail id={id} />
    </Guard>
  );
}
