# 남은 백엔드 후속 ↔ 프론트엔드 연결점 분석

> 작성 2026-07-23. 대상: `twogetter/frontend`(Next.js 15) ↔ 백엔드 MSA.
> 현재 실행 스택: 게이트웨이 경유(8080), chat만 WS 브랜치 임시 컨테이너, dev 프론트 3000.

각 항목을 **백엔드 상태 · 프론트 연결점 · 남은 작업** 으로 정리한다.

---

## 1. Toss 결제 (테스트모드) — 최우선

**백엔드 상태**
- **이미 테스트모드**: config-repo `payment-service.yml` 의 키가 전부 Toss 테스트 키다.
  - `client-key: test_ck_...`, `api-secret-key: test_sk_...`, `widget-secret-key: test_gsk_docs_...`
  - `base-url: https://api.tosspayments.com/v1` — 테스트/라이브 공용(키로 구분). 별도 sandbox URL 없음 → **키가 test_ 이면 테스트모드**.
- 정기결제는 **브랜드페이(billing key)** 기반. `BillingPaymentFacade.executeBilling` 이 결제수단의 `methodKey` 로 Toss 빌링 승인.
- payment-service 가 **자체 결제 UI 를 제공**한다(Thymeleaf): `/brandpay/checkout`, `/widget/index`, `/payment/*` + `static/js/brandpay-payment-manager.js`.
- 결제수단 등록 흐름: `getCustomerKey(userId)`(customerKey=`userId_UUID` 생성) → 브랜드페이 SDK 인증 → `/brandpay/callback-auth?userId&customerKey&code`(code→accessToken) → 카드 추가 → **웹훅 `METHOD_UPDATED` → `syncPaymentMethods`** 로 `PaymentMethod` 저장.

**프론트 연결점**
- `app/subscribe/[id]/page.tsx` — 결제수단 목록(`GET /api/payments/methods/{userId}`)에서 선택. **현재 결제수단이 없어 버튼 비활성** + "브랜드페이 준비 중" 안내.
- `app/mypage/payment-methods/page.tsx` — 결제수단 목록/등록 진입.
- **핵심**: 프론트가 Toss SDK 를 직접 구현할 필요 없음 → payment-service 의 `/brandpay/checkout` 페이지로 **핸드오프**하는 것이 연결점.

**남은 작업 / 로컬 제약**
- ⚠️ **웹훅 미도달**: `syncPaymentMethods` 는 Toss→`/brandpay/webhooks/toss-brandpay` 웹훅으로 트리거되는데 Toss 가 `localhost:8300` 에 도달 못함. 로컬에선 (a) ngrok 등 **공개 터널**로 웹훅 수신, 또는 (b) 카드 등록 직후 **`syncPaymentMethods(customerKey)` 수동 호출**로 대체 필요.
- ⚠️ 브랜드페이 체크아웃은 `orderId` 파라미터 전제(순수 카드등록 진입점 없음) → 등록 전용 흐름이면 별도 정리 필요.
- ✅ 테스트모드 자체는 설정 완료. 프론트 연결은 "결제수단 등록 → `/brandpay/checkout` 핸드오프 + 복귀 후 목록 재조회" 로 구현 가능(터널/수동 sync 전제).
- 대안: 정기결제가 아닌 단건은 `/widget/*`(Toss 결제위젯, 테스트카드로 로컬 완결 가능)이 더 간단 — 구독 모델과는 불일치.

---

## 2. 채팅 WebSocket 브랜치 머지

**백엔드 상태**
- 실 WS 코드는 `origin/feat/58-chat-webSocket`(미머지). 현재 chat-service 는 그 브랜치로 빌드한 **임시 컨테이너**(`chat-ws` 이미지)로 실행 중.
- 계약: STOMP `/ws`, CONNECT `Authorization: Bearer`, 팬 구독 `/sub/rooms/{roomId}/artist`, 전송은 REST→커밋 후 broadcast.

**프론트 연결점**
- `app/lib/chatSocket.ts` — `ws://localhost:8600/ws` **직접 연결**(게이트웨이 WS 라우팅 미구성), JWT on CONNECT, `/sub/rooms/{id}/artist` 구독. REST 전송 + WS 수신 하이브리드, WS 끊기면 폴링 폴백.

**남은 작업**
- WS 브랜치를 `develop` 에 머지 → 정식 compose 빌드로 chat-service 에 `/ws` 내장(프론트 변경 불필요).
- 게이트웨이 WebSocket 라우팅 결정: 현재는 8600 직결. 프로덕션에선 `NEXT_PUBLIC_CHAT_WS_URL` 로 도메인/게이트웨이 경유 지정. Spring Cloud Gateway WS 라우트 추가 필요.

