"use client";

import { useCallback, useEffect, useState } from "react";
import Guard from "../components/Guard";
import { apiFetch, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { NotificationList, Notification } from "../lib/types";
import { timeAgo } from "../lib/format";

function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiFetch<NotificationList>(
        `/api/notifications/list?receiverId=${user.memberId}&page=0&size=30`
      );
      setItems(data.notifications);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "알림을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // SSE 실시간 수신 (게이트웨이 우회, receiverId 로 식별)
  useEffect(() => {
    if (!user) return;
    const es = new EventSource(
      `/stream/notifications/connect?receiverId=${user.memberId}`
    );
    es.onopen = () => setLive(true);
    es.addEventListener("notification", () => load());
    es.onerror = () => setLive(false);
    return () => es.close();
  }, [user, load]);

  async function markRead(n: Notification) {
    if (!user || n.readAt) return;
    try {
      await apiFetch<void>(
        `/api/notifications/read/${n.id}?receiverId=${user.memberId}`,
        { method: "PATCH" }
      );
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
      );
    } catch {
      // 무시
    }
  }

  return (
    <div className="container">
      <div className="between">
        <h1>알림</h1>
        <span className={`badge ${live ? "badge-active" : "badge-muted"}`}>
          {live ? "● 실시간" : "○ 연결 대기"}
        </span>
      </div>
      <p className="subtitle">결제·구독 소식을 실시간으로 받아보세요.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="spinner" />
      ) : items.length === 0 ? (
        <div className="empty">
          <div className="emoji">🔔</div>
          <p>새로운 알림이 없어요.</p>
        </div>
      ) : (
        <div className="card">
          {items.map((n) => (
            <div
              key={n.id}
              className="row"
              style={{ cursor: n.readAt ? "default" : "pointer", opacity: n.readAt ? 0.6 : 1 }}
              onClick={() => markRead(n)}
            >
              {!n.readAt && <span className="dot" />}
              <div className="row-main">
                <div className="row-title">{n.title}</div>
                <div className="row-sub">{n.contents}</div>
              </div>
              <span className="muted">{timeAgo(n.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Guard>
      <Notifications />
    </Guard>
  );
}
