import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { motion, AnimatePresence } from 'framer-motion'
import useDriverStore from '../store/useDriverStore'
import useGeolocation from '../hooks/useGeolocation'
import useLocationBroadcast from '../hooks/useLocationBroadcast'
import useRidePolling from '../hooks/useRidePolling'
import useRideRoute from '../hooks/useRideRoute'
import api from '../services/api'
import { drawRouteOnMap, clearRouteOnMap } from '../utils/mapRoute'
import styles from './DriverHome.module.css'

const MAP_STYLE = import.meta.env.VITE_MAPCN_STYLE_URL || 'https://demotiles.maplibre.org/style.json'

const DRIVER_STATES = {
  offline:        'offline',
  online:         'online',
  ride_incoming:  'ride_incoming',
  ride_active:    'ride_active',
  ride_completed: 'ride_completed',
}

const STATUS_LABELS = {
  driver_assigned: 'Navigate to pickup',
  driver_arriving: 'Enter passenger OTP',
  otp_verified:    'Ready to start ride',
  in_progress:     'Ride in progress',
}

const SCREENS = ['dashboard', 'earnings', 'history', 'messages', 'profile']

const SCREEN_TITLES = {
  dashboard: 'Dashboard',
  earnings:  'Earnings',
  history:   'History',
  messages:  'Messages',
  profile:   'Profile',
}

/* ── Dummy data for secondary screens ─────────────────────────── */
const DUMMY_TRIPS = [
  { id: '#812441', name: 'Steve Bowen',   initials: 'SB', bg: '#FCE9D6', fg: '#A14F11', from: '7958 Swift Village', to: '105 William St', time: '14:22', km: '2.2', fare: '₹220', status: 'done' },
  { id: '#812440', name: 'Andre Clarke',  initials: 'AC', bg: '#E5EFFB', fg: '#1E5BB0', from: '61 Will Terrace',    to: '7617 Hegmann',   time: '13:48', km: '1.8', fare: '₹180', status: 'done' },
  { id: '#812435', name: 'Jordan Weaver', initials: 'JW', bg: '#F4E5FB', fg: '#6B1EB0', from: 'Airport T3',         to: 'City Center',    time: '12:30', km: '22.4', fare: '₹480', status: 'done' },
  { id: '#812430', name: 'Mira Chen',     initials: 'MC', bg: '#EAF6EE', fg: '#0E2A1C', from: 'Wicker Park',        to: 'Lincoln Sq',     time: '11:54', km: '5.1', fare: '₹284', status: 'done' },
  { id: '#812422', name: 'Rita Valdez',   initials: 'RV', bg: '#FCE9D6', fg: '#A14F11', from: 'Union Station',      to: 'Navy Pier',      time: '10:12', km: '3.7', fare: '—',    status: 'cancel' },
]

const DUMMY_PAYOUTS = [
  { method: 'UPI · saved@ybl',      when: 'Mon · May 4 · 09:12', amt: '+₹3,250' },
  { method: 'UPI · saved@ybl',      when: 'Sun · May 3 · 22:48', amt: '+₹1,482' },
  { method: 'Bonus · weekend surge', when: 'Sat · May 2 · 23:59', amt: '+₹420'  },
  { method: 'UPI · saved@ybl',      when: 'Fri · May 1 · 19:02', amt: '+₹964'  },
]

const DUMMY_MESSAGES = [
  { initials: 'SB', bg: '#FCE9D6', fg: '#A14F11', name: 'Steve Bowen',   time: '5:33 PM',   preview: 'OK, I am waiting at the main gate', unread: 0 },
  { initials: 'AC', bg: '#E5EFFB', fg: '#1E5BB0', name: 'Andre Clarke',  time: '4:12 PM',   preview: 'Just heads up, I have one bag with me', unread: 2 },
  { initials: 'JW', bg: '#F4E5FB', fg: '#6B1EB0', name: 'Jordan Weaver', time: '2:58 PM',   preview: 'Flight just landed, give me 10 mins', unread: 1 },
  { initials: 'MC', bg: '#EAF6EE', fg: '#0E2A1C', name: 'Mira Chen',     time: 'Yesterday', preview: 'Thanks for the smooth ride!', unread: 0 },
]

const DAYS = [
  { day: 'Sun', num: '10' }, { day: 'Mon', num: '11' }, { day: 'Tue', num: '12' },
  { day: 'Wed', num: '13' }, { day: 'Thu', num: '14' }, { day: 'Fri', num: '15' },
  { day: 'Sat', num: '16', active: true },
]

