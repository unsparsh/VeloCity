import { useEffect, useState } from 'react'
import { fetchDrivers } from '../services/admin'
import styles from './Drivers.module.css'

export default function Drivers() {
  const [drivers, setDrivers] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const PAGE_SIZE = 20
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchDrivers({ page, page_size: PAGE_SIZE })
      .then((data) => {
        if (cancelled) return
        setDrivers(data.results || [])
        setCount(data.count || 0)
      })
      .catch(() => { if (!cancelled) setError('Failed to load drivers.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Drivers</h1>
          <p className={styles.pageSubtitle}>{count} registered</p>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Driver</th>
              <th>Phone</th>
              <th>Vehicle</th>
              <th>Status</th>
              <th>Rating</th>
              <th>Total Rides</th>
              <th>Verified</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className={styles.center}>Loading…</td></tr>
            ) : drivers.length === 0 ? (
              <tr><td colSpan={8} className={styles.center}>No drivers registered</td></tr>
            ) : drivers.map((driver) => (
              <tr key={driver.id}>
                <td>
                  <div className={styles.driverCell}>
                    <div className={styles.driverAvatar}>
                      {driver.full_name?.[0]?.toUpperCase() || 'D'}
                    </div>
                    <div>
                      <div className={styles.driverName}>{driver.full_name}</div>
                      {driver.email && <div className={styles.driverEmail}>{driver.email}</div>}
                    </div>
                  </div>
                </td>
                <td className={styles.mono}>{driver.phone}</td>
                <td className={styles.vehicle}>{driver.vehicle || <span className={styles.muted}>—</span>}</td>
                <td>
                  <span className={`${styles.onlineDot} ${driver.is_online ? styles.online : ''}`} />
                  {driver.is_online ? 'Online' : 'Offline'}
                </td>
                <td>{driver.rating ?? '—'}</td>
                <td>{driver.total_rides}</td>
                <td>
                  {driver.is_verified
                    ? <span className={`${styles.badge} ${styles.badgeGreen}`}>Verified</span>
                    : <span className={`${styles.badge} ${styles.badgeGray}`}>Pending</span>}
                </td>
                <td className={styles.muted}>
                  {driver.created_at
                    ? new Date(driver.created_at).toLocaleDateString('en-IN')
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
