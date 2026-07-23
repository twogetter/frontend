# twogetter · Frontend

구독권을 구매한 팬이 아티스트와 실시간으로 대화하는 서비스의 **실사용자용 웹 프론트엔드**.
Next.js 15(App Router) + React 19 + TypeScript. 백엔드 MSA(게이트웨이 8080)와 연동한다.

이 문서는 **백엔드 스택 구동**과 **프론트엔드 구동** 방법을 함께 다룬다.

---

## 사전 요구사항

- **Node.js 20+** & npm
- **Docker Desktop** (백엔드 인프라·서비스 컨테이너 실행)
- **Git** (백엔드 `config-server` 가 원격 config 저장소를 클론)
- (선택) JDK 25 — 서비스를 도커 없이 로컬 실행할 때만

## 저장소 구조

```
twogetter/
├── backend/    # Spring Cloud MSA (게이트웨이·서비스·인프라)
└── frontend/   # 이 프로젝트 (Next.js)
```

---

## 1. 백엔드 구동

백엔드는 config-server + eureka + gateway + 7개 서비스 + 인프라(PostgreSQL·MongoDB·Redis·Kafka)로 구성된다.
전부 `docker compose` 로 띄운다.

### 1-1. `.env` 준비

`backend/.env` 에 아래 값을 채운다 (`.env` 는 gitignore).

```bash
# 원격 config 저장소 (필수 — 없으면 config-server 부팅 불가)
CONFIG_REPO_URI=https://github.com/twogetter/config-repo.git
CONFIG_REPO_BRANCH=main
CONFIG_REPO_USERNAME=<github-username>
CONFIG_REPO_TOKEN=<github-personal-access-token>

# PostgreSQL 슈퍼유저 (컨테이너 초기화용)
DB_USERNAME=<postgres-user>
DB_PASSWORD=<postgres-password>

# MongoDB (product-service)
MONGO_ROOT_USERNAME=root
MONGO_ROOT_PASSWORD=<any-root-password>
# ⚠️ 반드시 config-repo product-service.yml 의 mongodb.password 와 동일해야 한다(기본 product_pass).
#    첫 기동 시 mongo-init 이 이 값으로 product_user 를 생성하기 때문.
MONGO_APP_PASSWORD=product_pass
```

> 서비스별 PostgreSQL DB/계정(`authdb/auth_user` 등)은 첫 기동 시 `docker/postgres-init/init.sh` 가 자동 생성한다.

### 1-2. 컨테이너 기동

```bash
cd backend

# 인프라 먼저 (postgres·mongodb·redis·kafka)
docker compose up -d postgres mongodb redis kafka

# MongoDB 초기화(product_user·인덱스 생성)
docker compose --profile local up mongo-init

# config-server → eureka → gateway + 서비스 전체 (첫 빌드는 수 분 소요)
docker compose up -d --build \
  config-server eureka-server api-gateway \
  auth-service user-service product-service payment-service \
  order-service notification-service chat-service
```

또는 한 번에:

```bash
cd backend && docker compose up -d --build
```

> `docker-compose.yml` 에는 로컬 검증용 오버라이드가 이미 포함돼 있다(auth/user datasource·jwt, gateway `JWT_SECRET`, notification 호스트 등). config-repo 로 정식 이관 전까지의 임시 설정이다.

### 1-3. 기동 확인

```bash
# 모든 서비스가 Eureka 에 등록됐는지
curl -s http://localhost:8761/eureka/apps -H 'Accept: application/json' \
  | python3 -c "import sys,json;print(sorted(a['name'] for a in json.load(sys.stdin)['applications']['application']))"
# → ['AUTH-SERVICE','CHAT-SERVICE','GATEWAY-SERVER','NOTIFICATION-SERVICE','ORDER-SERVICE','PAYMENT-SERVICE','PRODUCT-SERVICE','USER-SERVICE']

# 게이트웨이 경유 회원가입/로그인 스모크 테스트
curl -s -X POST http://localhost:8080/api/auth/signup -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"Password123!","nickname":"테스터"}'
```

