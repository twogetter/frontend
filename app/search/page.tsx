"use client";

import { useState } from "react";
import Guard from "../components/Guard";
import ProductCard from "../components/ProductCard";
import { apiData } from "../lib/api";
import type { ProductList } from "../lib/types";

function Search() {
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<ProductList["items"]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ keyword: keyword.trim(), size: "20" });
      const data = await apiData<ProductList>(`/api/products/search?${params}`);
      setItems(data.items);
      setSearched(true);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "검색에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1>검색</h1>
      <p className="subtitle">아티스트 이름이나 그룹명으로 찾아보세요.</p>

      <form onSubmit={run} style={{ display: "flex", gap: 10, marginBottom: 28 }}>
        <input
          className="input"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="예: 아이유, 세븐틴"
          autoFocus
        />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "검색 중…" : "검색"}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="spinner" />
      ) : searched && items.length === 0 ? (
        <div className="empty">
          <div className="emoji">🔍</div>
          <p>검색 결과가 없어요.</p>
        </div>
      ) : items.length > 0 ? (
        <div className="grid">
          {items.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Guard>
      <Search />
    </Guard>
  );
}
