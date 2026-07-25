# 프론트엔드 결제 시스템 아키텍처

## 🏗️ 아키텍처 다이어그램

```
┌─────────────────────────────────────┐
│      브라우저 (localhost:3000)       │
├─────────────────────────────────────┤
│  Frontend (Next.js)                 │
│  ├─ /payment                         │
│  ├─ /payment/success                │
│  └─ /payment/fail                   │
├─────────────────────────────────────┤
│  Toss Payments SDK                  │
│  (https://js.tosspayments.com)      │
└────────┬──────────────────────────────┘
         │
         ├─── 결제 준비 ──────────────────────────┐
         │                                        │
         ├─── 결제 요청 ───────────────┐           │
         │                           │            │
         └─── 결제 결과 ────────────────────────────┤
                                    │            │
                                    ▼            ▼
                    ┌──────────────────────────────┐
                    │  백엔드 (localhost:8300)     │
                    ├──────────────────────────────┤
                    │  Payment Service             │
                    │  ├─ POST /brandpay/          │
                    │  │         payments/ready    │
                    │  ├─ GET /brandpay/           │
                    │  │        cards/{customerId} │
                    │  ├─ POST /confirm/payment    │
                    │  └─ POST /brandpay/          │
                    │          billing-auth/terminate
                    └──────────────────────────────┘
```

## 📡 통신 방식

### 1️⃣ 카드 목록 조회

```
Frontend 컴포넌트
    ↓
fetch("http://localhost:8300/brandpay/cards/{customerId}")
    ↓ (CORS 처리됨)
Backend API
    ↓
응답 데이터
    ↓
Frontend 렌더링
```

### 2️⃣ 결제 준비

```
Frontend 컴포넌트 (BrandpayCheckout)
    ↓
fetch("http://localhost:8300/brandpay/payments/ready", POST)
    ↓ (CORS 처리됨)
Backend API
    ↓
tossOrderId, tossMethodId 반환
    ↓
Toss Payments SDK로 결제 요청
```

### 3️⃣ 결제 승인 (성공 페이지)

```
Frontend 페이지 (success page)
    ↓
queryParam에서 paymentKey, orderId 추출
    ↓
fetch("http://localhost:8300/confirm/payment", POST)
    ↓ (CORS 처리됨)
Backend API
    ↓
결제 승인 처리
    ↓
응답 데이터 표시
```

## 🔑 핵심 원칙

### ✅ 프론트엔드는 UI만 제공

- Toss Payments SDK로 결제 창 렌더링
- 사용자 입력 처리
- 에러/성공 메시지 표시

### ✅ 백엔드는 API만 제공

- 카드 정보 조회
- 결제 준비 (주문 생성)
- 결제 승인 (PG사와 통신)
- 정기결제 관리

### ✅ 직접 통신 (프론트엔드 ↔ 백엔드)

- **프론트엔드 API 라우트 (Next.js) 없음**
- 클라이언트 컴포넌트에서 직접 백엔드 호출
- `NEXT_PUBLIC_BACKEND_URL` 환경 변수 사용

```javascript
// ✅ 올바른 방식
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8300';
fetch(`${backendUrl}/brandpay/cards/${customerId}`);

// ❌ 안 되는 방식
fetch('/api/payment/cards/xxx');  // Next.js API 라우트
```

## 📁 파일 구조

```
frontend/
└── app/payment/
    ├── page.tsx                    # 결제 선택 페이지
    ├── payment.module.css          # 스타일
    ├── ARCHITECTURE.md             # 이 파일
    ├── README.md                   # 사용 가이드
    ├── IMPLEMENTATION.md           # 구현 상세
    ├── callback/
    │   └── page.tsx                # 결제 콜백 처리
    ├── success/
    │   └── page.tsx                # 결제 성공
    ├── fail/
    │   └── page.tsx                # 결제 실패
    └── components/
        ├── BrandpayCheckout.tsx    # 브랜드페이
        └── PaymentMethodSelector.tsx # 토스페이먼츠 위젯
```

## 🔐 보안

### CORS 설정 (Backend 필수)