### 포트

| 대상 | 주소 |
|---|---|
| **API 게이트웨이** (프론트 진입점) | `http://localhost:8080` |
| Eureka 대시보드 | `http://localhost:8761` |
| Config Server | `http://localhost:8888` |
| auth / user / product / payment / order / notification / chat | `8081 / 8100 / 8200 / 8300 / 8400 / 8500 / 8600` |
| Kafka UI | `http://localhost:8989` |
| PostgreSQL / MongoDB / Redis / Kafka | `5432 / 27017 / 6379 / 9092` |

---

## 2. 프론트엔드 구동

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

브라우저에서 `http://localhost:3000` → 회원가입 → 로그인 후 이용한다.

### 동작 방식 (프록시)

브라우저 CORS 를 피하기 위해 Next.js 가 서버사이드로 프록시한다(`next.config.ts` rewrites).

| 프론트 경로 | 프록시 대상 | 용도 |
|---|---|---|
| `/api/*` | 게이트웨이 `http://localhost:8080` | 대부분의 API (JWT→`X-User-Id` 주입) |
| `/stream/notifications/*` | notification `http://localhost:8500` | 알림 SSE (EventSource 는 JWT 헤더 불가 → 게이트웨이 우회) |
| WebSocket (STOMP) | `ws://localhost:8600/ws` 직접 | 실시간 채팅 수신 (아래 3장 참고) |

### 환경변수 (선택)

기본값으로 로컬에서 바로 동작하며, 필요 시 `.env.local` 로 재정의한다.

```bash
GATEWAY_URL=http://localhost:8080
NOTIFICATION_URL=http://localhost:8500
NEXT_PUBLIC_CHAT_WS_URL=ws://localhost:8600/ws
```

### 화면 / 라우트

| 라우트 | 설명 | 서비스 |
|---|---|---|
| `/login`, `/signup` | 로그인·회원가입 | auth |
| `/` | 홈 — 구독권(아티스트) 탐색 | product |
| `/search` | 검색 | product |
| `/products/[id]` | 상품 상세 | product |
| `/subscribe/[id]` | 구독 결제 확인 | order · payment |
| `/mypage` | 프로필·탈퇴 | user |
| `/mypage/subscriptions` | 내 구독 | order |
| `/mypage/payment-methods` | 결제수단 | payment |
| `/chat`, `/chat/[roomId]` | 채팅(목록·대화) | chat |
| `/notifications` | 알림(실시간 SSE) | notification |

---

## 3. 실시간 채팅 (WebSocket) 안내

채팅은 **REST 전송 + WebSocket(STOMP) 실시간 수신** 하이브리드다.

- 실 WebSocket 코드는 백엔드 브랜치 **`feat/58-chat-webSocket`** 에 있다(아직 `develop` 미머지).
- 기본 `docker compose` 로 빌드한 chat-service 에는 `/ws` 엔드포인트가 **없어** 실시간 수신이 동작하지 않고 **폴링 폴백**으로만 동작한다.
- 실시간을 확인하려면 chat-service 를 WS 브랜치로 실행한다:

```bash
# 1) WS 브랜치를 worktree 로 받기
cd backend
git worktree add /tmp/ws-tree origin/feat/58-chat-webSocket

# 2) chat-service 이미지 빌드 (context = worktree 루트)
cd /tmp/ws-tree
docker build -f chat-service/Dockerfile -t chat-ws:latest .

# 3) 기존 chat-service 컨테이너를 WS 이미지로 교체
#    -f 로 실행/정지 여부와 무관하게 강제 제거(이름 충돌 방지)
docker rm -f chat-service 2>/dev/null || true
docker run -d --name chat-service --hostname chat-service \
  --network bubbletea_bubbletea-net -p 8600:8600 \
  -e CONFIG_SERVER_URL=http://config-server:8888 \
  -e EUREKA_URL=http://eureka-server:8761/eureka/ \
  -e JWT_SECRET=bubbletea-local-shared-jwt-secret-please-change-me-32byte-min \
  chat-ws:latest
```

