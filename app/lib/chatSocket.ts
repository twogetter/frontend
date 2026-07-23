// chat-service 하이브리드 채팅의 WebSocket(STOMP) 수신 클라이언트.
// 전송은 REST(POST /api/chat/rooms/{id}/messages), 실시간 수신은 이 소켓으로 처리한다.
//
// 백엔드 계약(feat/58-chat-webSocket):
//  - 엔드포인트: /ws (raw WebSocket)
//  - CONNECT: STOMP 헤더 Authorization: Bearer <accessToken>
//  - 팬 구독 대역: /sub/rooms/{roomId}/artist  (아티스트가 보낸 메시지 수신)
//  - 아티스트 구독 대역: /sub/rooms/{roomId}/fan
import { Client, type IMessage } from "@stomp/stompjs";
import type { ChatMessage } from "./types";

// 브라우저에서 chat-service 로 직접 연결(게이트웨이는 WS 라우팅 미구성).
// WebSocketConfig 가 origin http://localhost:3000 을 허용한다.
const WS_URL =
  process.env.NEXT_PUBLIC_CHAT_WS_URL ?? "ws://localhost:8600/ws";

export type ChatRole = "fan" | "artist";

export interface ChatSocketHandlers {
  onMessage: (msg: ChatMessage) => void;
  onStatus?: (connected: boolean) => void;
}

/**
 * 방의 실시간 수신 구독을 시작한다. 반환된 함수를 호출하면 해제된다.
 * role=fan 이면 /artist 대역(아티스트 메시지)을, artist 면 /fan 대역을 구독한다.
 */
export function connectChatSocket(
  roomId: number,
  token: string,
  role: ChatRole,
  handlers: ChatSocketHandlers
): () => void {
  const band = role === "fan" ? "artist" : "fan";
  const destination = `/sub/rooms/${roomId}/${band}`;

  const client = new Client({
    brokerURL: WS_URL,
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 4000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => {
      handlers.onStatus?.(true);
      client.subscribe(destination, (frame: IMessage) => {
        try {
          const msg = JSON.parse(frame.body) as ChatMessage;
          handlers.onMessage(msg);
        } catch {
          /* ignore malformed frame */
        }
      });
    },
    onDisconnect: () => handlers.onStatus?.(false),
    onWebSocketClose: () => handlers.onStatus?.(false),
    onStompError: () => handlers.onStatus?.(false),
  });

  client.activate();

  return () => {
    handlers.onStatus?.(false);
    client.deactivate().catch(() => {});
  };
}