```java
@Configuration
public class CorsConfig {
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/brandpay/**")
                    .allowedOrigins("http://localhost:3000")
                    .allowedMethods("GET", "POST", "OPTIONS")
                    .allowedHeaders("Content-Type")
                    .allowCredentials(true);
                    
                registry.addMapping("/confirm/**")
                    .allowedOrigins("http://localhost:3000")
                    .allowedMethods("POST", "OPTIONS")
                    .allowedHeaders("Content-Type");
            }
        };
    }
}
```

### 환경 변수

```bash
# Frontend (.env.local) - 클라이언트에서 접근 가능
NEXT_PUBLIC_BACKEND_URL=http://localhost:8300
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_xxx

# Backend (.env) - 서버에서만 접근
TOSS_SECRET_KEY=sk_test_xxx
```

## 🚀 실행 방법

### 1. Backend 시작 (필수: CORS 설정)

```bash
cd backend/payment-service
./gradlew bootRun
# http://localhost:8300
```

### 2. Frontend 시작

```bash
cd frontend
npm run dev
# http://localhost:3000
```

### 3. 결제 페이지 접속

```
http://localhost:3000/payment?customerId=user123&orderId=order456
```

## ⚡ 성능 특징

### 장점

1. **빠른 응답** - 프론트엔드 API 라우트 레이어 없음
2. **간단한 구조** - 클라이언트 ↔ 서버 직접 통신
3. **CORS만 설정** - 복잡한 라우트 미들웨어 불필요
4. **확장성** - 다양한 UI 추가 가능

### 고려사항

1. **CORS 필수** - 백엔드에서 정확히 설정
2. **공개 환경 변수** - `NEXT_PUBLIC_BACKEND_URL` 클라이언트 노출
3. **직접 호출** - 보안은 백엔드에서만 검증

## 📝 주의사항

### ❌ 하면 안 되는 것

```javascript
// 1. 프론트엔드 API 라우트 사용
fetch('/api/payment/cards/xxx');

// 2. 백엔드 URL 숨기기
const backendUrl = process.env.BACKEND_URL;  // 클라이언트에서 접근 불가

// 3. 시크릿 키 클라이언트에 저장
NEXT_PUBLIC_TOSS_SECRET_KEY=sk_test_xxx;
```

### ✅ 해야 하는 것

```javascript
// 1. 직접 백엔드 호출
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
fetch(`${backendUrl}/brandpay/cards/xxx`);

// 2. 결제 금액 검증 (백엔드)
if (requestAmount !== savedOrderAmount) {
    throw new Exception("금액 불일치");
}

// 3. 클라이언트 키만 공개
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_xxx;  // OK
```

## 🔄 데이터 흐름 예제

### 브랜드페이 결제 완전 흐름

```
1. 사용자가 /payment?customerId=user123&orderId=order456 접속
   ↓
2. BrandpayCheckout 컴포넌트 로드
   ↓
3. fetch("http://localhost:8300/brandpay/cards/user123")
   ↓ CORS OK (백엔드에서 설정)
4. 카드 목록 응답
   ↓
5. 사용자가 카드 선택 후 "결제하기" 클릭
   ↓
6. fetch("http://localhost:8300/brandpay/payments/ready", POST)
   ↓
7. tossOrderId, tossMethodId 응답
   ↓
8. Toss Payments SDK.requestPayment({orderId, methodId})
   ↓
9. 결제 창 띄우기 (Toss 제공)
   ↓
10. 사용자가 결제 진행
   ↓
11. 성공 → /payment/success?paymentKey=tvw_xxx&orderId=order456&amount=50000
   ↓
12. fetch("http://localhost:8300/confirm/payment", POST)
   ↓ CORS OK
13. 결제 승인 완료
   ↓
14. 결제 완료 페이지 표시
```

## 📞 문제 해결

### Q: "CORS 에러가 발생합니다"

**원인:** 백엔드에서 CORS 설정 누락

**해결:**
```java
// backend
@CrossOrigin(origins = "http://localhost:3000")
@RestController
public class PaymentController { ... }
```

### Q: "fetch가 실패합니다"

**확인:**
1. `NEXT_PUBLIC_BACKEND_URL` 올바른지 확인
2. 백엔드가 실제로 실행 중인지 확인
3. 브라우저 개발자 도구 > 네트워크 탭 확인

### Q: "결제가 처리되지 않습니다"

**확인:**
1. Backend `/confirm/payment` 엔드포인트 상태
2. Toss Payments 클라이언트 키 올바른지
3. 백엔드 시크릿 키 설정 확인
