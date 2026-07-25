# 결제 시스템 구현 가이드

## 🎯 개요

**모든 결제 UI와 기능이 Frontend에서 완전히 처리됩니다.**
Backend는 순수 REST API만 제공하며, Toss Payments SDK는 Frontend에 임베드되어 있습니다.

## 📱 페이지 구조

### 1. 결제 메인 페이지 (`/payment`)

```
http://localhost:3000/payment?customerId=user123&orderId=order123
```

**기능:**
- 브랜드페이 vs 토스페이먼츠 위젯 선택
- 각 결제 방식별 UI 렌더링

**쿼리 파라미터:**
- `customerId` (필수): 고객 고유 ID (비추론 가능한 값)
- `orderId` (필수): 주문 ID

### 2. 브랜드페이 결제 화면

**화면 구성:**
```
┌─────────────────────────────────┐
│  결제 수단 선택                  │
├─────────────────────────────────┤
│  ○ 신한카드 (5151****)          │
│  ○ 현대카드 (5555****)          │
├─────────────────────────────────┤
│  [결제하기] [카드 추가] [설정]   │
└─────────────────────────────────┘
```

**기능:**
- ✅ 등록된 카드 목록 표시
- ✅ 카드 선택 후 결제
- ✅ **Toss Payments 위젯으로 새 카드 추가** (브랜드페이 가입 포함)
- ✅ 원터치페이 설정
- ✅ 비밀번호 변경
- ✅ 정기 자동결제 약관동의
- ✅ 정기 자동결제 해지

### 3. 토스페이먼츠 위젯 화면

**화면 구성:**
```
┌─────────────────────────────────┐
│  결제 수단 선택                  │
├─────────────────────────────────┤
│  [카드]    [계좌이체]           │
│  [가상계좌] [휴대폰]            │
│  [문화상품권] [해외간편결제]    │
├─────────────────────────────────┤
│  [결제하기]                      │
└─────────────────────────────────┘
```

**지원 결제 수단:**
- 카드 결제
- 계좌이체
- 가상계좌
- 휴대폰 결제
- 문화상품권
- 해외간편결제 (PayPal)

### 4. 결제 성공 페이지 (`/payment/success`)

```
http://localhost:3000/payment/success?paymentKey=tvw_xxx&orderId=order_xxx&amount=50000
```

**표시 정보:**
- ✅ 결제 금액
- ✅ 주문번호
- ✅ 결제 카드 정보
- ✅ 결제 시간
- ✅ 결제 승인번호

### 5. 결제 실패 페이지 (`/payment/fail`)

```
http://localhost:3000/payment/fail?message=카드잔액부족&code=INSUFFICIENT_BALANCE
```

**표시 정보:**
- ❌ 실패 메시지
- ❌ 에러 코드
- 💡 실패 원인 안내
- 🔄 재시도 버튼

## 🔌 API 엔드포인트

### 1. 카드 목록 조회

```http
GET /api/payment/cards/{customerId}
```

**응답:**
```json
{
  "cards": [
    {
      "id": "method_12345",
      "displayName": "신한카드",
      "maskedNumber": "5151****"
    }
  ]
}
```

### 2. 결제 준비

```http
POST /api/payment/brandpay/ready
Content-Type: application/json

{
  "orderId": "order_123456",
  "tossOrderId": "unique_order_xyz",
  "amount": 50000,
  "customerId": "user_123",
  "selectedMethodId": "method_12345"
}
```

**응답:**
```json
{
  "tossOrderId": "unique_order_xyz",
  "tossMethodId": "method_12345"
}
```

### 3. 결제 승인

```http
POST /api/payment/confirm
Content-Type: application/json

{
  "paymentKey": "tvw_1234567890",
  "orderId": "order_123456",
  "amount": 50000
}
```

**응답:**
```json
{
  "paymentKey": "tvw_1234567890",
  "orderId": "order_123456",
  "amount": 50000,
  "method": "BRANDPAY",
  "status": "DONE",
  "approvedAt": "2024-07-24T16:30:00Z",
  "card": {
    "issuerCode": "011",
    "issuerName": "신한카드",
    "number": "5151****"
  }
}
```

### 4. 정기결제 해지

```http
POST /api/payment/brandpay/billing-terminate
Content-Type: application/json

{
  "customerId": "user_123"
}
```

## 🔄 결제 흐름도

### 브랜드페이 결제 흐름

```
사용자가 결제 페이지 접속
    ↓
카드 목록 로드 (GET /api/payment/cards/{customerId})
    ↓
┌────────────────────────────────┐
│  카드가 없음                    │
├────────────────────────────────┤
│  → "카드 추가하기" 버튼 클릭   │
│  → Toss Payments 위젯 (브랜드페이 가입)
│  → 카드 등록 완료              │
└────────────────────────────────┘
    ↓
카드 선택 후 결제하기 클릭
    ↓
결제 준비 (POST /api/payment/brandpay/ready)
    ↓
Toss Payments SDK로 결제 요청
    ↓
    ├─ 성공 → /payment/success
    └─ 실패 → /payment/fail
    ↓
결제 승인 (POST /api/payment/confirm)
    ↓
결과 페이지 표시
```