> **주의**: 이 WS 컨테이너는 compose 밖에서 수동 실행되므로, 이후 `docker compose down`/`up` 또는 Docker 재시작으로
> 네트워크가 재생성되면 이 컨테이너는 **stale network 참조로 재시작이 안 된다**(`network ... not found`).
> 그때는 `docker rm -f chat-service` 후 위 `docker run` 을 다시 실행한다(네트워크 이름 `bubbletea_bubbletea-net` 은 동일).
> 또한 `docker compose up` 은 비-WS `chat-service` 를 다시 만들므로, compose 재기동 후에는 3)번을 다시 수행한다.

> `JWT_SECRET` 은 gateway·auth 와 동일해야 CONNECT 시 토큰 검증이 성립한다(compose 기본값과 동일).
> WS 브랜치가 `develop` 에 머지되면 이 절차 없이 일반 compose 빌드로 `/ws` 가 내장된다.

---

## 4. 데모 데이터 시드 (선택)

갓 등록한 상품은 `PENDING_OPEN` 이라 홈 목록(=`ACTIVE`)에 안 보인다. 데모용으로 노출시키려면:

```bash
# 상품 등록(게이트웨이 경유, 로그인 토큰 필요) 후 Mongo 에서 ACTIVE 전환
docker exec bubbletea-mongodb-1 sh -c \
 'mongosh --quiet -u product_user -p "$MONGO_APP_PASSWORD" --authenticationDatabase productdb productdb \
  --eval "db.products.updateMany({status:\"PENDING_OPEN\",deleted:false},{\$set:{status:\"ACTIVE\"}})"'
```

채팅방은 상품(아티스트) 등록 시 자동 생성되지만, 구독 활성화(결제 성공)가 있어야 팬이 입장한다.
결제(Toss)는 **테스트모드**로 설정돼 있으나 브랜드페이 결제수단 등록의 웹훅이 localhost 에 도달하지 못해
로컬에서는 자동 입장이 제한된다. 자세한 내용과 우회책은
[`docs/frontend-backend-integration-analysis.md`](./docs/frontend-backend-integration-analysis.md) 참고.

---

## 5. 트러블슈팅

- **`npm run dev` 중 `npm run build` 를 돌리지 말 것** — 같은 `.next` 캐시를 덮어 `Cannot find module './xxx.js'` 로 깨진다. 깨졌으면 `rm -rf .next` 후 dev 재시작.
- **product-service 500 / Mongo Authentication failed** — `MONGO_APP_PASSWORD` 가 config-repo `product-service.yml` 의 값(`product_pass`)과 불일치. `.env` 를 맞추고 Mongo 볼륨을 재생성하거나 `product_user` 비밀번호를 갱신.
- **auth/user/gateway 부팅 실패** — config-repo 에 해당 서비스 설정 공백. `docker-compose.yml` 의 env 오버라이드가 있어야 부팅된다(이미 포함).
- **알림 SSE 가 안 붙음** — notification-service(8500) 기동 여부 확인. 프론트는 `/stream/notifications/connect` 로 8500 에 직접 붙는다.
- **Docker 데몬 미실행** — 어떤 서비스도 부팅 불가. Docker Desktop 을 먼저 켠다.

## 참고 문서

- [`docs/frontend-backend-integration-analysis.md`](./docs/frontend-backend-integration-analysis.md) — 남은 후속 ↔ 프론트 연결점
- [`docs/payment-gateway-routing.md`](./docs/payment-gateway-routing.md) — 결제 게이트웨이 라우팅(보류)
