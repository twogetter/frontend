'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ApiError, apiFetch } from '../../lib/api';

// const PAYMENT_API_URL =
//   process.env.NEXT_PUBLIC_PAYMENT_API_URL ?? 'http://localhost:8300';

const PAYMENT_API_URL = 'http://localhost:8300';

export default function PaymentCallback() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>(
    'processing'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const customerKey = searchParams.get('customerKey');
      const userId = searchParams.get('userId');

      if (!code || !customerKey || !userId) {
        setStatus('error');
        setErrorMessage('콜백 파라미터가 누락되었습니다.');
        return;
      }

      try {
        await apiFetch(
          `${PAYMENT_API_URL}/brandpay/callback-auth?userId=${encodeURIComponent(
            userId
          )}&customerKey=${encodeURIComponent(
            customerKey
          )}&code=${encodeURIComponent(code)}`,
          {
            method: 'GET',
            auth: false,
          }
        );

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
    };

    processCallback();
  }, [searchParams]);

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
