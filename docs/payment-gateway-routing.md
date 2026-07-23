# payment-service 게이트웨이 라우팅 (추후 논의)

> 상태: **보류(deferred)** · 담당 결정 필요
> 관련: `gateway-server/src/main/resources/application.yaml` (A 방식 RewritePath 정렬 적용됨)

게이트웨이 라우팅 정렬(A 방식)은 user·order·chat·payment-methods까지 반영했다.
payment-service의 **brandpay/confirm/웹훅** 라우팅은 Toss 콜백 인증 문제와 엮여 있어 별도로 논의 후 반영한다.

## 배경: payment-service의 다중 base path

한 프리픽스가 아니라 아래로 흩어져 있다.

| 컨트롤러 | 경로 | 호출 주체 | 인증(JWT) |
|---|---|---|---|
| `PaymentMethodController` | `/api/v1/payment-methods/**` | 프론트(사용자) | 필요 ✅ (반영 완료) |
| `TossBrandpayController` | `/brandpay/payments/ready`, `/brandpay/billing-auth/**` | 프론트(사용자) | 필요 |
| `TossBrandpayController` | `/brandpay/webhooks/toss-brandpay`, `/brandpay/callback-auth` | **Toss 서버** | **없음** ⚠️ |
| `PaymentController` | `/confirm/brandpay`, `/payments/cancel` | 프론트(사용자) | 필요 |
| `ViewController` | `/`, `/brandpay/checkout`, `/confirm/{widget,payment}`, `/fail` | 브라우저 리다이렉트/HTML | 혼재 |

## 핵심 쟁점

1. **Toss 웹훅/콜백은 Access Token이 없다.** `/brandpay/webhooks/**`, `/brandpay/callback-auth` 는 Toss 서버가 직접 호출하므로
   게이트웨이 `JwtAuthenticationFilter`에 걸려 **401**이 된다.
   → 두 가지 선택지:
   - (a) `PublicPathMatcher.PUBLIC_ENDPOINTS` 에 해당 경로를 **공개 경로로 추가**하고 게이트웨이로 태운다.
   - (b) 웹훅/콜백은 **게이트웨이를 경유하지 않고** payment-service 포트(8300)로 직접 받는다(Toss는 어차피 서버-서버 직접 호출이므로 게이트웨이를 거칠 이유가 약함). Toss 대시보드의 콜백 URL을 payment-service 공인 주소로 설정.

2. **`ViewController`는 서버사이드 HTML/리다이렉트**(위젯/체크아웃 페이지)를 반환한다. 실제 사용자용 SPA(Next.js)에서
   결제 UI를 자체 구현할지, 이 서버 렌더 페이지로 리다이렉트할지에 따라 라우팅이 달라진다.

3. **경로 정렬 방향**: brandpay/confirm 을 공개 경로 `/api/payments/**` 아래로 RewritePath 할지, 아니면 payment-service 경로를
   `/api/v1/payments/**` 로 재정비(컨트롤러 수정)할지.

## 보류된 제안 (A 방식, 미적용)

웹훅을 게이트웨이로 태우는 (a) 안을 택할 경우의 초안:

```yaml
- id: payment-brandpay
  uri: lb://PAYMENT-SERVICE
  predicates:
    - Path=/api/payments/brandpay/**
  filters:
    - RewritePath=/api/payments/(?<seg>.*), /$\{seg}   # → /brandpay/**

- id: payment-confirm
  uri: lb://PAYMENT-SERVICE
  predicates:
    - Path=/api/payments/confirm/**,/api/payments/payments/**
  filters:
    - RewritePath=/api/payments/(?<seg>.*), /$\{seg}   # → /confirm/**, /payments/cancel
```

그리고 `PublicPathMatcher` 에 웹훅/콜백 공개 처리:

```java
new PublicEndpoint(HttpMethod.POST, "/api/payments/brandpay/webhooks/**"),
new PublicEndpoint(HttpMethod.GET,  "/api/payments/brandpay/callback-auth"),
```

## 결정해야 할 것

- [ ] 웹훅/콜백을 게이트웨이 경유(a) vs 직접 수신(b) 중 무엇으로?
- [ ] 결제 UI를 SPA 자체 구현 vs payment-service 서버 렌더 페이지 리다이렉트?
- [ ] brandpay/confirm 공개 경로 정렬 방식 확정 후 위 라우트 반영.