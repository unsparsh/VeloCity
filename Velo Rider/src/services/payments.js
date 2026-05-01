import api from './api'

/**
 * Thin API wrapper around the /payments/* endpoints. Keeps axios calls out of
 * components so retries / tests can stub one place.
 */
export const paymentsApi = {
  getWallet: () => api.get('/payments/wallet/').then((r) => r.data),

  createTopupOrder: (amount) =>
    api.post('/payments/wallet/topup/order/', { amount }).then((r) => r.data),

  verifyTopup: ({ amount, ...rzp }) =>
    api.post('/payments/wallet/topup/verify/', { amount, ...rzp }).then((r) => r.data),

  getRidePayment: (rideId) =>
    api.get(`/payments/ride/${rideId}/`).then((r) => r.data),

  payRide: (rideId, method) =>
    api.post(`/payments/ride/${rideId}/pay/`, { method }).then((r) => r.data),

  verifyRidePayment: (rideId, rzp) =>
    api.post(`/payments/ride/${rideId}/verify/`, rzp).then((r) => r.data),
}

/**
 * Dynamically load the Razorpay Checkout script (idempotent).
 * @returns {Promise<boolean>} true if loaded, false if already loaded or blocked.
 */
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false)
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

/**
 * Open Razorpay Checkout. Resolves with the payment signature payload on success,
 * rejects on user dismissal or failure.
 *
 * @param {object} opts
 * @param {string} opts.keyId
 * @param {object} opts.order - Razorpay order from the backend
 * @param {string} [opts.name='Velocity']
 * @param {string} [opts.description='EV ride payment']
 * @param {object} [opts.prefill]
 */
export async function openRazorpayCheckout(opts) {
  const ok = await loadRazorpayScript()
  if (!ok || !window.Razorpay) {
    throw new Error('Razorpay Checkout could not load.')
  }

  // In mock mode the backend returns a fake order id. Short-circuit so local
  // dev can exercise the full flow without real Razorpay keys.
  if (opts.order?.mock) {
    return {
      razorpay_order_id: opts.order.id,
      razorpay_payment_id: `pay_MOCK${Date.now()}`,
      razorpay_signature: 'MOCK_SIGNATURE',
    }
  }

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: opts.keyId,
      order_id: opts.order.id,
      amount: opts.order.amount,
      currency: opts.order.currency || 'INR',
      name: opts.name || 'Velocity',
      description: opts.description || 'EV ride payment',
      prefill: opts.prefill || {},
      theme: { color: '#18A558' },
      handler: (response) => resolve(response),
      modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
    })
    rzp.on('payment.failed', (resp) => reject(new Error(resp?.error?.description || 'Payment failed.')))
    rzp.open()
  })
}
