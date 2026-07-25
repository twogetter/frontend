'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';

const PAYMENT_API_URL = 'http://localhost:8080';

interface Props {
  code: string | null;
  customerKey: string | null;
  userId: string | null;
}

export default function PaymentCallbackClient({ code, customerKey, userId }: Props) {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isProcessing = useRef(false);

  useEffect(() => {
    if (isProcessing.current) return;

    if (!code || !customerKey || !userId) {
      setStatus('error');
      setErrorMessage('콜백 파라미터가 누락되었습니다.');
      return;
    }

    isProcessing.current = true;
    (async () => {
      try {
        const url = `${PAYMENT_API_URL}/brandpay/callback-auth?userId=${encodeURIComponent(userId)}&customerKey=${encodeURIComponent(customerKey)}&code=${encodeURIComponent(code)}`;

        await apiFetch(url, {
          method: 'GET',
          auth: true,
        });

        setStatus('success');

        setTimeout(() => {
          window.location.href = '/mypage/payment-methods?brandpay=connected';
        }, 2000);
      } catch (error) {
        console.error('Callback relay 처리 오류:', error);
        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : '백엔드 콜백 처리 중 오류가 발생했습니다.'
        );
        setStatus('error');
      }
    })();
  }, [code, customerKey, userId]);

  if (status === 'processing') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          flexDirection: 'column',
        }}
      >
        <div style={{ fontSize: '18px', marginBottom: '20px' }}>
          브랜드페이 연결 처리 중입니다...
        </div>
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f2f4f6',
            borderTop: '4px solid #3182f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          flexDirection: 'column',
          textAlign: 'center',
        }}
      >
        <h1 style={{ color: '#f04452', marginBottom: '20px' }}>오류 발생</h1>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          {errorMessage ?? '결제 콜백 처리 중 오류가 발생했습니다.'}
        </p>
        <button
          onClick={() => (window.location.href = '/mypage/payment-methods')}
          style={{
            padding: '12px 30px',
            backgroundColor: '#3182f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  return null;
}
