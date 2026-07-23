"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Guard from "./components/Guard";
import ProductCard from "./components/ProductCard";
import { apiData } from "./lib/api";
import type { ProductList } from "./lib/types";
import { useAuth } from "./lib/auth";

function Browse() {
  const { user } = useAuth();
  const [items, setItems] = useState<ProductList["items"]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [group, setGroup] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (g: string | null, cur: string | null, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ size: "20" });
        if (g) params.set("groupName", g);
        if (cur) params.set("cursor", cur);
        const data = await apiData<ProductList>(`/api/products?${params}`);
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setCursor(data.nextCursor);
        setHasNext(data.hasNext);
      } catch (e) {
        setError(e instanceof Error ? e.message : "상품을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    apiData<string[]>("/api/products/groups")
      .then(setGroups)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load(group, null, false);
  }, [group, load]);

  return (
    <div className="container">
      <div className="hero">
        <span className="tag">✨ 최애 구독 서비스</span>
        <h1>
          {user ? `${user.nickname}님, ` : ""}오늘은 누구와 이야기할까요?
        </h1>
        <p className="subtitle">
          구독권을 구매하면 아티스트와 1:1 채팅으로 연결됩니다.
        </p>
      </div>

      {groups.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          <button
            className={`btn btn-sm ${group === null ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setGroup(null)}
          >
            전체
          </button>
          {groups.map((g) => (
            <button
              key={g}
              className={`btn btn-sm ${group === g ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setGroup(g)}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {loading && items.length === 0 ? (
        <div className="spinner" />
      ) : items.length === 0 ? (
        <div className="empty">
          <div className="emoji">🫧</div>
          <p>아직 오픈된 구독권이 없어요.</p>
          <p className="muted">곧 새로운 아티스트가 찾아옵니다.</p>
        </div>
      ) : (
        <>
          <div className="grid">
            {items.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
          {hasNext && (
            <div style={{ textAlign: "center", marginTop: 28 }}>
              <button
                className="btn"
                disabled={loading}
                onClick={() => load(group, cursor, true)}
              >
                {loading ? "불러오는 중…" : "더 보기"}
              </button>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 40, textAlign: "center" }}>
        <Link href="/search" className="muted">
          찾는 아티스트가 있나요? 검색하기 →
        </Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Guard>
      <Browse />
    </Guard>
  );
}