### 토스페이먼츠 위젯 결제 흐름

```
결제 수단 선택 (카드, 계좌이체 등)
    ↓
결제하기 클릭
    ↓
Toss Payments SDK로 결제 요청
    ↓
결제 진행 (결제창)
    ↓
    ├─ 성공 → /payment/success
    └─ 실패 → /payment/fail
    ↓
결제 승인 (POST /api/payment/confirm)
    ↓
결과 페이지 표시
```

## 🛠️ Backend API 요구사항

Frontend가 호출하는 Backend API:

```
GET  /brandpay/cards/{customerId}
POST /brandpay/payments/ready
POST /confirm/payment
POST /brandpay/billing-auth/terminate
```

### 필수 응답 헤더

```
Content-Type: application/json
```

### CORS 설정 필수

```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

## 🧪 테스트 계정

Toss Payments 테스트 환경:

| 카드사 | 카드번호 | 유효기간 | CVC |
|---|---|---|---|
| 신한카드 | 4111111111111111 | 12/26 | 123 |
| 현대카드 | 4102231086411111 | 12/26 | 123 |
| 국민카드 | 5580211111111111 | 12/26 | 123 |

## 🚀 배포 준비

### 1. 환경 변수 설정 (.env.local)

```bash
# Toss Payments 클라이언트 키 (공개 가능)
NEXT_PUBLIC_TOSS_CLIENT_KEY=your_production_client_key

# Backend API URL
BACKEND_URL=https://api.your-domain.com
```

### 2. Toss Payments 개발자센터 설정

1. 상점 관리 > 콜백 URL 설정
   - 성공: `https://your-domain.com/payment/success`
   - 실패: `https://your-domain.com/payment/fail`

2. API 키 설정
   - 프로덕션 클라이언트 키 발급
   - Backend의 시크릿 키 저장

### 3. Backend 배포

- CORS 설정 확인
- API 엔드포인트 테스트
- 시크릿 키 안전 저장

## 📝 개발자 주의사항

### 1. 리다이렉트 금지

❌ **잘못된 예:**
```javascript
// Backend의 HTML로 리다이렉트하면 안됨
window.location.href = 'http://localhost:8300/payment/checkout.html';
```

✅ **올바른 예:**
```javascript
// Frontend 페이지로 이동
router.push('/payment?customerId=user123&orderId=order123');
```

### 2. SDK 보안

❌ **잘못된 예:**
```javascript
// 시크릿 키를 Frontend에 절대 저장
const secretKey = process.env.NEXT_PUBLIC_TOSS_SECRET_KEY;
```

✅ **올바른 예:**
```javascript
// 클라이언트 키만 사용 (공개 가능)
const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

// 시크릿 키는 Backend 환경 변수
// backend/.env: TOSS_SECRET_KEY=sk_test_xxx
```

### 3. Customer Key 생성

❌ **안전하지 않음:**
```javascript
const customerKey = user.email;  // 유추 가능
const customerKey = user.phone;  // 유추 가능
```

✅ **안전함:**
```javascript
const customerKey = user.id;  // UUID 같은 값
const customerKey = generateRandomString();  // 난수 생성
```

### 4. 결제 금액 검증

Backend에서 반드시 검증:

```java
// Backend
if (requestAmount != savedOrderAmount) {
    throw new Exception("결제 금액 불일치");
}
```

## 📞 문제 해결

### 문제: "카드 목록이 조회되지 않음"

**해결 방법:**
1. `customerId` 확인
2. Backend `/brandpay/cards/{customerId}` 엔드포인트 상태 확인
3. 브라우저 개발자 도구 > 네트워크 탭에서 응답 확인

### 문제: "Toss Payments SDK를 로드할 수 없습니다"

**해결 방법:**
1. NEXT_PUBLIC_TOSS_CLIENT_KEY 확인
2. 인터넷 연결 확인
3. `https://js.tosspayments.com/v2/standard` 접근 가능한지 확인

### 문제: "결제 창이 열리지 않음"

**해결 방법:**
1. clientKey 올바른지 확인
2. customerId 올바른지 확인
3. 콘솔 에러 메시지 확인

## 📚 참고 자료

- [Toss Payments 공식 문서](https://docs.tosspayments.com/)
- [Brand Pay 통합 가이드](https://docs.tosspayments.com/guides/v2/brandpay/integration)
- [Payment Widget 가이드](https://docs.tosspayments.com/guides/v2/payment-widget/integration)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
