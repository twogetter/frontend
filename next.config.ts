import type { NextConfig } from "next";

// 게이트웨이(8080)로 서버사이드 프록시하여 브라우저 CORS를 회피한다.
// SSE(알림 실시간)만 게이트웨이 JWT 필터를 우회해야 하므로 notification-service(8500)로 직접 프록시한다.
const GATEWAY = process.env.GATEWAY_URL ?? "http://localhost:8080";
const NOTIFICATION = process.env.NOTIFICATION_URL ?? "http://localhost:8500";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // 알림 SSE: EventSource 는 Authorization 헤더를 못 실으므로 게이트웨이(JWT 필수)를 우회.
      // notification 컨트롤러는 receiverId 쿼리파라미터로 수신자를 식별한다.
      {
        source: "/stream/notifications/:path*",
        destination: `${NOTIFICATION}/api/notifications/:path*`,
      },
      // 그 외 모든 API 는 게이트웨이 경유(JWT→X-User-Id 주입).
      { source: "/api/:path*", destination: `${GATEWAY}/api/:path*` },
    ];
  },
};

export default nextConfig;
