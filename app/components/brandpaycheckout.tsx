'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { apiData, apiFetch } from '../lib/api';
import type { BrandpayInstance } from '../lib/toss-types';

interface InitResponse {
  clientKey: string;
  customerKey: string;
  userId: number;
  redirectUrl: string;
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
          '/api/payments/customer-info'
        );
        setInit(initData);

        // BrandPay 인스턴스 생성
        if (window.TossPayments) {
          const tossPayments = window.TossPayments(initData.clientKey);
          brandpayRef.current = tossPayments.brandpay({
            customerKey: initData.customerKey,
            redirectUrl: `${initData.redirectUrl}/callback-auth?userId=${user.memberId}`,
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

      const readyResponse = await apiData<{ tossMethodId: string }>(
        '/brandpay/payments/ready',
        {
          method: 'POST',
          body: {
            orderId,
            tossOrderId: uniqueOrderId,
            amount,
            currency,
            customerKey: init.customerKey,
            selectedMethodId: Number(selectedCardId),
          },
          headers: {
            'X-User-Id': String(user!.memberId),
          },
        }
      );

      const tossMethodId = readyResponse.tossMethodId;
      if (!tossMethodId) {
        throw new Error('브랜드페이 결제수단 정보를 불러오지 못했습니다.');
      }
      const baseUrl = window.location.origin;

      await brandpayRef.current.requestPayment({
        amount: { currency, value: amount },
        orderId: uniqueOrderId,
        orderName: productName,
        methodId: tossMethodId,
        successUrl: `${baseUrl}/payment/success?subscriptionOrderId=${orderId}&customerKey=${init.customerKey}`,
        failUrl: `${baseUrl}/payment/fail?orderId=${orderId}`,
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
        </div>

      </div>
    </div>
  );
}
