'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  selectedMethodId?: number | null;
  selectedMaskedNumber?: string | null;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  hideDirectPayment?: boolean;
}

export default function BrandPayCheckout({
  orderId,
  productName,
  amount,
  selectedMethodId,
  selectedMaskedNumber,
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

        const selectedCardFromQuery = selectedMaskedNumber
          ? initData.cards.find((card) => card.maskedNumber === selectedMaskedNumber)
          : null;

        // 전달받은 카드가 있으면 우선 선택하고, 없으면 첫 번째 카드 선택
        if (selectedCardFromQuery) {
          setSelectedCardId(selectedCardFromQuery.id);
        } else if (initData.cards.length > 0) {
          setSelectedCardId(initData.cards[0].id);
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
  }, [user, onError, selectedMethodId, selectedMaskedNumber]);

  const selectedCard = useMemo(
    () => init?.cards.find((card) => card.id === selectedCardId) ?? init?.cards[0] ?? null,
    [init, selectedCardId]
  );

  const generateRandomString = () => {
    return window.btoa(Math.random().toString()).slice(0, 20);
  };

  const handleDirectPayment = async () => {
    if (!selectedCardId || !init || !brandpayRef.current || selectedMethodId == null) {
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
            selectedMethodId,
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

  if (init.cards.length === 0) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card" style={{ padding: 16 }}>
        <div className="row-main">
          <div className="row-title">{selectedCard?.displayName ?? '선택된 카드'}</div>
          <div className="row-sub">{selectedCard?.maskedNumber ?? '카드 정보가 없습니다.'}</div>
        </div>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : null}

      {!selectedCard && (
        <div className="alert alert-info">
          선택된 카드가 없습니다. 결제수단에서 카드를 먼저 선택해 주세요.
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {!hideDirectPayment && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            className="btn btn-primary btn-block"
            onClick={handleDirectPayment}
            disabled={processing || !selectedCardId}
            style={{ padding: '12px 0', fontSize: 15, fontWeight: 600 }}
          >
            {processing ? '결제 중…' : `선택한 카드로 ${amount.toLocaleString()}원 결제하기`}
          </button>
        </div>
      )}
    </div>
  );
}
