import { useEffect, useState } from 'react'
import { paymentsApi, openRazorpayCheckout } from '../../services/payments'
import useWallet from '../../hooks/useWallet'
import styles from './PaymentSheet.module.css'

/**
 * Post-ride payment sheet. Shows fare, wallet balance, and lets the user
 * choose wallet or Razorpay. Calls onPaid(payment) once the ride is paid.
 *
 * Props:
 *  - ride: the active ride object
 *  - user: { full_name, email, phone }
 *  - onPaid: (payment) => void
 */
export default function PaymentSheet({ ride, user, onPaid }) {
  const { wallet, refresh: refreshWallet } = useWallet()
  const [payment, setPayment] = useState(null)
  const [method, setMethod] = useState('wallet')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  const fare = Number(ride?.final_price || ride?.estimated_price || 0)
  const walletBalance = Number(wallet?.balance || 0)
  const walletShort = walletBalance < fare
  const walletDisabled = walletShort || !wallet

  // Pull any existing payment record on mount (idempotent re-entry).
  useEffect(() => {
    if (!ride?.id) return
    let cancelled = false
    paymentsApi.getRidePayment(ride.id)
      .then((data) => {
        if (cancelled) return
        if (data.payment?.status === 'paid') {
          setPayment(data.payment)
          onPaid?.(data.payment)
        } else if (data.payment) {
          setPayment(data.payment)
        }
      })
      .catch(() => { /* ignore — fresh payment */ })
    return () => { cancelled = true }
  }, [ride?.id])

  const handlePay = async () => {
    if (!ride?.id) return
    setProcessing(true)
    setError('')
    try {
      const result = await paymentsApi.payRide(ride.id, method)

      if (result.payment?.status === 'paid') {
        setPayment(result.payment)
        await refreshWallet()
        onPaid?.(result.payment)
        return
      }

      // Razorpay flow: open checkout, then verify.
      if (method === 'razorpay' && result.order) {
        const rzpResp = await openRazorpayCheckout({
          keyId: result.key_id,
          order: result.order,
          description: `Ride ${String(ride.id).slice(0, 8)}`,
          prefill: {
            name: user?.full_name || '',
            email: user?.email || '',
            contact: user?.phone || '',
          },
        })
        const verified = await paymentsApi.verifyRidePayment(ride.id, rzpResp)
        setPayment(verified.payment)
        onPaid?.(verified.payment)
      }
    } catch (err) {
      setError(err.message || 'Payment failed.')
    } finally {
      setProcessing(false)
    }
  }

  if (payment?.status === 'paid') {
    return (
      <div className={styles.paidCard}>
        <div className={styles.paidIcon}>✓</div>
        <p className={styles.paidTitle}>Payment received</p>
        <p className={styles.paidAmount}>₹{Number(payment.amount).toFixed(2)}</p>
        <p className={styles.paidMeta}>
          Paid via {payment.method === 'wallet' ? 'Wallet' : 'Razorpay'}
        </p>
      </div>
    )
  }

  return (
    <div>
      <h3 className={styles.title}>Pay for your ride</h3>
      <p className={styles.fare}>
        <span className={styles.fareCurrency}>₹</span>
        <span className={styles.fareAmount}>{fare.toFixed(2)}</span>
      </p>

      <div className={styles.methods}>
        <button
          type="button"
          className={`${styles.method} ${method === 'wallet' ? styles.methodActive : ''}`}
          onClick={() => setMethod('wallet')}
          disabled={walletDisabled}
        >
          <div className={styles.methodMain}>
            <span className={styles.methodLabel}>Wallet</span>
            <span className={styles.methodSub}>
              Balance ₹{walletBalance.toFixed(2)}
            </span>
          </div>
          {walletShort && wallet && (
            <span className={styles.methodTag}>Insufficient</span>
          )}
        </button>

        <button
          type="button"
          className={`${styles.method} ${method === 'razorpay' ? styles.methodActive : ''}`}
          onClick={() => setMethod('razorpay')}
        >
          <div className={styles.methodMain}>
            <span className={styles.methodLabel}>Razorpay</span>
            <span className={styles.methodSub}>UPI · Card · Netbanking</span>
          </div>
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button
        type="button"
        className={styles.payBtn}
        disabled={processing || (method === 'wallet' && walletDisabled)}
        onClick={handlePay}
      >
        {processing ? 'Processing…' : `Pay ₹${fare.toFixed(2)}`}
      </button>
    </div>
  )
}