---

## 3. 채팅방 생성 시 아티스트 참여자 자동 등록 부재

**백엔드 상태**
- `ChatRoomService.createChatRoom(artistId)` 은 방만 생성. **ARTIST 참여자를 넣지 않음**. `OrderCreatedEvent` 소비 시 FAN 만 입장.
- 결과: 방에 응답할 아티스트 참여자가 없음(현재 데모는 직접 POST 로 시뮬레이션).

**프론트 연결점**
- 채팅은 **팬 전용** 앱으로 구성됨(현재 프론트는 role USER=FAN 기준). 아티스트 답장 UI/앱 부재.

**남은 작업**
- 방 생성 시(또는 아티스트 온보딩 시) ARTIST 참여자 등록 정책 결정.
- 아티스트용 화면(또는 별도 앱): role ARTIST 로 로그인 → `/sub/rooms/{id}/fan` 구독 + REST 전송. 현재 프론트 `chatSocket`/room 페이지는 role 분기를 이미 갖고 있어 확장 가능.

---

## 4. config-repo 설정 공백 (compose env 오버라이드 임시)

**백엔드 상태 (검증 중 발견 → docker-compose.yml env 로 임시 언블록)**
- `auth-service.yml`·`user-service.yml` 이 `server.port` 만 → datasource·jwt·redis·ddl-auto 를 compose 에 주입.
- gateway `jwt.secret` 부재 → compose 주입(auth 와 동일 시크릿). notification datasource localhost → postgres 오버라이드.

**프론트 연결점**
- 직접 없음(인프라). 단, 프론트의 **JWT 인증 전체**가 gateway `jwt.secret` + auth 의 서명 키 일치에 의존 → config-repo 로 정식 이관 시 값 일관성 유지 필수.

**남은 작업**
- 위 값을 **config-repo 로 이관**하고 compose 오버라이드 제거. `JWT_SECRET` 은 auth·gateway·chat(WS) 공유.

---

## 5. 게이트웨이 라우팅 잔여 (payment 웹훅/브랜드페이)

**백엔드 상태**
- A방식 RewritePath 로 user/order/chat/payment-methods 정렬 완료(검증됨).
- payment brandpay/confirm/**웹훅** 라우팅은 [`payment-gateway-routing.md`](./payment-gateway-routing.md) 로 보류(웹훅은 JWT 없음 → 공개 경로 또는 게이트웨이 우회 결정 필요).

**프론트 연결점**
- 결제수단 조회는 `/api/payments/methods/**`(정렬됨)로 이미 연결. 브랜드페이 등록 UI 는 payment-service 직결(8300) 예정 → 게이트웨이 경유 불필요할 수도.

**남은 작업**
- 브랜드페이/confirm 공개경로 + 웹훅 수신 전략 확정(1번 항목과 연동).

---

## 6. 상품 ACTIVE 전이 (스케줄러 부재)

**백엔드 상태**
- 신규 상품은 `PENDING_OPEN` 으로 생성(오픈일 20일+ 이후). 목록은 `status=ACTIVE` 만 노출. 현재는 **수동으로 ACTIVE 전환**(데모 위해 Mongo updateMany).
- `openDate` 도래 시 자동 `ACTIVE` 전이 스케줄러가 없음(또는 미확인).

**프론트 연결점**
- `app/page.tsx`(홈) 상품 목록 = `GET /api/products`(ACTIVE 만). 오픈 전 상품은 안 보임.

**남은 작업**
- openDate 스케줄러(PENDING_OPEN→ACTIVE) 도입, 또는 "오픈 예정" 노출 정책. 프론트에 "오픈 예정" 뱃지/카운트다운 추가 여지.

---

## 7. (완료) 구독 활성화 → 채팅방 토픽 불일치

- ✅ **해소됨**: order `SubscriptionActivatedEvent` 를 `chat.order.created` + `{fanId, artistId, startedAt}` 로 정렬. Kafka 주입 검증(팬 입장 + UI 방 노출) 완료.

---

## 우선순위 제안

1. **Toss 테스트 결제 로컬 완결** — 웹훅 터널(또는 수동 sync) + 프론트 `/brandpay/checkout` 핸드오프 → 구독 성공→활성화→채팅방 자동 생성까지 **엔드투엔드 완성**(가장 임팩트 큼).
2. **WS 브랜치 develop 머지** — 임시 컨테이너 제거, 정식 빌드.
3. **config-repo 이관** — 배포 가능 상태 확보.
4. 아티스트 채팅 참여자/화면, 상품 ACTIVE 스케줄러.
