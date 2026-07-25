'use client';

import { useEffect, useRef, useState } from 'react';
import { apiData, ApiError } from '../../lib/api';

interface Props {
  paymentKey: string | null;
  orderId: string | null;
  amount: string | null;
  customerKey: string | null;
  subscriptionOrderId: string | null;
}

export default function PaymentSuccessClient({
  paymentKey,
  orderId,
  amount,
  customerKey,
  subscriptionOrderId,
}: Props) {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState<string>('결제를 승인하는 중입니다...');
  const didConfirm = useRef(false);

  useEffect(() => {
    if (didConfirm.current) return;

    if (!paymentKey || !orderId || !amount || !customerKey) {
      setStatus('error');
      setMessage('결제 승인 정보가 누락되었습니다.');
      return;
    }

    didConfirm.current = true;
    (async () => {
      try {
        const confirmed = await apiData<string>('/api/payments/confirm/brandpay', {
          method: 'POST',
          body: {
            paymentKey,
            orderId,
            amount: Number(amount),
            customerKey,
          },
        });

        setStatus('success');
        setMessage(confirmed || '결제가 완료되었습니다.');

        setTimeout(() => {
          window.location.href = subscriptionOrderId
            ? `/mypage/subscriptions?orderId=${encodeURIComponent(subscriptionOrderId)}`
            : '/mypage/subscriptions';
        }, 2000);
      } catch (error) {
        setStatus('error');
        setMessage(
          error instanceof ApiError ? error.message : '결제 승인 처리 중 오류가 발생했습니다.'
        );
      }
    })();
  }, [paymentKey, orderId, amount, customerKey, subscriptionOrderId]);

  return (
    <div
      style={{
        maxWidth: '600px',
        margin: '60px auto',
        padding: '40px',
        textAlign: 'center',
        border: '1px solid #e5e8eb',
        borderRadius: '8px',
      }}
    >
      <h1
        style={{
          color: status === 'error' ? '#f04452' : '#1dd1a1',
          marginBottom: '20px',
          fontSize: '32px',
        }}
      >
        {status === 'error' ? '✕ 결제 실패' : status === 'success' ? '✓ 결제 성공' : '결제 처리 중'}
      </h1>

      <p
        style={{
          fontSize: '18px',
          color: '#4e5968',
          marginBottom: '30px',
          lineHeight: '1.6',
        }}
      >
        {message}
      </p>

      <div style={{ display: 'grid', gap: 10, textAlign: 'left', marginBottom: 20 }}>
        <div><b>paymentKey</b> {paymentKey ?? '-'}</div>
        <div><b>orderId</b> {orderId ?? '-'}</div>
        <div><b>amount</b> {amount ? `${Number(amount).toLocaleString()}원` : '-'}</div>
        <div><b>customerKey</b> {customerKey ?? '-'}</div>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <a
          href="/mypage/subscriptions"
          style={{
            padding: '12px 30px',
            backgroundColor: '#3182f6',
            color: 'white',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          구독 보기
        </a>
        <a
          href="/"
          style={{
            padding: '12px 30px',
            backgroundColor: '#f2f4f6',
            color: '#333d4b',
            border: '1px solid #e5e8eb',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '16px',
          }}
        >
          홈으로 돌아가기
        </a>
      </div>
    </div>
  );
}
