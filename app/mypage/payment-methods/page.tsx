"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Guard from "../../components/Guard";
import { ApiError, apiData, apiFetch } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { PaymentMethod } from "../../lib/types";

interface PaymentCard {
  id: string;
  displayName: string;
  maskedNumber: string;
}

interface CustomerInfo {
  userId: number;
  customerKey: string;
  cards: PaymentCard[];
  clientKey: string;
  redirectUrl: string;
  billingAgreed: boolean;
}

function PaymentMethods() {
  const { user } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [brandpayBusy, setBrandpayBusy] = useState(false);
  const billingConsentButtonRef = useRef<HTMLButtonElement | null>(null);

  const loadCustomerInfo = useCallback(async () => {
    if (!user) return null;
    const info = await apiData<CustomerInfo>("/api/payments/customer-info");
    setCustomerInfo(info);
    return info;
  }, [user]);

  const loadMethods = useCallback(async () => {
    if (!user) return [];
    const fresh = await apiData<PaymentMethod[]>(`/api/payment-methods/${user.memberId}`);
    setMethods(fresh || []);
    return fresh || [];
  }, [user]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadCustomerInfo(), loadMethods()]);
  }, [loadCustomerInfo, loadMethods]);

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        await refreshAll();
      } catch (e) {
        setError(e instanceof Error ? e.message : "결제수단을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user, refreshAll]);

  const ensureTossPayments = useCallback(async () => {
    if (window.TossPayments) return window.TossPayments;

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://js.tosspayments.com/v2/standard";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Toss SDK 로드 실패"));
      document.body.appendChild(script);
    });

    if (!window.TossPayments) {
      throw new Error("Toss SDK 로드 실패");
    }

    return window.TossPayments;
  }, []);

  const openBrandpay = useCallback(async () => {
    if (!customerInfo) return;
    setBrandpayBusy(true);
    setError(null);
    try {
      const TossPayments = await ensureTossPayments();
      const brandpay = TossPayments(customerInfo.clientKey).brandpay({
        customerKey: customerInfo.customerKey,
        redirectUrl: `${customerInfo.redirectUrl}/callback-auth?userId=${customerInfo.userId}`,
      });
      await brandpay.openSettings();
      await refreshAll().catch(() => undefined);
    } catch (e) {
      const isUserCancel =
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        (e as { code?: string }).code === "USER_CANCEL";

      if (!isUserCancel) {
        setError(e instanceof Error ? e.message : "브랜드페이 설정을 열 수 없습니다.");
      }
      await refreshAll().catch(() => undefined);
    } finally {
      setBrandpayBusy(false);
    }
  }, [customerInfo, ensureTossPayments, refreshAll]);

  const addPaymentMethod = useCallback(async () => {
    if (!customerInfo) return;
    setBrandpayBusy(true);
    setError(null);
    try {
      const TossPayments = await ensureTossPayments();
      const brandpay = TossPayments(customerInfo.clientKey).brandpay({
        customerKey: customerInfo.customerKey,
        redirectUrl: `${customerInfo.redirectUrl}/callback-auth?userId=${customerInfo.userId}`,
      });
      await brandpay.addPaymentMethod();
      await refreshAll().catch(() => undefined);
    } catch (e) {
      const isUserCancel =
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        (e as { code?: string }).code === "USER_CANCEL";

      if (!isUserCancel) {
        setError(e instanceof Error ? e.message : "결제수단 추가에 실패했습니다.");
      }
      await refreshAll().catch(() => undefined);
    } finally {
      setBrandpayBusy(false);
    }
  }, [customerInfo, ensureTossPayments, refreshAll]);

  const requestBillingAuth = useCallback(async () => {
    if (!customerInfo) return;
    setBrandpayBusy(true);
    setError(null);
    try {
      const TossPayments = await ensureTossPayments();
      const brandpay = TossPayments(customerInfo.clientKey).brandpay({
        customerKey: customerInfo.customerKey,
        redirectUrl: `${customerInfo.redirectUrl}/callback-auth?userId=${customerInfo.userId}`,
      });
      await brandpay.requestBillingAuth();
      await apiFetch("/brandpay/billing-auth/success", {
        method: "POST",
        body: { customerKey: customerInfo.customerKey },
      });
      setNotice("정기 자동결제 약관동의가 완료되었습니다.");
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "정기 자동결제 약관동의에 실패했습니다.");
      billingConsentButtonRef.current?.focus();
      billingConsentButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } finally {
      setBrandpayBusy(false);
    }
  }, [customerInfo, ensureTossPayments, refreshAll]);

  const terminateBillingAuth = useCallback(async () => {
    if (!customerInfo) return;
    if (!confirm("정말 정기 자동결제를 해지하시겠습니까?")) return;

    setBrandpayBusy(true);
    setError(null);
    try {
      await apiFetch("/brandpay/billing-auth/terminate", {
        method: "POST",
        body: { customerKey: customerInfo.customerKey },
      });
      setNotice("정기 자동결제가 해지되었습니다.");
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "정기 자동결제 해지에 실패했습니다.");
    } finally {
      setBrandpayBusy(false);
    }
  }, [customerInfo, refreshAll]);

  const sync = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const fresh = await loadMethods();
      await loadCustomerInfo();
      setNotice(
        fresh.length === 0
          ? "토스에 등록된 카드가 없습니다. 브랜드페이에서 카드를 먼저 등록해 주세요."
          : `결제수단 ${fresh.length}건을 불러왔습니다.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "결제수단 동기화에 실패했습니다.");
    } finally {
      setSyncing(false);
    }
  }, [user, loadMethods, loadCustomerInfo]);

  async function designateBilling(id: number) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await apiData(`/api/payment-methods/${id}/billing`, { method: "POST" });
      await refreshAll();
      setNotice("정기결제 카드로 지정되었습니다. 이제 구독을 진행할 수 있어요.");
    } catch (e) {
      const message =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "정기결제 카드 지정에 실패했습니다.";
      if (message.includes("약관") || message.includes("동의")) {
        setNotice("정기결제 약관 동의가 필요합니다.");
        billingConsentButtonRef.current?.focus();
        billingConsentButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setError(message);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function terminateBillingMethod(id: number) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await apiData(`/api/payment-methods/${id}/billing/terminate`, { method: "POST" });
      await refreshAll();
      setNotice("정기결제 카드가 해지되었습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "정기결제 카드 해지에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="container-narrow">
      <h1>결제수단</h1>
      <p className="subtitle">정기 구독 결제에 사용할 카드입니다.</p>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-info">{notice}</div>}

      {loading ? (
        <div className="spinner" />
      ) : methods.length === 0 ? (
        <div className="empty">
          <div className="emoji">💳</div>
          <p>등록된 결제수단이 없어요.</p>
        </div>
      ) : (
        <div>
          <h3 style={{ marginTop: 20 }}>등록된 카드</h3>
          <div className="card">
            {methods.map((m) => (
              <div className="row" key={m.id}>
                <span className="avatar" style={{ background: "var(--bg-elev)", color: "var(--text-dim)" }}>
                  💳
                </span>
                <div className="row-main">
                  <div className="row-title">{m.displayName || m.provider}</div>
                  <div className="row-sub">
                    {m.maskedNumber} · {m.status}
                  </div>
                </div>
                {m.type === "BILLING" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="badge badge-active">정기결제</span>
                    <button className="btn btn-sm" disabled={busyId === m.id} onClick={() => terminateBillingMethod(m.id)}>
                      {busyId === m.id ? "해지 중…" : "해지"}
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-sm" disabled={busyId === m.id} onClick={() => designateBilling(m.id)}>
                    {busyId === m.id ? "지정 중…" : "정기결제로 지정"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <div className="stack">
          <button className="btn btn-primary btn-block" onClick={openBrandpay} disabled={brandpayBusy}>
            {brandpayBusy ? "로드 중…" : "브랜드페이 카드 관리"}
          </button>
          <button className="btn btn-ghost btn-block" onClick={addPaymentMethod} disabled={brandpayBusy}>
            결제수단 추가
          </button>
          <button className="btn btn-ghost btn-block" onClick={sync} disabled={syncing}>
            {syncing ? "불러오는 중…" : "등록한 카드 불러오기"}
          </button>

          {customerInfo?.billingAgreed ? (
              <button className="btn btn-ghost btn-block" onClick={terminateBillingAuth} disabled={brandpayBusy}>
                ✕ 정기 자동결제 해지
              </button>
          ) : (
              <button
                  ref={billingConsentButtonRef}
                  className="btn btn-primary btn-block"
                  onClick={requestBillingAuth}
                  disabled={brandpayBusy}
              >
                ✓ 정기 자동결제 약관동의
              </button>
          )}
        </div>
      </div>

      <div className="alert alert-info" style={{ marginTop: 20 }}>
        <strong>구독까지 3단계</strong>
        <br />
        1. 브랜드페이 카드 관리 또는 결제수단 추가
        <br />
        2. 약관 상태에 맞는 버튼으로 정기결제 동의/해지
        <br />
        3. 등록한 카드 불러오기 후 정기결제 카드 지정
      </div>

    </div>
  );
}

export default function PaymentMethodsPage() {
  return (
    <Guard>
      <PaymentMethods />
    </Guard>
  );
}
