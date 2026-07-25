import PaymentSuccessClient from './success-client';

export default async function PaymentSuccess({
  searchParams,
}: {
  searchParams: Promise<{
    paymentKey?: string;
    orderId?: string;
    amount?: string;
    customerKey?: string;
    subscriptionOrderId?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <PaymentSuccessClient
      paymentKey={params.paymentKey ?? null}
      orderId={params.orderId ?? null}
      amount={params.amount ?? null}
      customerKey={params.customerKey ?? null}
      subscriptionOrderId={params.subscriptionOrderId ?? null}
    />
  );
}
