"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Guard from "../../components/Guard";
import { apiData, apiFetch, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { PaymentMethod } from "../../lib/types";
import {info} from "next/dist/build/output/log";

interface PaymentCard {
  id: string;
  displayName: string;
  maskedNumber: string;
}

interface CustomerInfo {
  userId: number;
  customerKey: string;
  cards: PaymentCard[];
  clientKey: string;
  redirectUrl: string;
}

function PaymentMethods() {
  const { user } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Brandpay 상태
  const [showBrandpay, setShowBrandpay] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [brandpayLoading, setBrandpayLoading] = useState(false);
  const [focusBillingConsent, setFocusBillingConsent] = useState(false);
  const billingConsentButtonRef = useRef<HTMLButtonElement | null>(null);

  const getFrontendCallbackUrl = (userId: number) =>
    `${window.location.origin}/payment/callback-auth?userId=${userId}`;

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiData<PaymentMethod[]>(`/api/payment-methods/${user.memberId}`);
      setMethods(data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "결제수단을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const closeBrandpayModal = () => {
    setFocusBillingConsent(false);
    setShowBrandpay(false);
    window.location.reload();
  };

  // 브랜드페이 모달 열기
  const openBrandpayModal = async () => {
    if (!user) return;
    setBrandpayLoading(true);
    setError(null);
    try {
      const info = await apiData<CustomerInfo>("/api/payments/customer-info");
      setCustomerInfo(info);

      if (info?.cards?.length > 0) {
        setSelectedCardId(info.cards[0].id);
      }

      setShowBrandpay(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '브랜드페이 로드 실패');
    } finally {
      setBrandpayLoading(false);
    }
  };

  // TossPayments 스크립트 로드
  useEffect(() => {
    if (!showBrandpay || !customerInfo) return;

    const script = document.createElement('script');
    script.src = 'https://js.tosspayments.com/v2/standard';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [showBrandpay, customerInfo]);

  useEffect(() => {
    if (!showBrandpay || !focusBillingConsent) return;
    billingConsentButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    billingConsentButtonRef.current?.focus();
  }, [showBrandpay, focusBillingConsent]);

  const addPaymentMethod = async () => {
    if (!customerInfo) return;

    try {
      // @ts-ignore
      const tossPayments = window.TossPayments(customerInfo.clientKey);
      // @ts-ignore
      const brandpay = tossPayments.brandpay({
        customerKey: customerInfo.customerKey,
        redirectUrl: `${customerInfo.redirectUrl}/callback-auth?userId=${customerInfo.userId}`
        // redirectUrl: `http://localhost:3000/payment/callback-auth?userId=${customerInfo.userId}`,
      });
      await brandpay.addPaymentMethod();

      // 카드 추가 후 정보 새로고침
      await new Promise(resolve => setTimeout(resolve, 1000));
      openBrandpayModal();
    } catch (error) {
      console.error('결제수단 추가 실패:', error);
      setError('결제수단 추가 중 오류가 발생했습니다.');
    }
  };

  const openBrandpaySettings = async () => {
    if (!customerInfo) return;

    try {
      // @ts-ignore
      const tossPayments = window.TossPayments(customerInfo.clientKey);
      // @ts-ignore
      const brandpay = tossPayments.brandpay({
        customerKey: customerInfo.customerKey,
        redirectUrl: `${customerInfo.redirectUrl}/callback-auth?userId=${customerInfo.userId}`,
      });
      await brandpay.openSettings();
    } catch (error) {
      const isUserCancel =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "USER_CANCEL";

      if (!isUserCancel) {
        console.error('브랜드페이 설정 열기 실패:', error);
        setError('브랜드페이 설정을 열 수 없습니다.');
        return;
      }
    }

    const fresh = await sync();
    if (fresh) {
      const cards = fresh.map((method) => ({
        id: String(method.id),
        displayName: method.displayName,
        maskedNumber: method.maskedNumber,
      }));
      setCustomerInfo((prev) => (prev ? { ...prev, cards } : prev));
      if (cards.length > 0) {
        setSelectedCardId(cards[0].id);
      } else {
        setSelectedCardId(null);
      }
    }
  };

  const requestBillingAuth = async () => {
    if (!customerInfo) return;

    try {
      // @ts-ignore
      const tossPayments = window.TossPayments(customerInfo.clientKey);
      // @ts-ignore
      const brandpay = tossPayments.brandpay({
        customerKey: customerInfo.customerKey,
        redirectUrl: `${customerInfo.redirectUrl}/callback-auth?userId=${customerInfo.userId}`,
      });

      await brandpay.requestBillingAuth();

      const response = await fetch(
        `${customerInfo.redirectUrl}/billing-auth/success`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerKey: customerInfo.customerKey }),
        }
      );

      if (response.ok) {
        setNotice('정기결제 인증이 완료되었습니다.');
      }
    } catch (error) {
      console.error('정기결제 인증 실패:', error);
      setError('인증 중 오류가 발생했습니다.');
    }
  };

  const terminateBillingAuth = async () => {
    if (!user) return;

    if (!confirm('정말 정기 자동결제를 해지하시겠습니까?')) {
      return;
    }

    try {
      let targetCustomerInfo = customerInfo;
      if (!targetCustomerInfo) {
        targetCustomerInfo = await apiData<CustomerInfo>("/api/payments/customer-info");
        setCustomerInfo(targetCustomerInfo);
      }

      if (!targetCustomerInfo || !targetCustomerInfo.customerKey) {
        throw new Error("customerKey를 찾을 수 없습니다.");
      }

      const response = await fetch(
        `${targetCustomerInfo.redirectUrl}/billing-auth/terminate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerKey: targetCustomerInfo.customerKey,
          }),
        }
      );

      if (response.ok) {
        setNotice('정기 자동결제가 정상적으로 해지되었습니다.');
        await sync();
        await load();
      } else {
        const errorMsg = await response.text();
        setError('해지 실패: ' + errorMsg);
      }
    } catch (error) {
      console.error('해지 요청 중 오류 발생:', error);
      setError('서버 통신 중 오류가 발생했습니다.');
    }
  };

  // 카드 등록은 별도 창에서 진행되므로, 돌아온 뒤 토스에 등록된 결제수단을 끌어온다.
  async function sync(): Promise<PaymentMethod[] | null> {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      if (!user) return null;
      const fresh = await apiData<PaymentMethod[]>(`/api/payment-methods/${user.memberId}/sync`, {
        method: "POST",
      });
      setMethods(fresh);
      setNotice(
        fresh.length === 0
          ? "토스에 등록된 카드가 없습니다. 브랜드페이 창에서 카드를 먼저 등록해 주세요."
          : `결제수단 ${fresh.length}건을 불러왔습니다.`
      );
      return fresh;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "결제수단 동기화에 실패했습니다."
      );
      return null;
    } finally {
      setSyncing(false);
    }
  }

  // 구독 주문은 BILLING 타입 결제수단만 받는다(payment-service BillingService).
  async function designateBilling(id: number) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/payment-methods/${id}/billing`, { method: "POST" });

      await load();
      setNotice("정기결제 카드로 지정되었습니다. 이제 구독을 진행할 수 있어요.");
    } catch (e) {
      const message = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "정기결제 카드 지정에 실패했습니다.";
      const needsBillingConsent = message.includes("약관") || message.includes("동의");
      if (needsBillingConsent) {
        setNotice("정기결제 약관 동의가 필요해서 브랜드페이 모달로 이동합니다.");
        alert("정기결제 약관 동의가 필요합니다. 모달의 '정기 자동결제 약관동의' 버튼을 눌러 주세요.");
        await openBrandpayModal();
        setFocusBillingConsent(true);
      } else {
        setError(message);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function terminateBillingMethod(id: number) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/payment-methods/${id}/billing/terminate`, { method: "POST" });

      await load();
      setNotice("정기결제 카드가 해지되었습니다.");
    } catch (e) {
      const message = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "정기결제 카드 해지에 실패했습니다.";
      setError(message);
    } finally {
      setBusyId(null);
    }
  }

  const generateRandomString = () => {
    return btoa(Math.random().toString()).slice(0, 20);
  };

  return (
    <div className="container-narrow">
      <h1>결제수단</h1>
      <p className="subtitle">정기 구독 결제에 사용할 카드입니다.</p>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-info">{notice}</div>}

      {/* 브랜드페이 모달 */}
      {showBrandpay && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>브랜드페이 카드 관리</h2>
              <button
                onClick={closeBrandpayModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#999',
                }}
              >
                ✕
              </button>
            </div>

            {/* 카드 선택 영역 */}
            {customerInfo && (
              <div
                style={{
                  marginBottom: '20px',
                  padding: '15px',
                  border: '1px solid #e5e8eb',
                  borderRadius: '8px',
                }}
              >
                <p
                  style={{
                    fontWeight: 'bold',
                    marginBottom: '10px',
                    color: '#4e5968',
                    margin: '0 0 10px 0',
                  }}
                >
                  등록된 카드:
                </p>

                {!customerInfo.cards || customerInfo.cards.length === 0 ? (
                  <div style={{ color: '#f04452', padding: '10px 0' }}>
                    등록된 결제 카드가 없습니다.
                  </div>
                ) : (
                  customerInfo.cards.map((card) => (
                    <div
                      key={card.id}
                      style={{
                        margin: '8px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <input
                        type="radio"
                        id={`card-${card.id}`}
                        name="toss-card"
                        value={card.id}
                        checked={selectedCardId === card.id}
                        onChange={(e) => setSelectedCardId(e.target.value)}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                        }}
                      />
                      <label
                        htmlFor={`card-${card.id}`}
                        style={{
                          fontSize: '14px',
                          color: '#333d4b',
                          cursor: 'pointer',
                          margin: 0,
                        }}
                      >
                        {card.displayName} ({card.maskedNumber})
                      </label>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 버튼 그룹 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={addPaymentMethod}
                style={{
                  padding: '12px',
                  backgroundColor: '#3182f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: 'bold',
                }}
              >
                💳 결제수단 추가
              </button>

              <button
                onClick={openBrandpaySettings}
                style={{
                  padding: '12px',
                  backgroundColor: '#ff6b6b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: 'bold',
                }}
              >
                ⚙️ 브랜드페이 설정
              </button>

              <button
                ref={billingConsentButtonRef}
                onClick={requestBillingAuth}
                style={{
                  padding: '12px',
                  backgroundColor: focusBillingConsent ? '#00b894' : '#1dd1a1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  boxShadow: focusBillingConsent ? '0 0 0 3px rgba(0, 184, 148, 0.25)' : 'none',
                }}
              >
                ✓ 정기 자동결제 약관동의
              </button>

              <button
                onClick={terminateBillingAuth}
                style={{
                  padding: '12px',
                  backgroundColor: '#f2f4f6',
                  color: '#f04452',
                  border: '1px solid #f04452',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '15px',
                }}
              >
                ✕ 전체 정기 자동결제 해지
              </button>

              <button
                onClick={closeBrandpayModal}
                style={{
                  padding: '12px',
                  backgroundColor: '#f2f4f6',
                  color: '#333d4b',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '15px',
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 등록된 카드 목록 */}
      {loading ? (
        <div className="spinner" />
      ) : methods.length === 0 ? (
        <div className="empty">
          <div className="emoji">💳</div>
          <p>등록된 결제수단이 없어요.</p>
        </div>
      ) : (
        <div>
          <h3 style={{ marginTop: 20}}>등록된 카드</h3>
          <div className="card">
            {methods.map((m) => (
              <div className="row" key={m.id}>
                <span className="avatar" style={{ background: "var(--bg-elev)", color: "var(--text-dim)" }}>
                  💳
                </span>
                <div className="row-main">
                  <div className="row-title">{m.displayName || m.provider}</div>
                  <div className="row-sub">
                    {m.maskedNumber} · {m.status}
                  </div>
                </div>
                {m.type === "BILLING" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="badge badge-active">정기결제</span>
                    <button
                      className="btn btn-sm"
                      disabled={busyId === m.id}
                      onClick={() => terminateBillingMethod(m.id)}
                    >
                      {busyId === m.id ? "해지 중…" : "해지"}
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-sm"
                    disabled={busyId === m.id}
                    onClick={() => designateBilling(m.id)}
                  >
                    {busyId === m.id ? "지정 중…" : "정기결제로 지정"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="stack" style={{ marginTop: 20, marginBottom: 10 }}>
        <button
            className="btn btn-primary btn-block"
            onClick={openBrandpayModal}
            disabled={brandpayLoading}
        >
          {brandpayLoading ? '로드 중…' : '브랜드페이 카드 관리'}
        </button>
        <button className="btn btn-ghost btn-block" onClick={sync} disabled={syncing}>
          {syncing ? "불러오는 중…" : "등록한 카드 불러오기"}
        </button>
      </div>

      {/* 안내 메시지 */}
      <div className="alert alert-info" style={{ marginTop: 20 }}>
        <strong>구독까지 3단계</strong>
        <br />
        1. <b>브랜드페이 카드 관리</b> → <b>결제수단 추가</b>
        <br />
        2. 같은 모달에서 <b>정기 자동결제 약관동의</b>
        <br />
        3. <b>등록한 카드 불러오기</b> → <b>정기결제로 지정</b>
      </div>
    </div>
  );
}

export default function PaymentMethodsPage() {
  return (
    <Guard>
      <PaymentMethods />
    </Guard>
  );
}
