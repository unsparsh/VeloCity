import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useWallet from '../hooks/useWallet'
import useAuthStore from '../store/useAuthStore'
import { paymentsApi, openRazorpayCheckout } from '../services/payments'
import styles from './Wallet.module.css'

const QUICK_AMOUNTS = [100, 200, 500, 1000]

export default function Wallet() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { wallet, transactions, loading, error, refresh } = useWallet()
  const [amount, setAmount] = useState(200)
  const [processing, setProcessing] = useState(false)
  const [topupError, setTopupError] = useState('')

  const handleTopup = async () => {
    if (!amount || amount < 1) {
      setTopupError('Enter a valid amount.')
      return
    }
    setProcessing(true)
    setTopupError('')
    try {
      const order = await paymentsApi.createTopupOrder(amount)
      const rzpResp = await openRazorpayCheckout({
        keyId: order.key_id,
        order: order.order,
        description: 'Wallet top-up',
        prefill: {
          name: user?.full_name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
      })
      await paymentsApi.verifyTopup({ amount, ...rzpResp })
      await refresh()
    } catch (err) {
      setTopupError(err.message || 'Top-up failed.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate('/')}
          aria-label="Back"
        >
          ←
        </button>
        <h1 className={styles.heading}>Wallet</h1>
        <span className={styles.spacer} />
      </header>

      <section className={styles.balanceCard}>
        <p className={styles.balanceLabel}>Available balance</p>
        <p className={styles.balanceValue}>
          <span className={styles.balanceCurrency}>₹</span>
          {loading ? '—' : Number(wallet?.balance || 0).toFixed(2)}
        </p>
        {error && <p className={styles.error}>{error}</p>}
      </section>

      <section className={styles.topup}>
        <h2 className={styles.sectionTitle}>Top-up</h2>
        <div className={styles.quickRow}>
          {QUICK_AMOUNTS.map((q) => (
            <button
              key={q}
              type="button"
              className={`${styles.quickBtn} ${amount === q ? styles.quickBtnActive : ''}`}
              onClick={() => setAmount(q)}
            >
              ₹{q}
            </button>
          ))}
        </div>
        <label className={styles.customLabel}>
          Custom amount
          <div className={styles.customInputWrap}>
            <span className={styles.customCurrency}>₹</span>
            <input
              type="number"
              min="1"
              step="1"
              className={styles.customInput}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
        </label>
        {topupError && <p className={styles.error}>{topupError}</p>}
        <button
          type="button"
          className={styles.topupBtn}
          disabled={processing}
          onClick={handleTopup}
        >
          {processing ? 'Processing…' : `Add ₹${amount || 0} to wallet`}
        </button>
      </section>

      <section className={styles.ledger}>
        <h2 className={styles.sectionTitle}>Recent transactions</h2>
        {loading ? (
          <p className={styles.emptyState}>Loading…</p>
        ) : transactions.length === 0 ? (
          <p className={styles.emptyState}>No transactions yet.</p>
        ) : (
          <ul className={styles.txList}>
            {transactions.map((tx) => {
              const delta = Number(tx.amount)
              const positive = delta >= 0
              return (
                <li key={tx.id} className={styles.txItem}>
                  <div className={styles.txMain}>
                    <p className={styles.txLabel}>{formatType(tx.type)}</p>
                    <p className={styles.txMeta}>
                      {new Date(tx.created_at).toLocaleString()}
                    </p>
                  </div>
                  <p className={`${styles.txAmount} ${positive ? styles.txCredit : styles.txDebit}`}>
                    {positive ? '+' : ''}₹{Math.abs(delta).toFixed(2)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function formatType(type) {
  switch (type) {
    case 'topup': return 'Wallet top-up'
    case 'ride_debit': return 'Ride payment'
    case 'refund': return 'Refund'
    case 'adjust': return 'Adjustment'
    default: return type
  }
}