/* ── Inline SVG icons ──────────────────────────────────────────── */
function IconHome() {
  return <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12L12 4l9 8"/><path d="M5 10v10h14V10"/></svg>
}
function IconEarnings() {
  return <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M7 15h2"/></svg>
}
function IconHistory() {
  return <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
}
function IconMessages() {
  return <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}
function IconProfile() {
  return <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
}

const NAV_ICONS = { dashboard: IconHome, earnings: IconEarnings, history: IconHistory, messages: IconMessages, profile: IconProfile }
const NAV_LABELS = { dashboard: 'Dashboard', earnings: 'Earnings', history: 'History', messages: 'Messages', profile: 'Profile' }

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function DriverHome() {
  const navigate = useNavigate()
  const { driver, logout } = useDriverStore()
  const { location: userLocation } = useGeolocation()

  const mapContainerRef = useRef(null)
  const mapRef          = useRef(null)
  const userMarkerRef   = useRef(null)

  const [activeScreen,  setActiveScreen]  = useState('dashboard')
  const [driverState,   setDriverState]   = useState(DRIVER_STATES.offline)
  const [pendingRide,   setPendingRide]   = useState(null)
  const [activeRide,    setActiveRide]    = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [error,         setError]         = useState('')
  const [otpInput,      setOtpInput]      = useState('')
  const [completedRide, setCompletedRide] = useState(null)
  const [paymentStatus, setPaymentStatus] = useState(null)
  const [activeMsg,     setActiveMsg]     = useState(0)

  const routeGeometry = useRideRoute(activeRide?.id)
  const isOnline = driverState !== DRIVER_STATES.offline
  useLocationBroadcast(isOnline)

  /* ── Ride polling ─────────────────────────────────────────────── */
  const handleRideFound = useCallback((ride) => {
    if (driverState === DRIVER_STATES.online) {
      setPendingRide(ride)
      setDriverState(DRIVER_STATES.ride_incoming)
    }
  }, [driverState])

  useRidePolling(driverState === DRIVER_STATES.online, handleRideFound)

  /* ── Map init ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return
    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [77.209, 28.6139],
      zoom: 13,
    })
    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right')
    return () => { mapRef.current?.remove(); mapRef.current = null }
  }, [])

  /* ── Resize map when switching back to dashboard ──────────────── */
  useEffect(() => {
    if (activeScreen === 'dashboard') {
      setTimeout(() => mapRef.current?.resize(), 60)
    }
  }, [activeScreen])

  /* ── Track user location ──────────────────────────────────────── */
  useEffect(() => {
    if (!userLocation || !mapRef.current) return
    mapRef.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 14 })
    userMarkerRef.current?.remove()
    const el = document.createElement('div')
    el.className = styles.userDot
    userMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(mapRef.current)
  }, [userLocation])

  /* ── Poll payment after ride complete ─────────────────────────── */
  useEffect(() => {
    if (driverState !== DRIVER_STATES.ride_completed || !completedRide) return
    let cancelled = false
    const check = async () => {
      try {
        const { data } = await api.get(`/payments/ride/${completedRide.id}/`)
        if (!cancelled) setPaymentStatus(data.status === 'paid' ? 'paid' : 'unpaid')
      } catch {
        if (!cancelled) setPaymentStatus('unpaid')
      }
    }
    check()
    const timer = setInterval(check, 3000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [driverState, completedRide])

  /* ── Draw route on map ────────────────────────────────────────── */
  useEffect(() => {
    if (!mapRef.current) return
    if (routeGeometry) drawRouteOnMap(mapRef.current, routeGeometry)
    else clearRouteOnMap(mapRef.current)
  }, [routeGeometry])

  /* ── Actions ──────────────────────────────────────────────────── */
  const handleGoOnline = async () => {
    setError('')
    setActionLoading(true)
    try {
      await api.post('/location/go-online/')
      setDriverState(DRIVER_STATES.online)
    } catch {
      setError('Could not go online. Try again.')
    } finally { setActionLoading(false) }
  }

  const handleGoOffline = async () => {
    setError('')
    setActionLoading(true)
    try {
      await api.post('/location/go-offline/')
      setDriverState(DRIVER_STATES.offline)
      setPendingRide(null)
      setActiveRide(null)
    } catch { /* best-effort */ } finally { setActionLoading(false) }
  }

  const handleAccept = async () => {
    if (!pendingRide) return
    setActionLoading(true)
    setError('')
    try {
      const { data } = await api.post(`/rides/driver/${pendingRide.id}/accept/`)
      setActiveRide(data)
      setDriverState(DRIVER_STATES.ride_active)
      setPendingRide(null)
      if (mapRef.current && data.pickup_lng && data.pickup_lat) {
        mapRef.current.flyTo({ center: [data.pickup_lng, data.pickup_lat], zoom: 14 })
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not accept ride.')
      setDriverState(DRIVER_STATES.online)
      setPendingRide(null)
    } finally { setActionLoading(false) }
  }

  const handleDecline = () => {
    setPendingRide(null)
    setDriverState(DRIVER_STATES.online)
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (!activeRide || otpInput.length !== 4) { setError('Enter the 4-digit OTP.'); return }
    setActionLoading(true)
    setError('')
    try {
      const { data } = await api.post(`/rides/driver/${activeRide.id}/verify-otp/`, { otp: otpInput })
      setActiveRide(data)
      setOtpInput('')
    } catch (err) {
      setError(err.response?.data?.error || 'OTP verification failed.')
    } finally { setActionLoading(false) }
  }

  const handleStatusUpdate = async (newStatus) => {
    if (!activeRide) return
    setActionLoading(true)
    setError('')
    try {
      const { data } = await api.post(`/rides/driver/${activeRide.id}/status/`, { status: newStatus })
      if (newStatus === 'completed') {
        setCompletedRide(activeRide)
        setPaymentStatus(null)
        setActiveRide(null)
        setDriverState(DRIVER_STATES.ride_completed)
      } else {
        setActiveRide(data)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Status update failed.')
    } finally { setActionLoading(false) }
  }

  const handleDismissCompleted = () => {
    setCompletedRide(null)
    setPaymentStatus(null)
    setDriverState(DRIVER_STATES.online)
  }

  const handleLogout = () => logout().then(() => navigate('/login'))

  const driverInitials = driver?.display_name
    ? driver.display_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : 'DR'

  /* ── Render panel content ─────────────────────────────────────── */
  function renderPanelBody() {
    switch (driverState) {
      case DRIVER_STATES.offline:
        return (
          <motion.div
            key="offline"
            className={styles.panelState}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className={styles.offlineIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 13l2-6h14l2 6"/>
                <circle cx="7" cy="17" r="2"/>
                <circle cx="17" cy="17" r="2"/>
                <path d="M3 13h18v4H3z"/>
              </svg>
            </div>
            <h3 className={styles.panelTitle}>You&apos;re offline</h3>
            <p className={styles.panelSub}>Go online to start receiving ride requests</p>
            {error && <p className={styles.panelError}>{error}</p>}
            <button className={styles.btnPrimary} onClick={handleGoOnline} disabled={actionLoading}>
              {actionLoading ? 'Going online…' : 'Go Online'}
            </button>
          </motion.div>
        )

      case DRIVER_STATES.online:
        return (
          <motion.div
            key="online"
            className={styles.panelState}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className={styles.searchingPulse}>
              <div className={styles.pulseRing} />
              <div className={styles.pulseRing} style={{ animationDelay: '0.4s' }} />
              <div className={styles.pulseRing} style={{ animationDelay: '0.8s' }} />
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style={{ position: 'relative', zIndex: 1, color: 'var(--green-900)' }}>
                <path d="M3 11l18-8-8 18-2-8z"/>
              </svg>
            </div>
            <h3 className={styles.panelTitle}>Looking for rides…</h3>
            <p className={styles.panelSub}>You&apos;ll be notified when a ride is available nearby</p>
            {error && <p className={styles.panelError}>{error}</p>}
            <button className={styles.btnGhost} onClick={handleGoOffline} disabled={actionLoading}>
              Go offline
            </button>
          </motion.div>
        )

      case DRIVER_STATES.ride_incoming:
        return pendingRide ? (
          <motion.div
            key="incoming"
            className={styles.panelState}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className={styles.incomingHeader}>
              <div>
                <span className={styles.newBadge}>NEW REQUEST</span>
                <h3 className={styles.incomingName}>{pendingRide.user_name || 'Passenger'}</h3>
                <p className={styles.panelSub} style={{ marginBottom: 0 }}>{pendingRide.distance_km} km away</p>
              </div>
              <div className={styles.fareTag}>
                <span className={styles.fareCurrency}>₹</span>
                <span className={styles.fareAmount}>{pendingRide.estimated_price}</span>
              </div>
            </div>

            <div className={styles.routeCard}>
              <div className={styles.routeRow}>
                <span className={styles.routeDotGreen} />
                <div>
                  <div className={styles.routeLabel}>Pickup</div>
                  <div className={styles.routeAddr}>{pendingRide.pickup_address?.split(',')[0]}</div>
                </div>
              </div>
              <div className={styles.routeLine} />
              <div className={styles.routeRow}>
                <span className={styles.routeDotDark} />
                <div>
                  <div className={styles.routeLabel}>Drop off</div>
                  <div className={styles.routeAddr}>{pendingRide.destination_address?.split(',')[0]}</div>
                </div>
              </div>
            </div>

            {error && <p className={styles.panelError}>{error}</p>}
            <div className={styles.actionRow}>
              <button className={styles.btnDecline} onClick={handleDecline} disabled={actionLoading}>Decline</button>
              <button className={styles.btnAccept} onClick={handleAccept} disabled={actionLoading}>
                {actionLoading ? 'Accepting…' : `Accept · ₹${pendingRide.estimated_price}`}
              </button>
            </div>
          </motion.div>
        ) : null

      case DRIVER_STATES.ride_active:
        return activeRide ? (
          <motion.div
            key="active"
            className={styles.panelState}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className={styles.passengerRow}>
              <div className={styles.passengerAvatar}>
                {activeRide.user_name?.[0]?.toUpperCase() || 'P'}
              </div>
              <div>
                <p className={styles.passengerName}>{activeRide.user_name || 'Passenger'}</p>
                <p className={styles.rideStatusLabel}>{STATUS_LABELS[activeRide.status] || activeRide.status}</p>
              </div>
              <div className={styles.fareTag} style={{ marginLeft: 'auto' }}>
                <span className={styles.fareCurrency}>₹</span>
                <span className={styles.fareAmount}>{activeRide.estimated_price}</span>
              </div>
            </div>

            <div className={styles.routeCard}>
              <div className={styles.routeRow}>
                <span className={styles.routeDotGreen} />
                <div>
                  <div className={styles.routeLabel}>Pickup</div>
                  <div className={styles.routeAddr}>{activeRide.pickup_address?.split(',')[0]}</div>
                </div>
              </div>
              <div className={styles.routeLine} />
              <div className={styles.routeRow}>
                <span className={styles.routeDotDark} />
                <div>
                  <div className={styles.routeLabel}>Drop off</div>
                  <div className={styles.routeAddr}>{activeRide.destination_address?.split(',')[0]}</div>
                </div>
              </div>
            </div>

            {error && <p className={styles.panelError}>{error}</p>}

            <div className={styles.statusActions}>
              {activeRide.status === 'driver_assigned' && (
                <button className={styles.btnPrimary} onClick={() => handleStatusUpdate('driver_arriving')} disabled={actionLoading}>
                  I&apos;ve arrived at pickup
                </button>
              )}
              {activeRide.status === 'driver_arriving' && (
                <form className={styles.otpForm} onSubmit={handleVerifyOtp}>
                  <label className={styles.otpFormLabel}>Ask passenger for 4-digit OTP</label>
                  <input
                    className={styles.otpFormInput}
                    type="text"
                    inputMode="numeric"
                    placeholder="· · · ·"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    autoFocus
                  />
                  <button className={styles.btnPrimary} type="submit" disabled={actionLoading || otpInput.length !== 4}>
                    {actionLoading ? 'Verifying…' : 'Verify OTP'}
                  </button>
                </form>
              )}
              {activeRide.status === 'otp_verified' && (
                <button className={styles.btnPrimary} onClick={() => handleStatusUpdate('in_progress')} disabled={actionLoading}>
                  Start ride
                </button>
              )}
              {activeRide.status === 'in_progress' && (
                <button className={`${styles.btnPrimary} ${styles.btnDark}`} onClick={() => handleStatusUpdate('completed')} disabled={actionLoading}>
                  Complete ride
                </button>
              )}
            </div>
          </motion.div>
        ) : null

      case DRIVER_STATES.ride_completed:
        return completedRide ? (
          <motion.div
            key="completed"
            className={styles.panelState}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className={styles.completedHeader}>
              <div className={styles.completedIcon}>✓</div>
              <h3 className={styles.panelTitle}>Ride complete</h3>
              <p className={styles.panelSub}>{completedRide.user_name || 'Passenger'}</p>
            </div>
            <div className={styles.completedRow}>
              <span className={styles.completedLabel}>Fare</span>
              <span className={styles.completedFare}>₹{completedRide.estimated_price}</span>
            </div>
            <div className={styles.completedRow}>
              <span className={styles.completedLabel}>Payment</span>
              <span className={`${styles.payBadge} ${
                paymentStatus === 'paid' ? styles.payPaid :
                paymentStatus === 'unpaid' ? styles.payPending :
                styles.payChecking
              }`}>
                {paymentStatus === 'paid' ? 'Paid' : paymentStatus === 'unpaid' ? 'Awaiting payment' : 'Checking…'}
              </span>
            </div>
            <button className={styles.btnGhost} onClick={handleDismissCompleted} style={{ marginTop: 16 }}>
              Back to searching
            </button>
          </motion.div>
        ) : null

      default:
        return null
    }
  }

  /* ── Earnings screen ─────────────────────────────────────────── */
  function renderEarnings() {
    return (
      <section className={`${styles.screen} ${activeScreen === 'earnings' ? styles.screenActive : ''}`}>
        <div className={styles.screenTopbar}>
          <div>
            <h1 className={styles.topbarTitle}>Earnings</h1>
            <div className={styles.topbarCrumb}>May 1 – May 4, 2026 · UPI + Cash combined</div>
          </div>
          <div className={styles.topbarSpacer} />
          <button className={styles.btnGhostSm}>Export CSV</button>
          <button className={styles.btnDarkSm}>Cash out · ₹1,875</button>
        </div>

        <div className={styles.screenPad}>
          <div className={styles.earnGrid}>
            <div className={styles.earnHero}>
              <div className={styles.earnLabel}>Lifetime earned</div>
              <div className={styles.earnTotal}>₹1,24,803</div>
              <div className={styles.earnTag}>▲ ₹3,250 this week · best week this month</div>
              <div className={styles.pillRow}>
                {['Today', 'This week', 'Month', 'Year'].map((p, i) => (
                  <span key={p} className={`${styles.pill} ${i === 1 ? styles.pillActive : ''}`}>{p}</span>
                ))}
              </div>
              <div className={styles.bars}>
                {[38, 56, 72, 48, 86, 60, 95].map((h, i) => (
                  <div
                    key={i}
                    className={`${styles.bar} ${i === 4 || i === 2 ? styles.barHi : ''} ${i === 6 ? styles.barCur : ''}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className={styles.barLabels}>
                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <span key={d}>{d}</span>)}
              </div>
            </div>

            <div className={styles.payoutsCard}>
              <h4 className={styles.payoutsTitle}>Recent payouts</h4>
              {DUMMY_PAYOUTS.map((p, i) => (
                <div key={i} className={styles.payoutRow}>
                  <div className={styles.payoutIcon}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
                  </div>
                  <div>
                    <div className={styles.payoutWho}>{p.method}</div>
                    <div className={styles.payoutWhen}>{p.when}</div>
                  </div>
                  <div className={styles.payoutAmt}>{p.amt}</div>
                </div>
              ))}
            </div>
          </div>

          <h3 className={styles.sectionHeading}>Trip-level breakdown</h3>
          <div className={styles.tblWrap}>
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th>Trip</th><th>Rider</th><th>Time</th><th>Distance</th><th>Method</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {DUMMY_TRIPS.map(t => (
                  <tr key={t.id}>
                    <td className={styles.mono}>{t.id}</td>
                    <td>
                      <div className={styles.pax}>
                        <div className={styles.paxAvatar} style={{ background: t.bg, color: t.fg }}>{t.initials}</div>
                        {t.name}
                      </div>
                    </td>
                    <td className={styles.mono}>{t.time}</td>
                    <td className={styles.mono}>{t.km} km</td>
                    <td><span className={styles.chip}>UPI</span></td>
                    <td>
                      <span className={`${styles.statusDot} ${t.status === 'done' ? styles.statusDone : styles.statusCancel}`}>
                        {t.status === 'done' ? 'Completed' : 'Cancelled'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }} className={styles.mono}>{t.fare}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    )
  }

  /* ── History screen ──────────────────────────────────────────── */
  function renderHistory() {
    return (
      <section className={`${styles.screen} ${activeScreen === 'history' ? styles.screenActive : ''}`}>
        <div className={styles.screenTopbar}>
          <div>
            <h1 className={styles.topbarTitle}>Trip history</h1>
            <div className={styles.topbarCrumb}>All completed and cancelled rides</div>
          </div>
          <div className={styles.topbarSpacer} />
          <div className={styles.searchBox}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            <input type="text" placeholder="Filter by rider, address, ID…" />
          </div>
        </div>

        <div className={styles.screenPad}>
          <div className={styles.daypicker}>
            {DAYS.map(d => (
              <div key={d.num} className={`${styles.day} ${d.active ? styles.dayActive : ''}`}>
                <span>{d.day}</span>
                <span className={styles.dayNum}>{d.num}</span>
              </div>
            ))}
          </div>

          <div className={styles.statsRow}>
            {[
              { label: 'Total earned', value: '₹3,250', variant: 'green' },
              { label: 'Trips',        value: '10',     variant: '' },
              { label: 'Hours',        value: '8.2',    variant: '' },
              { label: 'Avg fare',     value: '₹325',   variant: 'dark' },
            ].map(s => (
              <div key={s.label} className={`${styles.statCard} ${s.variant === 'green' ? styles.statGreen : s.variant === 'dark' ? styles.statDark : ''}`}>
                <div className={styles.statLabel}>{s.label}</div>
                <div className={styles.statValue}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className={styles.tblWrap}>
            <table className={styles.tbl}>
              <thead>
                <tr><th>ID</th><th>Rider</th><th>Route</th><th>Time</th><th>Dist</th><th>Status</th><th style={{ textAlign: 'right' }}>Fare</th></tr>
              </thead>
              <tbody>
                {DUMMY_TRIPS.map(t => (
                  <tr key={t.id}>
                    <td className={styles.mono}>{t.id}</td>
                    <td>
                      <div className={styles.pax}>
                        <div className={styles.paxAvatar} style={{ background: t.bg, color: t.fg }}>{t.initials}</div>
                        {t.name}
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--ink-700)' }}>{t.from} → {t.to}</td>
                    <td className={styles.mono}>{t.time}</td>
                    <td className={styles.mono}>{t.km} km</td>
                    <td>
                      <span className={`${styles.statusDot} ${t.status === 'done' ? styles.statusDone : styles.statusCancel}`}>
                        {t.status === 'done' ? 'Completed' : 'Cancelled'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }} className={styles.mono}>{t.fare}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    )
  }

  /* ── Messages screen ─────────────────────────────────────────── */
  function renderMessages() {
    const active = DUMMY_MESSAGES[activeMsg]
    return (
      <section className={`${styles.screen} ${activeScreen === 'messages' ? styles.screenActive : ''}`}>
        <div className={styles.screenTopbar}>
          <div>
            <h1 className={styles.topbarTitle}>Messages</h1>
            <div className={styles.topbarCrumb}>Conversations with current and recent riders</div>
          </div>
          <div className={styles.topbarSpacer} />
          <button className={styles.btnGhostSm}>Mark all read</button>
        </div>

        <div className={styles.screenPad}>
          <div className={styles.msgGrid}>
            <div className={styles.msgList}>
              <div className={styles.msgSearch}>
                <div className={styles.searchBox}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                  <input type="text" placeholder="Search messages" />
                </div>
              </div>
              {DUMMY_MESSAGES.map((m, i) => (
                <div
                  key={i}
                  className={`${styles.msgItem} ${i === activeMsg ? styles.msgItemActive : ''}`}
                  onClick={() => setActiveMsg(i)}
                >
                  <div className={styles.msgAvatar} style={{ background: m.bg, color: m.fg }}>{m.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={styles.msgItemTop}>
                      <span className={styles.msgItemName}>{m.name}</span>
                      <span className={styles.msgItemTime}>{m.time}</span>
                    </div>
                    <div className={styles.msgPreview}>{m.preview}</div>
                  </div>
                  {m.unread > 0 && <span className={styles.unreadBadge}>{m.unread}</span>}
                </div>
              ))}
            </div>

            <div className={styles.msgThread}>
              <div className={styles.threadHead}>
                <div className={styles.msgAvatar} style={{ background: active.bg, color: active.fg }}>{active.initials}</div>
                <div>
                  <div className={styles.threadName}>{active.name}</div>
                  <div className={styles.threadSub}>Trip #812441 · Swift Village → William St</div>
                </div>
                <div className={styles.threadActions}>
                  <button className={styles.iconBtn}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92V20a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.13 12.1 19.79 19.79 0 0 1 2.12 3.5 2 2 0 0 1 4.11 2h3.08a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </button>
                </div>
              </div>
              <div className={styles.threadBody}>
                <div className={styles.dayDivider}>Today · 5:03 PM</div>
                <div className={styles.bubble}>Hello, are you nearby?</div>
                <div className={`${styles.bubble} ${styles.bubbleMe}`}>
                  I&apos;ll be there in a few mins
                  <div className={styles.bubbleTs}>5:04 PM</div>
                </div>
                <div className={styles.bubble}>OK, I am waiting at the main gate</div>
                <div className={styles.dayDivider}>5:33 PM</div>
                <div className={`${styles.bubble} ${styles.bubbleMe}`}>
                  Sorry, I&apos;m stuck in traffic. Please give me a moment.
                  <div className={styles.bubbleTs}>5:33 PM ✓✓</div>
                </div>
              </div>
              <div className={styles.threadInput}>
                <input type="text" placeholder="Type a message…" />
                <button className={styles.sendBtn}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 11l18-8-8 18-2-8z"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  /* ── Profile screen ──────────────────────────────────────────── */
  function renderProfile() {
    const name = driver?.display_name || 'Demo Driver'
    const phone = driver?.phone || '+91 99999 99999'
    const email = driver?.email || 'demo-driver@velocity.app'
    return (
      <section className={`${styles.screen} ${activeScreen === 'profile' ? styles.screenActive : ''}`}>
        <div className={styles.screenTopbar}>
          <div>
            <h1 className={styles.topbarTitle}>Profile &amp; Vehicle</h1>
            <div className={styles.topbarCrumb}>Personal details, vehicle and documents</div>
          </div>
          <div className={styles.topbarSpacer} />
          <button className={styles.btnGhostSm}>Edit photo</button>
          <button className={styles.btnPrimarySm}>Save changes</button>
        </div>

        <div className={styles.screenPad}>
          <div className={styles.profGrid}>
            <div className={styles.profCard}>
              <div className={styles.profAvatar}>{driverInitials}</div>
              <div className={styles.profName}>{name}</div>
              <div className={styles.profBadge}>★ Gold member · since 2023</div>
              <div className={styles.profStats}>
                <div><div className={styles.profStatVal}>6.4</div><div className={styles.profStatLbl}>Hrs online</div></div>
                <div><div className={styles.profStatVal}>82km</div><div className={styles.profStatLbl}>Distance</div></div>
                <div><div className={styles.profStatVal}>12</div><div className={styles.profStatLbl}>Trips</div></div>
              </div>
            </div>

            <div>
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Personal info</h4>
                {[
                  { label: 'Phone',          value: phone },
                  { label: 'Email',          value: email },
                  { label: 'Driver license', value: 'DL-93021 · expires 2029-04' },
                  { label: 'Rating',         value: '★ 4.92' },
                ].map(f => (
                  <div key={f.label} className={styles.field}>
                    <div className={styles.fieldLabel}>{f.label}</div>
                    <div className={styles.fieldValue}>{f.value}</div>
                  </div>
                ))}
              </div>

              <div className={styles.detailCard} style={{ marginTop: 16 }}>
                <h4 className={styles.detailCardTitle}>Vehicle management</h4>
                <div className={`${styles.vehCard} ${styles.vehCardActive}`}>
                  <div className={styles.vehIcon}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 13l2-6h14l2 6"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M3 13h18v4H3z"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>Maruti Swift</div>
                    <div className={styles.mono} style={{ fontSize: 12, color: 'var(--ink-500)' }}>DL-01-AB-1234 · White · 2021</div>
                  </div>
                  <span className={styles.chip}>Active</span>
                </div>
                <button className={styles.btnGhostSm} style={{ marginTop: 14 }}>+ Add a new vehicle</button>
              </div>

              <button
                className={styles.logoutBtn}
                onClick={handleLogout}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  /* ── Main render ─────────────────────────────────────────────── */
  return (
    <div className={styles.app}>

      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.brandRow}>
          <div className={styles.brandMark}>V</div>
          <div className={styles.brandName}>Volt<span>·driver</span></div>
        </div>

        <div className={styles.driverCard}>
          <div className={styles.driverAvatar}>{driverInitials}</div>
          <div>
            <div className={styles.driverName}>{driver?.display_name || 'Demo Driver'}</div>
            <div className={styles.driverMeta}>★ 4.92 · {driver?.id ? `ID #VD-${driver.id.slice(-4).toUpperCase()}` : 'ID #VD-DEMO'}</div>
          </div>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navSection}>Driving</div>
          {['dashboard', 'earnings', 'history', 'messages'].map(id => {
            const Icon = NAV_ICONS[id]
            return (
              <button
                key={id}
                className={`${styles.navItem} ${activeScreen === id ? styles.navItemActive : ''}`}
                onClick={() => setActiveScreen(id)}
              >
                <Icon />
                {NAV_LABELS[id]}
                {id === 'messages' && <span className={styles.navBadge}>3</span>}
              </button>
            )
          })}
          <div className={styles.navSection}>Account</div>
          <button
            className={`${styles.navItem} ${activeScreen === 'profile' ? styles.navItemActive : ''}`}
            onClick={() => setActiveScreen('profile')}
          >
            <IconProfile />
            {NAV_LABELS['profile']}
          </button>
        </nav>

        <div className={styles.sidebarFoot}>
          <div className={styles.earnMini}>
            <div className={styles.earnMiniLabel}>Today · Earnings</div>
            <div className={styles.earnMiniValue}>₹1,875</div>
            <div className={styles.earnMiniSub}>▲ 18% vs avg</div>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className={styles.main}>

        {/* Mobile topbar */}
        <div className={styles.mobileTopbar}>
          <div className={styles.brandMark}>V</div>
          <h1 className={styles.mobileTopbarTitle}>{SCREEN_TITLES[activeScreen]}</h1>
          <div style={{ flex: 1 }} />
          <div className={`${styles.onlineDot} ${isOnline ? styles.onlineDotActive : ''}`} />
          <button className={styles.mobileAvatarBtn} onClick={handleLogout}>{driverInitials}</button>
        </div>

        {/* ── Dashboard screen ── */}
        <section className={`${styles.screen} ${activeScreen === 'dashboard' ? styles.screenActive : ''}`}>
          <div className={styles.screenTopbar}>
            <div>
              <h1 className={styles.topbarTitle}>{getGreeting()}, {driver?.display_name?.split(' ')[0] || 'Driver'}</h1>
              <div className={styles.topbarCrumb}>
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · Downtown zone
              </div>
            </div>
            <div className={styles.topbarSpacer} />
            <button
              className={`${styles.statusToggle} ${isOnline ? styles.statusToggleOnline : ''}`}
              onClick={isOnline ? handleGoOffline : handleGoOnline}
              disabled={actionLoading}
            >
              <span className={styles.statusDot} />
              <span>{isOnline ? 'Online' : 'Offline'}</span>
              <div className={styles.togglePill} />
            </button>
            <button className={styles.iconBtn} onClick={handleLogout}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>

          <div className={styles.dash}>
            {/* Map column */}
            <div className={styles.mapColumn}>
              <div className={styles.mapCard}>
                <div ref={mapContainerRef} className={styles.mapContainer} />

                {/* Alert bar */}
                <div className={`${styles.alertBar} ${!isOnline ? styles.alertBarWarn : ''}`}>
                  <span className={`${styles.alertDot} ${!isOnline ? styles.alertDotWarn : ''}`} />
                  <div>
                    <div className={styles.alertTitle}>
                      {isOnline ? "You're online — high demand nearby" : "You are offline"}
                    </div>
                  </div>
                  <span className={styles.alertSub}>
                    {isOnline ? '3 requests · 800m radius' : 'Go online to start accepting jobs'}
                  </span>
                </div>

                {/* ETA card when ride is active and in progress */}
                {activeRide && activeRide.status === 'in_progress' && (
                  <div className={styles.etaCard}>
                    <div>
                      <div className={styles.etaNum}>~8</div>
                      <div className={styles.etaUnit}>min</div>
                    </div>
                    <div className={styles.etaSep} />
                    <div>
                      <div className={styles.etaLabel}>Distance</div>
                      <div className={styles.etaValue}>{activeRide.distance_km || '—'} km</div>
                    </div>
                    <div className={styles.etaSep} />
                    <div>
                      <div className={styles.etaLabel}>Fare</div>
                      <div className={styles.etaValue}>₹{activeRide.estimated_price}</div>
                    </div>
                  </div>
                )}

                {/* User location dot is inserted by MapLibre via ref */}
              </div>

              {/* Stats row */}
              <div className={styles.statsRow}>
                {[
                  { label: 'Today',      value: '₹1,875', sub: '▲ 18% vs avg', variant: 'green' },
                  { label: 'Hrs online', value: '6.4',    sub: '2.6 hrs to bonus', variant: '' },
                  { label: 'Distance',   value: '82 km',  sub: '12 trips done', variant: '' },
                  { label: 'Acceptance', value: '96%',    sub: '★ 4.92 rating', variant: 'dark' },
                ].map(s => (
                  <div
                    key={s.label}
                    className={`${styles.statCard} ${s.variant === 'green' ? styles.statGreen : s.variant === 'dark' ? styles.statDark : ''}`}
                  >
                    <div className={styles.statLabel}>{s.label}</div>
                    <div className={styles.statValue}>{s.value}</div>
                    <div className={styles.statSub}>{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Requests / ride management panel */}
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <h3 className={styles.panelHeadTitle}>
                  {driverState === DRIVER_STATES.offline   ? 'Status'
                   : driverState === DRIVER_STATES.online  ? 'Searching…'
                   : driverState === DRIVER_STATES.ride_incoming ? 'New request'
                   : driverState === DRIVER_STATES.ride_active ? 'Active ride'
                   : 'Ride complete'}
                </h3>
                <span className={`${styles.statusPill} ${isOnline ? styles.statusPillOnline : ''}`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className={styles.panelBody}>
                <AnimatePresence mode="wait">
                  {renderPanelBody()}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>

        {/* Secondary screens */}
        {renderEarnings()}
        {renderHistory()}
        {renderMessages()}
        {renderProfile()}
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className={styles.mobileNav}>
        {SCREENS.map(id => {
          const Icon = NAV_ICONS[id]
          return (
            <button
              key={id}
              className={`${styles.mobTab} ${activeScreen === id ? styles.mobTabActive : ''} ${id === 'dashboard' ? styles.mobTabCenter : ''}`}
              onClick={() => setActiveScreen(id)}
            >
              <Icon />
              {id !== 'dashboard' && <span>{NAV_LABELS[id]}</span>}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
