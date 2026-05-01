import { useEffect, useState } from 'react'
import { fetchStats, fetchRides } from '../services/admin'
import styles from './Dashboard.module.css'

const RIDE_STATUS_LABEL = {
  searching: 'Searching',
  driver_assigned: 'Assigned',
  driver_arriving: 'Arriving',
  otp_verified: 'OTP Verified',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function StatCard({ label, value, sub }) {
  return (
    <div className={styles.statCard}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value}</p>
      {sub && <p className={styles.statSub}>{sub}</p>}
    </div>
  )
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

  return <span className={`${styles.badge} ${cls}`}>{RIDE_STATUS_LABEL[status] || status}</span>
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recentRides, setRecentRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchStats(), fetchRides({ page_size: 10 })])
      .then(([s, r]) => {
        if (cancelled) return
        setStats(s)
        setRecentRides(r.results || [])
      })
      .catch(() => { if (!cancelled) setError('Failed to load dashboard data.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <div className={styles.center}>Loading…</div>
  if (error) return <div className={styles.center}>{error}</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Dashboard</h1>
        <p className={styles.pageSubtitle}>Fleet overview</p>
      </div>

      <div className={styles.statsGrid}>
        <StatCard label="Total Rides" value={stats?.total_rides ?? '—'} />
        <StatCard label="Active Rides" value={stats?.active_rides ?? '—'} />
        <StatCard label="Rides Today" value={stats?.rides_today ?? '—'} />
        <StatCard label="Active Drivers" value={stats?.active_drivers ?? '—'} />
        <StatCard
          label="Total Revenue"
          value={stats?.total_revenue ? `₹${parseFloat(stats.total_revenue).toLocaleString('en-IN')}` : '—'}
        />
        <StatCard
          label="Revenue Today"
          value={stats?.revenue_today ? `₹${parseFloat(stats.revenue_today).toLocaleString('en-IN')}` : '₹0'}
        />
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Recent Rides</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Ride ID</th>
                <th>Rider</th>
                <th>Driver</th>
                <th>Status</th>
                <th>Fare</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentRides.length === 0 ? (
                <tr><td colSpan={6} className={styles.empty}>No rides yet</td></tr>
              ) : recentRides.map((ride) => (
                <tr key={ride.id}>
                  <td className={styles.mono}>{String(ride.id).slice(0, 8)}</td>
                  <td>{ride.user_name || '—'}</td>
                  <td>{ride.driver_name || <span className={styles.muted}>Unassigned</span>}</td>
                  <td><StatusBadge status={ride.status} /></td>
                  <td>{ride.estimated_price ? `₹${ride.estimated_price}` : '—'}</td>
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
      </div>
    </div>
  )
}
