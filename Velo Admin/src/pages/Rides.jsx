import { useEffect, useState } from 'react'
import { fetchRides } from '../services/admin'
import styles from './Rides.module.css'

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'searching', label: 'Searching' },
  { value: 'driver_assigned', label: 'Assigned' },
  { value: 'driver_arriving', label: 'Arriving' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const STATUS_LABEL = {
  searching: 'Searching',
  driver_assigned: 'Assigned',
  driver_arriving: 'Arriving',
  otp_verified: 'OTP Verified',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function StatusBadge({ status }) {
  const cls = {
    searching: styles.badgeGray,
    driver_assigned: styles.badgeBlue,
    driver_arriving: styles.badgeBlue,
    otp_verified: styles.badgeBlue,
    in_progress: styles.badgeOrange,
    completed: styles.badgeGreen,
    cancelled: styles.badgeRed,
  }[status] || styles.badgeGray

  return <span className={`${styles.badge} ${cls}`}>{STATUS_LABEL[status] || status}</span>
}

export default function Rides() {
  const [rides, setRides] = useState([])
  const [count, setCount] = useState(0)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const PAGE_SIZE = 20
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchRides({ status: status || undefined, page, page_size: PAGE_SIZE })
      .then((data) => {
        if (cancelled) return
        setRides(data.results || [])
        setCount(data.count || 0)
      })
      .catch(() => { if (!cancelled) setError('Failed to load rides.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [status, page])

  const handleStatusChange = (val) => {
    setStatus(val)
    setPage(1)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Rides</h1>
          <p className={styles.pageSubtitle}>{count} total</p>
        </div>
      </div>

      <div className={styles.filters}>
        {STATUS_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            className={`${styles.filterBtn} ${status === value ? styles.filterActive : ''}`}
            onClick={() => handleStatusChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ride ID</th>
              <th>Rider</th>
              <th>Driver</th>
              <th>Status</th>
              <th>Pickup</th>
              <th>Destination</th>
              <th>Fare</th>
              <th>Distance</th>
              <th>Requested</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className={styles.center}>Loading…</td></tr>
            ) : rides.length === 0 ? (
              <tr><td colSpan={9} className={styles.center}>No rides found</td></tr>
            ) : rides.map((ride) => (
              <tr key={ride.id}>
                <td className={styles.mono}>{String(ride.id).slice(0, 8)}</td>
                <td>{ride.user_name || '—'}</td>
                <td>{ride.driver_name || <span className={styles.muted}>—</span>}</td>
                <td><StatusBadge status={ride.status} /></td>
                <td className={styles.addr}>{ride.pickup_address?.split(',')[0]}</td>
                <td className={styles.addr}>{ride.destination_address?.split(',')[0]}</td>
                <td>{ride.estimated_price ? `₹${ride.estimated_price}` : '—'}</td>
                <td>{ride.distance_km ? `${ride.distance_km} km` : '—'}</td>
                <td className={styles.muted}>
                  {ride.requested_at
                    ? new Date(ride.requested_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
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
