import api from './api';

export interface PaymentOrderResponse {
  razorpay_key_id: string;
  order_id: string;
  amount: number;
  currency: string;
  plan_name: string;
}

export interface VerifyPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PaymentHistoryResponse {
  current_plan: string;
  orders: {
    id: number;
    razorpay_order_id: string;
    razorpay_payment_id: string | null;
    plan_name: string;
    amount: number;
    status: string;
    created_at: string;
  }[];
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const paymentService = {
  // Dynamically load Razorpay SDK Script
  loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  },

  createOrder(plan_name: 'professional' | 'enterprise') {
    return api.post<PaymentOrderResponse>('/payments/create-order', { plan_name });
  },

  verifyPayment(payload: VerifyPaymentPayload) {
    return api.post<{ message: string; plan: string; user?: any }>('/payments/verify', payload);
  },

  getHistory() {
    return api.get<PaymentHistoryResponse>('/payments/history');
  },

  async startPaymentFlow(
    planName: 'professional' | 'enterprise',
    userInfo?: { name?: string; email?: string; contact?: string; phone?: string },
    onSuccess?: (plan: string, updatedUser?: any) => void,
    onError?: (error: string) => void
  ) {
    const loaded = await this.loadRazorpayScript();
    if (!loaded) {
      onError?.('Razorpay SDK failed to load. Please check your internet connection.');
      return;
    }

    try {
      const orderRes = await this.createOrder(planName);
      const { razorpay_key_id, order_id, amount, currency } = orderRes.data;

      const rawPhone = (userInfo?.contact || userInfo?.phone || '').trim().replace(/[\s-]/g, '');
      let formattedContact = rawPhone;
      if (rawPhone) {
        if (!rawPhone.startsWith('+')) {
          if (rawPhone.length === 10) {
            formattedContact = `+91${rawPhone}`;
          } else if (rawPhone.length === 12 && rawPhone.startsWith('91')) {
            formattedContact = `+${rawPhone}`;
          }
        }
      }

      const options = {
        key: razorpay_key_id,
        amount: amount,
        currency: currency,
        name: 'PaySlip Pro',
        description: `Upgrade to ${planName.toUpperCase()} Plan`,
        order_id: order_id,
        prefill: {
          name: userInfo?.name || '',
          email: userInfo?.email || '',
          contact: formattedContact || undefined,
        },
        theme: {
          color: '#171717',
        },
        handler: async (response: any) => {
          try {
            const verifyRes = await paymentService.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            onSuccess?.(verifyRes.data.plan, verifyRes.data.user);
          } catch (err: any) {
            onError?.(err?.response?.data?.detail || 'Payment verification failed.');
          }
        },
        modal: {
          ondismiss: () => {
            onError?.('Payment process was cancelled.');
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      onError?.(err?.response?.data?.detail || 'Failed to initiate payment.');
    }
  },
};
