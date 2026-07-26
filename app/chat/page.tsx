"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Guard from "../components/Guard";
import { apiData } from "../lib/api";
import type { ChatRoom } from "../lib/types";

import { useAuth } from "../lib/auth";

function ChatList() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isArtist = user?.role === "ARTIST" || user?.role === "BUSINESS";

  useEffect(() => {
    apiData<ChatRoom[]>("/api/chats/rooms")
      .then(setRooms)
      .catch((e) => setError(e instanceof Error ? e.message : "채팅방을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container">
      <div className="between" style={{ alignItems: "center" }}>
        <h1>채팅</h1>
        {isArtist && <span className="badge badge-primary">👑 아티스트 모드 ({user?.nickname})</span>}
      </div>
      <p className="subtitle">
        {isArtist ? "팬들과 소통하는 아티스트 채널입니다." : "구독 중인 아티스트와의 대화입니다."}
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="spinner" />
      ) : rooms.length === 0 ? (
        <div className="empty">
          <div className="emoji">💬</div>
          <p>아직 열린 채팅방이 없어요.</p>
          <p className="muted">
            {isArtist ? "아직 생성된 채팅방이 없습니다." : "구독이 활성화되면 채팅방이 생성됩니다."}
          </p>
        </div>
      ) : (
        <div className="card">
          {rooms.map((r) => (
            <Link key={r.roomId} href={`/chat/${r.roomId}`} className="row" style={{ cursor: "pointer" }}>
              <span className="avatar">{isArtist ? "👑" : "♪"}</span>
              <div className="row-main">
                <div className="row-title">
                  {isArtist ? `팬 소통 채널 (방 번호: #${r.roomId})` : `아티스트 #${r.artistId}`}
                </div>
                <div className="row-sub">{r.status}</div>
              </div>
              {r.unreadCount > 0 && (
                <span className="badge badge-active">{r.unreadCount}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatListPage() {
  return (
    <Guard>
      <ChatList />
    </Guard>
  );
}
