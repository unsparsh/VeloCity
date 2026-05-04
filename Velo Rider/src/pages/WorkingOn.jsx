import { useNavigate } from 'react-router-dom'
import styles from './WorkingOn.module.css'

export default function WorkingOn() {
  const navigate = useNavigate()
  return (
    <div className={styles.page}>
      <div className={styles.frame}>
        <div className={styles.brand}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <g stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="4" x2="2" y2="18" />
              <line x1="6" y1="2" x2="6" y2="20" />
              <line x1="10" y1="5" x2="10" y2="17" />
              <line x1="14" y1="3" x2="14" y2="19" />
              <line x1="18" y1="6" x2="18" y2="16" />
            </g>
          </svg>
          <span>Velocity</span>
        </div>
        <div className={styles.iconWrap}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="19" stroke="var(--stroke-2)" strokeWidth="1.5" strokeDasharray="4 4" />
            <path d="M20 12 V21 M20 26 V28" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className={styles.title}>Working on it.</h2>
        <p className={styles.sub}>This feature is coming soon. Check back shortly.</p>
        <button className={styles.backBtn} onClick={() => navigate('/')}>
          ← Back to home
        </button>
      </div>
    </div>
  )
}
