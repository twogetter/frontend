'use client';

import { useSearchParams } from 'next/navigation';

export default function PaymentSuccess() {
  const searchParams = useSearchParams();
  const customerKey = searchParams.get('customerKey');

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
      <h1 style={{ color: '#1dd1a1', marginBottom: '20px', fontSize: '32px' }}>
        ✓ 결제 성공
      </h1>

      <p
        style={{
          fontSize: '18px',
          color: '#4e5968',
          marginBottom: '30px',
          lineHeight: '1.6',
        }}
      >
        결제가 정상적으로 완료되었습니다.
      </p>

      {customerKey && (
        <div
          style={{
            padding: '15px',
            backgroundColor: '#f2f4f6',
            borderRadius: '6px',
            marginBottom: '20px',
            wordBreak: 'break-all',
          }}
        >
          <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
            Customer Key: <strong>{customerKey}</strong>
          </p>
        </div>
      )}

      <p style={{ fontSize: '14px', color: '#999', marginTop: '40px' }}>
        주문번호는 결제 이메일을 확인해 주세요.
      </p>

      <div style={{ marginTop: '30px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <button
          onClick={() => (window.location.href = '/')}
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

        <button
          onClick={() => window.history.back()}
          style={{
            padding: '12px 30px',
            backgroundColor: '#f2f4f6',
            color: '#333d4b',
            border: '1px solid #e5e8eb',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          뒤로가기
        </button>
      </div>
    </div>
  );
}
