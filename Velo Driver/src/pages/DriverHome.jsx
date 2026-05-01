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

const STATES = {
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

export default function DriverHome() {
  const navigate = useNavigate()
  const { driver, logout } = useDriverStore()
  const { location: userLocation } = useGeolocation()

  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const userMarkerRef = useRef(null)

  const [driverState, setDriverState] = useState(STATES.offline)
  const [pendingRide, setPendingRide] = useState(null)
  const [activeRide, setActiveRide] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [otpInput, setOtpInput] = useState('')
  const [completedRide, setCompletedRide] = useState(null)
  const [paymentStatus, setPaymentStatus] = useState(null)

  const routeGeometry = useRideRoute(activeRide?.id)

  const isOnline = driverState !== STATES.offline
  useLocationBroadcast(isOnline)

  const handleRideFound = useCallback((ride) => {
    if (driverState === STATES.online) {
      setPendingRide(ride)
      setDriverState(STATES.ride_incoming)
    }
  }, [driverState])

  useRidePolling(driverState === STATES.online, handleRideFound)

  // Init map
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

  // Track user location dot
  useEffect(() => {
    if (!userLocation || !mapRef.current) return
    mapRef.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 14 })
    if (userMarkerRef.current) userMarkerRef.current.remove()
    const el = document.createElement('div')
    el.className = styles.userDot
    userMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(mapRef.current)
  }, [userLocation])

  // Poll payment status after ride completion
  useEffect(() => {
    if (driverState !== STATES.ride_completed || !completedRide) return
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

  // Draw / clear the pickup→destination route for the active ride
  useEffect(() => {
    if (!mapRef.current) return
    if (routeGeometry) drawRouteOnMap(mapRef.current, routeGeometry)
    else clearRouteOnMap(mapRef.current)
  }, [routeGeometry])

  const handleGoOnline = async () => {
    setError('')
    setActionLoading(true)
    try {
      await api.post('/location/go-online/')
      setDriverState(STATES.online)
    } catch {
      setError('Could not go online. Try again.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleGoOffline = async () => {
    setError('')
    setActionLoading(true)
    try {
      await api.post('/location/go-offline/')
      setDriverState(STATES.offline)
      setPendingRide(null)
      setActiveRide(null)
    } catch { /* best-effort */ } finally {
      setActionLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!pendingRide) return
    setActionLoading(true)
    setError('')
    try {
      const { data } = await api.post(`/rides/driver/${pendingRide.id}/accept/`)
      setActiveRide(data)
      setDriverState(STATES.ride_active)
      setPendingRide(null)
      if (mapRef.current && data.pickup_lng && data.pickup_lat) {
        mapRef.current.flyTo({ center: [data.pickup_lng, data.pickup_lat], zoom: 14 })
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not accept ride.')
      setDriverState(STATES.online)
      setPendingRide(null)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDismissCompleted = () => {
    setCompletedRide(null)
    setPaymentStatus(null)
    setDriverState(STATES.online)
  }

  const handleDecline = () => {
    setPendingRide(null)
    setDriverState(STATES.online)
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (!activeRide || otpInput.length !== 4) {
      setError('Enter the 4-digit OTP.')
      return
    }
    setActionLoading(true)
    setError('')
    try {
      const { data } = await api.post(
        `/rides/driver/${activeRide.id}/verify-otp/`,
        { otp: otpInput }
      )
      setActiveRide(data)
      setOtpInput('')
    } catch (err) {
      setError(err.response?.data?.error || 'OTP verification failed.')
    } finally {
      setActionLoading(false)
    }
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
        setDriverState(STATES.ride_completed)
      } else {
        setActiveRide(data)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Status update failed.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div ref={mapContainerRef} className={styles.mapContainer} />

      {/* Top bar */}
      <div className={styles.topBar}>
        <div className={styles.brand}>
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
            <g stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="4" x2="2" y2="18" /><line x1="6" y1="2" x2="6" y2="20" />
              <line x1="10" y1="5" x2="10" y2="17" /><line x1="14" y1="3" x2="14" y2="19" />
              <line x1="18" y1="6" x2="18" y2="16" />
            </g>
          </svg>
          <span className={`${styles.statusDot} ${isOnline ? styles.statusOnline : ''}`} />
        </div>
        <button
          className={styles.avatarBtn}
          onClick={() => logout().then(() => navigate('/login'))}
        >
          {driver?.full_name?.[0]?.toUpperCase() || 'D'}
        </button>
      </div>

      {/* Bottom sheet */}
      <AnimatePresence mode="wait">
        {driverState === STATES.offline && (
          <motion.div
            key="offline"
            className={styles.sheet}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className={styles.sheetHandle} />
            <div className={styles.offlineIcon}>🚗</div>
            <h3 className={styles.sheetTitle}>You're offline</h3>
            <p className={styles.sheetSubtitle}>Go online to start receiving ride requests</p>
            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.goOnlineBtn} onClick={handleGoOnline} disabled={actionLoading}>
              {actionLoading ? 'Going online…' : 'Go Online'}
            </button>
          </motion.div>
        )}

        {driverState === STATES.online && (
          <motion.div
            key="online"
            className={styles.sheet}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className={styles.sheetHandle} />
            <div className={styles.searchingPulse}>
              <div className={styles.pulseRing} />
              <div className={styles.pulseRing} style={{ animationDelay: '0.35s' }} />
              <div className={styles.pulseRing} style={{ animationDelay: '0.7s' }} />
              <span style={{ fontSize: 26 }}>🚗</span>
            </div>
            <h3 className={styles.sheetTitle}>Looking for rides…</h3>
            <p className={styles.sheetSubtitle}>You'll be notified when a ride is available nearby</p>
            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.offlineLink} onClick={handleGoOffline} disabled={actionLoading}>
              Go offline
            </button>
          </motion.div>
        )}

        {driverState === STATES.ride_incoming && pendingRide && (
          <motion.div
            key="incoming"
            className={styles.sheet}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <div className={styles.sheetHandle} />
            <div className={styles.incomingHeader}>
              <div>
                <h3 className={styles.sheetTitle} style={{ marginBottom: 4 }}>New ride request</h3>
                <p className={styles.sheetSubtitle} style={{ marginBottom: 0 }}>
                  {pendingRide.user_name || 'Passenger'} · {pendingRide.distance_km} km
                </p>
              </div>
              <div className={styles.fareTag}>
                <span className={styles.fareCurrency}>₹</span>
                <span className={styles.fareAmount}>{pendingRide.estimated_price}</span>
              </div>
            </div>

            <div className={styles.routeCard}>
              <div className={styles.routeRow}>
                <span className={styles.routeDot} style={{ background: 'var(--accent)' }} />
                <span className={styles.routeAddr}>{pendingRide.pickup_address?.split(',')[0]}</span>
              </div>
              <div className={styles.routeLine} />
              <div className={styles.routeRow}>
                <span className={styles.routeDot} style={{ background: 'var(--ink)' }} />
                <span className={styles.routeAddr}>{pendingRide.destination_address?.split(',')[0]}</span>
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actionRow}>
              <button className={styles.declineBtn} onClick={handleDecline} disabled={actionLoading}>
                Decline
              </button>
              <button className={styles.acceptBtn} onClick={handleAccept} disabled={actionLoading}>
                {actionLoading ? 'Accepting…' : 'Accept'}
              </button>
            </div>
          </motion.div>
        )}

        {driverState === STATES.ride_active && activeRide && (
          <motion.div
            key="active"
            className={styles.sheet}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className={styles.sheetHandle} />

            <div className={styles.passengerRow}>
              <div className={styles.passengerAvatar}>
                {activeRide.user_name?.[0]?.toUpperCase() || 'P'}
              </div>
              <div>
                <p className={styles.passengerName}>{activeRide.user_name || 'Passenger'}</p>
                <p className={styles.rideStatusLabel}>
                  {STATUS_LABELS[activeRide.status] || activeRide.status}
                </p>
              </div>
              <div className={styles.fareTag} style={{ marginLeft: 'auto' }}>
                <span className={styles.fareCurrency}>₹</span>
                <span className={styles.fareAmount}>{activeRide.estimated_price}</span>
              </div>
            </div>

            <div className={styles.routeCard}>
              <div className={styles.routeRow}>
                <span className={styles.routeDot} style={{ background: 'var(--accent)' }} />
                <span className={styles.routeAddr}>{activeRide.pickup_address?.split(',')[0]}</span>
              </div>
              <div className={styles.routeLine} />
              <div className={styles.routeRow}>
                <span className={styles.routeDot} style={{ background: 'var(--ink)' }} />
                <span className={styles.routeAddr}>{activeRide.destination_address?.split(',')[0]}</span>
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.statusActions}>
              {activeRide.status === 'driver_assigned' && (
                <button
                  className={styles.actionBtn}
                  onClick={() => handleStatusUpdate('driver_arriving')}
                  disabled={actionLoading}
                >
                  I've arrived at pickup
                </button>
              )}
              {activeRide.status === 'driver_arriving' && (
                <form className={styles.otpForm} onSubmit={handleVerifyOtp}>
                  <label className={styles.otpFormLabel}>
                    Ask passenger for the 4-digit OTP
                  </label>
                  <input
                    className={styles.otpFormInput}
                    type="text"
                    inputMode="numeric"
                    placeholder="· · · ·"
                    value={otpInput}
                    onChange={(e) =>
                      setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                    autoFocus
                  />
                  <button
                    className={styles.actionBtn}
                    type="submit"
                    disabled={actionLoading || otpInput.length !== 4}
                  >
                    {actionLoading ? 'Verifying…' : 'Verify OTP'}
                  </button>
                </form>
              )}
              {activeRide.status === 'otp_verified' && (
                <button
                  className={styles.actionBtn}
                  onClick={() => handleStatusUpdate('in_progress')}
                  disabled={actionLoading}
                >
                  Start ride
                </button>
              )}
              {activeRide.status === 'in_progress' && (
                <button
                  className={`${styles.actionBtn} ${styles.completeBtn}`}
                  onClick={() => handleStatusUpdate('completed')}
                  disabled={actionLoading}
                >
                  Complete ride
                </button>
              )}
            </div>
          </motion.div>
        )}
        {driverState === STATES.ride_completed && completedRide && (
          <motion.div
            key="completed"
            className={styles.sheet}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className={styles.sheetHandle} />

            <div className={styles.completedHeader}>
              <div className={styles.completedIcon}>✓</div>
              <h3 className={styles.sheetTitle}>Ride complete</h3>
              <p className={styles.sheetSubtitle}>{completedRide.user_name || 'Passenger'}</p>
            </div>

            <div className={styles.completedFareRow}>
              <span className={styles.completedLabel}>Fare</span>
              <span className={styles.completedFareAmount}>₹{completedRide.estimated_price}</span>
            </div>

            <div className={styles.paymentStatusRow}>
              <span className={styles.completedLabel}>Payment</span>
              <span className={`${styles.paymentBadge} ${
                paymentStatus === 'paid'   ? styles.paymentPaid :
                paymentStatus === 'unpaid' ? styles.paymentPending :
                styles.paymentChecking
              }`}>
                {paymentStatus === 'paid'   ? 'Paid' :
                 paymentStatus === 'unpaid' ? 'Awaiting payment' :
                 'Checking…'}
              </span>
            </div>

            <button
              className={styles.offlineLink}
              onClick={handleDismissCompleted}
              style={{ marginTop: 20 }}
            >
              Back to searching
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
