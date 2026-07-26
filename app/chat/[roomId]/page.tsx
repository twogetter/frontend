"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Guard from "../../components/Guard";
import { apiData, apiFetch, ApiError, getToken } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { connectChatSocket, type ChatRole } from "../../lib/chatSocket";
import type { ApiResponse, ChatMessage } from "../../lib/types";
import { formatTime } from "../../lib/format";

function Room({ roomId }: { roomId: number }) {
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [live, setLive] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef(false);

  // id 중복 없이 시간순으로 병합
  const merge = useCallback((incoming: ChatMessage[]) => {
    setMessages((prev) => {
      const map = new Map<number, ChatMessage>();
      for (const m of [...prev, ...incoming]) map.set(m.id, m);
      return [...map.values()].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const data = await apiData<ChatMessage[]>(
        `/api/chats/rooms/${roomId}/messages?size=50`
      );
      merge(data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "메시지를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [roomId, merge]);

  // 최초 히스토리 로드
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // 실시간 수신: WebSocket(STOMP) 구독
  useEffect(() => {
    const token = getToken();
    if (!token || !user) return;
    // 백엔드가 JWT role(USER)→FAN 으로 매핑. 프론트 구독 대역도 fan 기준.
    const role: ChatRole = user.role === "ARTIST" || user.role === "BUSINESS" ? "artist" : "fan";
    const disconnect = connectChatSocket(roomId, token, role, {
      onMessage: (msg) => merge([msg]),
      onStatus: (connected) => {
        liveRef.current = connected;
        setLive(connected);
      },
    });
    return disconnect;
  }, [roomId, user, merge]);

  // 폴백: WebSocket 미연결 시에만 폴링으로 수신 보완
  useEffect(() => {
    const t = setInterval(() => {
      if (!liveRef.current) loadHistory();
    }, 5000);
    return () => clearInterval(t);
  }, [loadHistory]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setSending(true);
    try {
      // 전송은 REST(하이브리드). 저장 후 백엔드가 상대 대역으로 WS 브로드캐스트한다.
      const res = await apiFetch<ApiResponse<ChatMessage>>(
        `/api/chats/rooms/${roomId}/messages`,
        { method: "POST", body: { content, messageType: "TEXT" } }
      );
      setText("");
      merge([res.data]); // 본인 메시지는 WS 로 돌아오지 않으므로 낙관적 반영
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  const isArtist = user?.role === "ARTIST" || user?.role === "BUSINESS";

  return (
    <div className="container">
      <div className="between" style={{ marginBottom: 8, alignItems: "center" }}>
        <button className="btn btn-sm btn-ghost" onClick={() => router.push("/chat")}>
          ← 채팅 목록
        </button>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isArtist && <span className="badge badge-primary">👑 아티스트 ({user?.nickname})</span>}
          <span className={`badge ${live ? "badge-active" : "badge-muted"}`}>
            {live ? "● 실시간" : "○ 폴링"}
          </span>
        </div>
      </div>

      <div className="chat-wrap">
        <div className="chat-messages">
          {loading ? (
            <div className="spinner" />
          ) : messages.length === 0 ? (
            <div className="empty" style={{ margin: "auto" }}>
              <div className="emoji">👋</div>
              <p>첫 메시지를 보내보세요.</p>
            </div>
          ) : (
            messages.map((m) => {
              const mine = user?.memberId === m.senderId;
              return (
                <div
                  key={m.id}
                  style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}
                >
                  {!mine && (
                    <span style={{ fontSize: "0.75rem", color: "#888", marginBottom: 2 }}>
                      {isArtist ? "💬 팬" : "🌟 아티스트"}
                    </span>
                  )}
                  <div className={`bubble ${mine ? "bubble-me" : "bubble-them"}`}>
                    {m.content}
                  </div>
                  <div className="bubble-time">{formatTime(m.createdAt)}</div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form className="chat-input-bar" onSubmit={send}>
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="메시지를 입력하세요"
          />
          <button className="btn btn-primary" type="submit" disabled={sending || !text.trim()}>
            전송
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ChatRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  return (
    <Guard>
      <Room roomId={Number(roomId)} />
    </Guard>
  );
}
