import PaymentCallbackClient from './callback-auth-client';

export default async function PaymentCallbackAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; customerKey?: string; userId?: string }>;
}) {
  const params = await searchParams;
  return (
    <PaymentCallbackClient
      code={params.code ?? null}
      customerKey={params.customerKey ?? null}
      userId={params.userId ?? null}
    />
  );
}
