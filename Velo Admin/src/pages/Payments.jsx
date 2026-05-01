import { useEffect, useState } from 'react'
import { fetchPayments } from '../services/admin'
import styles from './Payments.module.css'

function StatusBadge({ status }) {
  const cls = {
    pending: styles.badgeOrange,
    paid: styles.badgeGreen,
    failed: styles.badgeRed,
    refunded: styles.badgeGray,
  }[status] || styles.badgeGray

  return (
    <span className={`${styles.badge} ${cls}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function MethodBadge({ method }) {
  return (
    <span className={`${styles.badge} ${method === 'razorpay' ? styles.badgeBlue : styles.badgePurple}`}>
      {method === 'razorpay' ? 'Razorpay' : 'Wallet'}
    </span>
  )
}

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const PAGE_SIZE = 20
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchPayments({ page, page_size: PAGE_SIZE })
      .then((data) => {
        if (cancelled) return
        setPayments(data.results || [])
        setCount(data.count || 0)
      })
      .catch(() => { if (!cancelled) setError('Failed to load payments.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page])

  const totalPaid = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Payments</h1>
          <p className={styles.pageSubtitle}>{count} transactions</p>
        </div>
        {totalPaid > 0 && (
          <div className={styles.summaryCard}>
            <p className={styles.summaryLabel}>Collected (this page)</p>
            <p className={styles.summaryValue}>
              ₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Payment ID</th>
              <th>Rider</th>
              <th>Ride ID</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
              <th>Paid At</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className={styles.center}>Loading…</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={8} className={styles.center}>No payments yet</td></tr>
            ) : payments.map((payment) => (
              <tr key={payment.id}>
                <td className={styles.mono}>{String(payment.id).slice(0, 8)}</td>
                <td>{payment.user_name || '—'}</td>
                <td className={styles.mono}>{String(payment.ride_id).slice(0, 8)}</td>
                <td className={styles.amount}>
                  {payment.currency} {parseFloat(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td><MethodBadge method={payment.method} /></td>
                <td><StatusBadge status={payment.status} /></td>
                <td className={styles.muted}>
                  {payment.paid_at
                    ? new Date(payment.paid_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                    : '—'}
                </td>
                <td className={styles.muted}>
                  {payment.created_at
                    ? new Date(payment.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <button
          className={styles.pageBtn}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          Previous
        </button>
        <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
        <button
          className={styles.pageBtn}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          Next
        </button>
      </div>
    </div>
  )
}
