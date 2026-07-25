import Guard from '../../components/Guard';
import BrandpayCheckout from '../../components/brandpaycheckout';

export default async function BrandpayCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; subscriptionId?: string; name?: string; price?: string }>;
}) {
  const params = await searchParams;
  const orderId = Number(params.orderId ?? 0);
  const subscriptionId = Number(params.subscriptionId ?? 0);
  const name = params.name ?? '구독권';
  const price = Number(params.price ?? 0);

  if (!orderId || !price) {
    return (
      <Guard>
        <div className="container-narrow">
          <div className="card" style={{ textAlign: 'center' }}>
            <h2>결제 정보를 불러올 수 없습니다</h2>
            <p className="subtitle">주문 정보가 누락되었습니다.</p>
          </div>
        </div>
      </Guard>
    );
  }

  return (
    <Guard>
      <div className="container-narrow">
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="between" style={{ marginBottom: 10 }}>
            <span className="muted">주문 ID</span>
            <span style={{ fontWeight: 700 }}>{orderId}</span>
          </div>
          {subscriptionId > 0 && (
            <div className="between" style={{ marginBottom: 10 }}>
              <span className="muted">구독 ID</span>
              <span style={{ fontWeight: 700 }}>{subscriptionId}</span>
            </div>
          )}
          <div className="between" style={{ marginBottom: 10 }}>
            <span className="muted">상품</span>
            <span style={{ fontWeight: 700 }}>{name}</span>
          </div>
          <div className="between">
            <span className="muted">결제금액</span>
            <span style={{ fontWeight: 800, fontSize: 20 }}>{price.toLocaleString()}원</span>
          </div>
        </div>

        <h1 style={{ marginBottom: 8 }}>브랜드페이 결제</h1>
        <p className="subtitle" style={{ marginBottom: 20 }}>
          저장된 Brandpay 카드로 결제를 진행하거나 새 결제수단을 추가하세요.
        </p>

        <BrandpayCheckout orderId={orderId} productName={name} amount={price} />
      </div>
    </Guard>
  );
}
