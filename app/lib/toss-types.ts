export interface TossPaymentsInstance {
  brandpay(options: {
    customerKey: string;
    redirectUrl: string;
  }): BrandpayInstance;
}

export interface BrandpayInstance {
  requestPayment(options: {
    amount: { currency: string; value: number };
    orderId: string;
    orderName: string;
    methodId: string;
    successUrl: string;
    failUrl: string;
    customerName?: string;
  }): Promise<void>;
  addPaymentMethod(): Promise<void>;
  changeOneTouchPay(): Promise<void>;
  changePassword(): Promise<void>;
  openSettings(): Promise<void>;
  requestBillingAuth(): Promise<void>;
}

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => TossPaymentsInstance;
  }
}

export {};
