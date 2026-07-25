'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';
import { apiData, apiFetch } from '../lib/api';
import type { TossPaymentsInstance, BrandpayInstance } from '../lib/toss-types';

interface InitResponse {
  clientKey: string;
  customerKey: string;
  userId: number;
  cards: Array<{ id: string; displayName: string; maskedNumber: string }>;
}

interface BrandpayCheckoutProps {
  orderId: number;
  productName: string;
  amount: number;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  hideDirectPayment?: boolean;
}

export default function BrandPayCheckout({
  orderId,
  productName,
  amount,
  onSuccess,
  onError,
  hideDirectPayment = false,
}: BrandpayCheckoutProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [init, setInit] = useState<InitResponse | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullMenu, setShowFullMenu] = useState(false);
  const brandpayRef = useRef<BrandpayInstance | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadTossSDK = async () => {
      try {
        // SDK 로드
        const scriptLoaded = await new Promise<boolean>((resolve) => {
          if (window.TossPayments) {
            resolve(true);
            return;
          }

          const script = document.createElement('script');
          script.src = 'https://js.tosspayments.com/v2/standard';
          script.async = true;
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.head.appendChild(script);
        });

        if (!scriptLoaded) throw new Error('Toss SDK 로드 실패');

        // 초기화 데이터 받기
        const initData = await apiData<InitResponse>(
          `/api/v1/payment-methods/brandpay/init?userId=${user.memberId}`
        );
        setInit(initData);

        // BrandPay 인스턴스 생성
        if (window.TossPayments) {
          const tossPayments = window.TossPayments(initData.clientKey);
          const baseUrl = window.location.origin;
          brandpayRef.current = tossPayments.brandpay({
            customerKey: initData.customerKey,
            redirectUrl: `${baseUrl}/brandpay/callback-auth?userId=${user.memberId}`,
          });
        }

        // 카드가 있으면 첫 번째 카드 선택
        if (initData.cards.length > 0) {
          setSelectedCardId(initData.cards[0].id);
          setShowFullMenu(true);
        } else {
          // 카드가 없으면 바로 추가 화면
          setShowFullMenu(false);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'SDK 로드 실패';
        setError(msg);
        onError?.(msg);
      } finally {
        setLoading(false);
      }
    };

    loadTossSDK();
  }, [user, onError]);

  const generateRandomString = () => {
    return window.btoa(Math.random().toString()).slice(0, 20);
  };

  const handleDirectPayment = async () => {
    if (!selectedCardId || !init || !brandpayRef.current) {
      setError('카드를 선택해 주세요.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const uniqueOrderId = generateRandomString();
      const currency = 'KRW';

      const readyResponse = await apiFetch<{ tossMethodId: string }>(
        '/api/v1/payment-methods/brandpay/ready',
        {
          method: 'POST',
          body: {
            orderId,
            tossOrderId: uniqueOrderId,
            amount,
            currency,
            customerKey: init.customerKey,
            selectedMethodId: selectedCardId,
          },
          headers: {
            'X-User-Id': String(user!.memberId),
          },
        }
      );

      const tossMethodId = readyResponse.tossMethodId;
      const baseUrl = window.location.origin;

      await brandpayRef.current.requestPayment({
        amount: { currency, value: amount },
        orderId: uniqueOrderId,
        orderName: productName,
        methodId: tossMethodId,
        successUrl: `${baseUrl}/brandpay/success`,
        failUrl: `${baseUrl}/brandpay/fail`,
        customerEmail: `user${user!.memberId}@example.com`,
        customerName: user!.nickname || '고객',
      });

      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '결제 처리 중 오류가 발생했습니다.';
      setError(msg);
      onError?.(msg);
    } finally {
      setProcessing(false);
    }
  };

  const handleAddPaymentMethod = async () => {
    if (!brandpayRef.current) return;
    setProcessing(true);
    try {
      // addPaymentMethod() 호출 시 BrandPay 가입 페이지로 자동 리다이렉트됨
      // 가입 완료 후 redirectUrl로 콜백되고, 그 페이지에서 accessToken을 획득함
      await brandpayRef.current.addPaymentMethod();
    } catch (err) {
      console.error('결제수단 추가 실패:', err);
      setError('결제수단 추가 실패');
    } finally {
      setProcessing(false);
    }
  };

  const handleChangeOneTouchPay = async () => {
    if (!brandpayRef.current) return;
    setProcessing(true);
    try {
      await brandpayRef.current.changeOneTouchPay();
      alert('원터치페이 설정이 변경되었습니다.');
    } catch (err) {
      console.error('원터치페이 설정 변경 실패:', err);
      setError('원터치페이 설정 변경 실패');
    } finally {
      setProcessing(false);
    }
  };

  const handleChangePassword = async () => {
    if (!brandpayRef.current) return;
    setProcessing(true);
    try {
      await brandpayRef.current.changePassword();
      alert('비밀번호 변경이 완료되었습니다.');
    } catch (err) {
      console.error('비밀번호 변경 실패:', err);
      setError('비밀번호 변경 실패');
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenSettings = async () => {
    if (!brandpayRef.current) return;
    setProcessing(true);
    try {
      await brandpayRef.current.openSettings();
    } catch (err) {
      console.error('설정 열기 실패:', err);
      setError('설정 열기 실패');
    } finally {
      setProcessing(false);
    }
  };

  const handleRequestBillingAuth = async () => {
    if (!brandpayRef.current || !init) return;
    setProcessing(true);
    try {
      await brandpayRef.current.requestBillingAuth();
      const baseUrl = window.location.origin;
      const response = await fetch(`${baseUrl}/api/v1/payment-methods/brandpay/billing-auth/success`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerKey: init.customerKey }),
      });
      if (response.ok) {
        alert('정기 자동결제 약관동의가 완료되었습니다.');
        window.location.reload();
      }
    } catch (err) {
      console.error('정기 결제 인증 실패:', err);
      setError('정기 결제 인증 실패');
    } finally {
      setProcessing(false);
    }
  };

  const handleTerminateBillingAuth = async () => {
    if (!brandpayRef.current || !init) return;
    if (!confirm('정말 정기 자동결제를 해지하시겠습니까?')) return;

    setProcessing(true);
    try {
      const baseUrl = window.location.origin;
      const response = await fetch(`${baseUrl}/api/v1/payment-methods/brandpay/billing-auth/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerKey: init.customerKey }),
      });
      if (response.ok) {
        alert('정기 자동결제가 해지되었습니다.');
        window.location.reload();
      } else {
        setError('정기 자동결제 해지 실패');
      }
    } catch (err) {
      console.error('정기 자동결제 해지 실패:', err);
      setError('정기 자동결제 해지 실패');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="spinner" />;
  }

  if (error && !init) {
    return <div className="alert alert-error">{error}</div>;
  }

  if (!init) {
    return <div className="alert alert-error">BrandPay를 초기화할 수 없습니다.</div>;
  }

  // 카드가 없으면 추가 화면만 표시
  if (init.cards.length === 0 && !showFullMenu) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            padding: 20,
            backgroundColor: '#f0f5ff',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>
            등록된 결제 카드가 없습니다.
          </div>
          <p style={{ fontSize: 13, color: '#999', margin: 0 }}>
            BrandPay로 결제수단을 추가하고 결제를 진행하세요.
          </p>
        </div>

        <button
          className="btn btn-primary btn-block"
          onClick={handleAddPaymentMethod}
          disabled={processing}
          style={{ padding: '12px 0', fontSize: 16, fontWeight: 600 }}
        >
          {processing ? '추가 중…' : '결제수단 추가'}
        </button>

        {error && <div className="alert alert-error">{error}</div>}
      </div>
    );
  }

  // 전체 메뉴
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 카드 선택 */}
      {init.cards.length > 0 && (
        <div style={{ padding: 15, border: '1px solid #e5e8eb', borderRadius: 8 }}>
          <p style={{ fontWeight: 'bold', marginBottom: 10, color: '#4e5968', fontSize: 14 }}>
            결제하실 카드를 선택해 주세요:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {init.cards.map((card) => (
              <label
                key={card.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: 8,
                  cursor: 'pointer',
                  borderRadius: 4,
                  backgroundColor: selectedCardId === card.id ? '#f0f5ff' : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="payment-card"
                  value={card.id}
                  checked={selectedCardId === card.id}
                  onChange={(e) => setSelectedCardId(e.target.value)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: 15, color: '#333d4b' }}>
                  {card.displayName} ({card.maskedNumber})
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {/* 주요 기능 버튼들 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!hideDirectPayment && init.cards.length > 0 && (
          <button
            className="btn btn-primary btn-block"
            onClick={handleDirectPayment}
            disabled={processing || !selectedCardId}
            style={{ padding: '12px 0', fontSize: 15, fontWeight: 600 }}
          >
            {processing ? '결제 중…' : `선택한 카드로 ${amount.toLocaleString()}원 결제하기`}
          </button>
        )}

        <button
          className="btn btn-ghost btn-block"
          onClick={handleAddPaymentMethod}
          disabled={processing}
          style={{ fontSize: 14 }}
        >
          결제수단 추가
        </button>

        {/* 추가 기능 메뉴 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginTop: 8,
            paddingTop: 12,
            borderTop: '1px solid #e5e8eb',
          }}
        >
          <button
            className="btn btn-sm btn-ghost"
            onClick={handleChangeOneTouchPay}
            disabled={processing}
            style={{ fontSize: 12 }}
          >
            원터치페이
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={handleChangePassword}
            disabled={processing}
            style={{ fontSize: 12 }}
          >
            비밀번호변경
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={handleOpenSettings}
            disabled={processing}
            style={{ fontSize: 12 }}
          >
            설정 열기
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={handleRequestBillingAuth}
            disabled={processing}
            style={{ fontSize: 12, backgroundColor: '#f0f5ff', color: '#1b64da' }}
          >
            정기결제 동의
          </button>
        </div>

        <button
          className="btn btn-sm btn-ghost"
          onClick={handleTerminateBillingAuth}
          disabled={processing}
          style={{
            marginTop: 8,
            fontSize: 12,
            backgroundColor: '#fff5f5',
            color: '#d32f2f',
            border: '1px solid #ffcdd2',
          }}
        >
          정기결제 해지
        </button>
      </div>
    </div>
  );
}
