import { NavLink, useNavigate } from 'react-router-dom'
import useAdminStore from '../store/useAdminStore'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/rides', label: 'Rides' },
  { to: '/drivers', label: 'Drivers' },
  { to: '/payments', label: 'Payments' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const { admin, logout } = useAdminStore()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
          <g stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
            <line x1="2" y1="4" x2="2" y2="18" />
            <line x1="6" y1="2" x2="6" y2="20" />
            <line x1="10" y1="5" x2="10" y2="17" />
            <line x1="14" y1="3" x2="14" y2="19" />
            <line x1="18" y1="6" x2="18" y2="16" />
          </g>
        </svg>
        <div>
          <div className={styles.brandName}>Velocity</div>
          <div className={styles.brandSub}>Admin</div>
        </div>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.navActive : ''}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <div className={styles.footer}>
        <div className={styles.user}>
          <div className={styles.userAvatar}>
            {admin?.full_name?.[0]?.toUpperCase() || 'A'}
          </div>
          <span className={styles.userName}>{admin?.full_name || 'Admin'}</span>
        </div>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          Sign out
        </button>
      </div>
    </aside>
  )
}
