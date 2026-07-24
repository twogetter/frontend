# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개요

`twogetter` 서비스(구독한 팬 ↔ 아티스트 실시간 채팅)의 **팬용 웹 프론트엔드**.
Next.js 15.5(App Router) + React 19 + TypeScript(strict). 백엔드 Spring Cloud MSA와 게이트웨이(8080)를 통해 연동한다.

워크스페이스는 `twogetter/backend`(별도 git 저장소)와 `twogetter/frontend`(이 저장소)로 나뉜다.
상위 워크스페이스에 있는 `../../CLAUDE.md`(WonkaoTalk 모놀리식 설명)는 **다른 프로젝트의 잔재이므로 무시**한다.

## 명령어

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm start
```

- 테스트 프레임워크 없음. 검증은 `npm run build`(타입체크 포함) 또는 `npx tsc --noEmit`로 한다.
- `npm run lint`는 `next lint`지만 **ESLint가 devDependencies에 없어 그대로는 동작하지 않는다**. 린트를 요구받기 전엔 빌드/타입체크로 대체.
- ⚠️ `npm run dev` 실행 중에 `npm run build`를 돌리면 같은 `.next` 캐시를 덮어써 `Cannot find module './xxx.js'`로 깨진다. 깨졌으면 `rm -rf .next` 후 dev 재시작.
- 백엔드 기동(도커 컴포즈 순서, `.env` 필수값, 스모크 테스트)은 `README.md` 1장 참고. 프론트만 띄우면 API는 전부 실패한다.

## 아키텍처

### 네트워크 경로 — 세 갈래

`next.config.ts`의 rewrites가 서버사이드 프록시로 CORS를 회피한다. 이 세 경로의 구분이 이 프로젝트의 핵심 제약이다.

| 경로 | 대상 | 이유 |
|---|---|---|
| `/api/*` | 게이트웨이 `:8080` | 기본 경로. 게이트웨이가 JWT를 검증해 `X-User-Id` 헤더로 변환해 서비스에 전달 |
| `/stream/notifications/*` | notification-service `:8500` **직결** | SSE. `EventSource`는 `Authorization` 헤더를 실을 수 없어 게이트웨이 JWT 필터를 우회해야 한다. 대신 `receiverId` 쿼리파라미터로 수신자를 식별 |
| `ws://localhost:8600/ws` | chat-service **직결**(프록시 없음) | 게이트웨이에 WebSocket 라우팅이 없다. `NEXT_PUBLIC_CHAT_WS_URL`로 재정의 가능 |

환경변수(선택, `.env.local`): `GATEWAY_URL`, `NOTIFICATION_URL`, `NEXT_PUBLIC_CHAT_WS_URL`.

### API 클라이언트 (`app/lib/api.ts`)

모든 호출은 `apiFetch`/`apiData`를 거친다(raw `fetch` 금지). Bearer 토큰 주입 + 401 시 `/api/auth/refresh` 1회 재시도 → 실패하면 토큰 삭제 후 `/login` 리다이렉트.

**응답 래핑이 서비스마다 다르다** — 여기서 자주 틀린다:
- `product` / `order` / `chat` / `payment` → `ApiResponse<T>` 래퍼(`{status, message, data, …}`) → **`apiData<T>`** 사용
- `auth` / `user` / `notification` → 원시 바디 → **`apiFetch<T>`** 사용

### 인증 (`app/lib/auth.tsx`)

- 액세스 토큰은 `localStorage["accessToken"]`, 리프레시 토큰은 HTTP-only 쿠키(브라우저 관리, `credentials: "include"`).
- **사용자 정보는 서버 조회 없이 JWT 페이로드를 디코드해서 얻는다**(`sub`=memberId, `role`, `nickname`). `decodeJwt`는 한글 닉네임 때문에 UTF-8 수동 디코딩을 한다 — 단순 `atob`로 바꾸지 말 것.
- 로그인 필수 페이지는 `<Guard>`로 감싼다(미인증 시 `/login` replace).

### 채팅 — REST 전송 + WS 수신 하이브리드

`app/chat/[roomId]/page.tsx` + `app/lib/chatSocket.ts`:
- 전송은 `POST /api/chat/rooms/{id}/messages`(REST). 백엔드가 커밋 후 **상대 대역으로만** broadcast하므로, 본인 메시지는 WS로 돌아오지 않는다 → 응답을 낙관적으로 `merge`한다.
- 수신은 STOMP 구독. 팬은 `/sub/rooms/{roomId}/artist`, 아티스트는 `/sub/rooms/{roomId}/fan`(자기 반대 대역). CONNECT 헤더에 `Authorization: Bearer <token>`.
- WS가 끊기면 5초 폴링으로 폴백(UI 배지 `● 실시간` / `○ 폴링`). 메시지는 id 기준 dedupe 후 시간순 정렬(`merge`).

### 구독 결제

`POST /api/orders/subscriptions`는 **`Idempotency-Key` 헤더(UUID)를 요구**한다(`app/subscribe/[id]/page.tsx`).
상품 상세의 `id`는 Mongo ObjectId(문자열, 조회용)이고 `pid`는 구독 생성에 쓰는 Long ID — 혼동 주의.

## 컨벤션

- 라우트 페이지는 대부분 `"use client"`. 데이터는 `useEffect` + `apiData`/`apiFetch`로 클라이언트에서 로드한다(서버 컴포넌트 fetch 미사용 — 토큰이 localStorage에 있기 때문).
- 동적 라우트 params는 Next 15 방식대로 `Promise`이며 `use(params)`로 언랩한다.
- 백엔드 DTO에 대응하는 타입은 전부 `app/lib/types.ts`에 모은다. 백엔드 응답 구조가 바뀌면 여기부터 고친다.
- 스타일링은 **CSS 프레임워크 없음**. `app/globals.css`의 CSS 변수(다크 퍼플 테마: `--bg`, `--primary`, `--radius` …)와 유틸 클래스(`container`, `card`, `btn btn-primary`, `badge`, `alert`, `stack`, `between`, `spinner`)를 재사용한다. 새 색/반경을 하드코딩하지 말고 변수를 쓴다.
- 사용자에게 보이는 문구는 한국어.
- 경로 별칭 `@/*` → 저장소 루트(현재 코드는 대부분 상대 경로 사용).

## 로컬 환경의 알려진 제약

- **결제수단 등록 불가**: Toss 브랜드페이 결제수단은 Toss → `payment-service` 웹훅으로 동기화되는데 웹훅이 `localhost`에 도달하지 못한다. 결제수단이 비어 구독 버튼이 비활성 상태가 정상이다. 우회책은 `docs/frontend-backend-integration-analysis.md` 참고.
- **신규 상품이 홈에 안 보임**: 등록 직후 상태가 `PENDING_OPEN`이고 홈 목록은 `ACTIVE`만 노출한다. `README.md` 4장의 mongosh 명령으로 전환.
- 미해결 백엔드 연결점(아티스트 참여자 자동 등록, 게이트웨이 WS 라우팅 등)은 `docs/frontend-backend-integration-analysis.md`, 결제 라우팅 보류 건은 `docs/payment-gateway-routing.md`에 정리돼 있다.
