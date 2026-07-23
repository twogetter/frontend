// 백엔드 DTO에 정렬한 프론트엔드 타입.

// 공통 ApiResponse 래퍼 (product/order/chat/payment). auth/user/notification 은 원시 바디를 반환.
export interface ApiResponse<T> {
  status: string;
  message: string;
  data: T;
  error?: unknown;
  timestamp: string;
}

// ── auth ──
export interface SignUpResponse {
  memberId: number;
  email: string;
  nickname: string;
}
export interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

// JWT payload (auth-service 서명)
export interface JwtClaims {
  sub: string; // memberId
  role: string;
  nickname: string;
  tokenType: string;
  exp: number;
  iat: number;
}

// ── user ──
export interface MemberInfo {
  memberId: number;
  email: string;
  nickname: string;
  profileImageUrl: string | null;
  role: string;
  status: string;
}
export interface MemberProfileUpdate {
  nickname?: string;
  profileImageUrl?: string;
}

// ── product ──
export interface ProductListItem {
  id: string; // mongo id (상세 조회 키)
  artistName: string;
  groupName: string;
  imageUrl: string;
  price: number;
}
export interface ProductList {
  items: ProductListItem[];
  nextCursor: string | null;
  hasNext: boolean;
}
export interface ProductDetail {
  id: string;
  pid: number; // 구독 생성 시 사용하는 Long 상품 ID
  artistId: number;
  artistName: string;
  groupName: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  status: string;
  openDate: string;
}

// ── order / subscription ──
export interface OrderResult {
  orderId: number;
  subscriptionId: number;
  status: string;
}
export interface Subscription {
  subscriptionId: number;
  productId: number;
  productName: string;
  status: string;
  amount: number;
  nextBillingDate: string | null;
  startedAt: string | null;
}

// ── payment ──
export interface PaymentMethod {
  id: number;
  provider: string;
  type: string;
  displayName: string;
  maskedNumber: string;
  isDefault: boolean;
  status: string;
}

// ── chat ──
export type MessageType = "TEXT" | "IMAGE";
export interface ChatRoom {
  roomId: number;
  artistId: number;
  status: string;
  lastReadId: number | null;
  role: string;
  participantStatus: string;
  unreadCount: number;
}
export interface ChatMessage {
  id: number;
  roomId: number;
  senderId: number;
  content: string;
  messageType: MessageType;
  createdAt: string;
}

// ── notification ──
export interface Notification {
  id: number;
  notificationType: string;
  title: string;
  contents: string;
  linkUrl: string | null;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}
export interface NotificationList {
  notifications: Notification[];
  page: number;
  size: number;
  hasNext: boolean;
}
