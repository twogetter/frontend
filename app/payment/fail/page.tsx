export default async function PaymentFail({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; message?: string }>;
}) {
  const params = await searchParams;
  const code = params.code ?? null;
  const message = params.message ?? null;

  const getErrorMessage = (errorCode: string | null, errorMessage: string | null) => {
    if (errorMessage) return errorMessage;

    const errorMessages: Record<string, string> = {
      INVALID_REQUEST: '잘못된 요청입니다.',
      UNAUTHORIZED: '인증에 실패했습니다.',
      FORBIDDEN: '권한이 없습니다.',
      NOT_FOUND: '요청한 리소스를 찾을 수 없습니다.',
      INTERNAL_SERVER_ERROR: '서버 오류가 발생했습니다.',
      PAYMENT_FAILED: '결제에 실패했습니다.',
      ALREADY_PAID: '이미 결제된 주문입니다.',
      CANCELLED_PAYMENT: '결제가 취소되었습니다.',
    };

    return errorMessages[errorCode || ''] || '결제 처리 중 오류가 발생했습니다.';
  };

  return (
    <div
      style={{
        maxWidth: '600px',
        margin: '60px auto',
        padding: '40px',
        textAlign: 'center',
        border: '1px solid #f5a5a5',
        borderRadius: '8px',
        backgroundColor: '#fff5f5',
      }}
    >
      <h1 style={{ color: '#f04452', marginBottom: '20px', fontSize: '32px' }}>
        ✕ 결제 실패
      </h1>

      <div
        style={{
          padding: '20px',
          backgroundColor: '#ffe5e5',
          borderRadius: '6px',
          marginBottom: '30px',
        }}
      >
        <p style={{ fontSize: '16px', color: '#f04452', margin: '10px 0' }}>
          {getErrorMessage(code, message)}
        </p>

        {code && (
          <p style={{ fontSize: '12px', color: '#d63031', margin: '10px 0' }}>
            Error Code: <strong>{code}</strong>
          </p>
        )}
      </div>

      <p style={{ fontSize: '14px', color: '#666', marginBottom: '30px' }}>
        결제 과정에서 문제가 발생했습니다. 다시 시도해 주세요.
      </p>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <a
          href="/mypage/payment-methods"
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
          다시 시도
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

      <p style={{ fontSize: '12px', color: '#999', marginTop: '40px' }}>
        문제가 계속되면 고객 지원팀에 문의해 주세요.
      </p>
    </div>
  );
}
