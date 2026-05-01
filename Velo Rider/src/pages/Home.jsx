import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { motion, AnimatePresence } from 'framer-motion'
import useGeolocation from '../hooks/useGeolocation'
import useDriverPolling from '../hooks/useDriverPolling'
import useRideRoute from '../hooks/useRideRoute'
import LocationSearch from '../components/booking/LocationSearch'
import PaymentSheet from '../components/payment/PaymentSheet'
import useAuthStore from '../store/useAuthStore'
import api from '../services/api'
import { drawRouteOnMap, clearRouteOnMap } from '../utils/mapRoute'
import styles from './Home.module.css'

const MAP_STYLE = import.meta.env.VITE_MAPCN_STYLE_URL || 'https://demotiles.maplibre.org/style.json'

const RIDE_STATES = {
  idle: 'idle',
  selecting: 'selecting',
  confirming: 'confirming',
  searching: 'searching',
  driver_assigned: 'driver_assigned',
  completed: 'completed',
}

const ACTIVE_BACKEND_STATUSES = [
  'searching', 'driver_assigned', 'driver_arriving', 'otp_verified', 'in_progress',
]

export default function Home() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { location: userLocation } = useGeolocation()

  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const userMarkerRef = useRef(null)
  const driverMarkerRef = useRef(null)

  const [pickup, setPickup] = useState(null)
  const [destination, setDestination] = useState(null)
  const [estimate, setEstimate] = useState(null)
  const [rideState, setRideState] = useState(RIDE_STATES.idle)
  const [activeRide, setActiveRide] = useState(null)
  const [requesting, setRequesting] = useState(false)
  const [error, setError] = useState('')

  const driverLocation = useDriverPolling(
    activeRide?.id,
    rideState === RIDE_STATES.driver_assigned
  )

  const routeRideId = rideState === RIDE_STATES.driver_assigned ? activeRide?.id : null
  const routeGeometry = useRideRoute(routeRideId)

  // Init map
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return

    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [77.209, 28.6139], // Default: New Delhi
      zoom: 13,
    })

    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right')
    mapRef.current.addControl(
      new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }),
      'top-right'
    )

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Fly to user location when available
  useEffect(() => {
    if (!userLocation || !mapRef.current) return

    mapRef.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 14 })

    if (userMarkerRef.current) userMarkerRef.current.remove()
    const el = document.createElement('div')
    el.className = styles.userDot
    userMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(mapRef.current)

    if (!pickup) {
      setPickup({ lat: userLocation.lat, lng: userLocation.lng, display_name: 'Current location' })
    }
  }, [userLocation])

  // Update driver marker
  useEffect(() => {
    if (!driverLocation || !mapRef.current) return
    if (driverMarkerRef.current) driverMarkerRef.current.remove()
    const el = document.createElement('div')
    el.className = styles.driverMarker
    el.innerHTML = '🚗'
    driverMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([driverLocation.lng, driverLocation.lat])
      .addTo(mapRef.current)
  }, [driverLocation])

  // Draw / clear the pickup→destination route
  useEffect(() => {
    if (!mapRef.current) return
    if (routeGeometry) drawRouteOnMap(mapRef.current, routeGeometry)
    else clearRouteOnMap(mapRef.current)
  }, [routeGeometry])

  // Fetch estimate when both points are set
  useEffect(() => {
    if (!pickup || !destination) return
    setEstimate(null)

    api.post('/rides/estimate-price/', {
      pickup_lat: pickup.lat, pickup_lng: pickup.lng,
      destination_lat: destination.lat, destination_lng: destination.lng,
    })
      .then(({ data }) => {
        setEstimate(data)
        setRideState(RIDE_STATES.confirming)
      })
      .catch(() => setError('Could not fetch price estimate.'))
  }, [pickup, destination])

  // Poll active ride status — keeps running from search → assignment → completion.
  useEffect(() => {
    if (!activeRide) return
    if (!ACTIVE_BACKEND_STATUSES.includes(activeRide.status)) return

    const poll = setInterval(async () => {
      try {
        const { data } = await api.get(`/rides/${activeRide.id}/`)
        setActiveRide(data)
        if (['driver_assigned', 'driver_arriving', 'otp_verified', 'in_progress'].includes(data.status)) {
          setRideState(RIDE_STATES.driver_assigned)
        } else if (data.status === 'completed') {
          setRideState(RIDE_STATES.completed)
          clearInterval(poll)
        } else if (data.status === 'cancelled') {
          setRideState(RIDE_STATES.idle)
          setActiveRide(null)
          setError('Ride was cancelled. Try again.')
          clearInterval(poll)
        }
      } catch { /* keep polling */ }
    }, 3000)

    return () => clearInterval(poll)
  }, [activeRide?.id, activeRide?.status])

  const handlePaymentComplete = useCallback(() => {
    // Give the user a beat to see the receipt, then reset to booking.
    setTimeout(() => {
      setActiveRide(null)
      setRideState(RIDE_STATES.idle)
      setDestination(null)
      setEstimate(null)
      clearRouteOnMap(mapRef.current)
    }, 2500)
  }, [])

  const handleRequestRide = async () => {
    if (!pickup || !destination) return
    setRequesting(true)
    setError('')
    try {
      const { data } = await api.post('/rides/request/', {
        pickup_lat: pickup.lat, pickup_lng: pickup.lng,
        pickup_address: pickup.display_name,
        destination_lat: destination.lat, destination_lng: destination.lng,
        destination_address: destination.display_name,
      })
      setActiveRide(data)
      setRideState(RIDE_STATES.searching)
    } catch (err) {
      setError(err.message || 'Failed to request ride.')
    } finally {
      setRequesting(false)
    }
  }

  const handleCancelRide = async () => {
    if (!activeRide) return
    try {
      await api.post(`/rides/${activeRide.id}/cancel/`)
    } catch { /* ignore */ }
    setActiveRide(null)
    setRideState(RIDE_STATES.idle)
    setDestination(null)
    setEstimate(null)
  }

  const handleDestinationSelect = (place) => {
    setDestination(place)
    if (place && mapRef.current) {
      mapRef.current.flyTo({ center: [place.lng, place.lat], zoom: 13 })
    }
  }

  return (
    <div className={styles.page}>
      {/* Map fills the full screen */}
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
        </div>
        <div className={styles.topActions}>
          <button
            type="button"
            className={styles.walletBtn}
            onClick={() => navigate('/wallet')}
            aria-label="Wallet"
          >
            ₹
          </button>
          <button className={styles.avatarBtn} onClick={() => logout().then(() => navigate('/login'))}>
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </button>
        </div>
      </div>

      {/* Bottom Sheet */}
      <AnimatePresence mode="wait">
        {rideState === RIDE_STATES.completed ? (
          <motion.div
            key="completed"
            className={styles.sheet}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className={styles.sheetHandle} />
            <PaymentSheet
              ride={activeRide}
              user={user}
              onPaid={handlePaymentComplete}
            />
          </motion.div>
        ) : rideState === RIDE_STATES.searching ? (
          <motion.div
            key="searching"
            className={styles.sheet}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className={styles.searchingPulse}>
              <div className={styles.pulseRing} />
              <div className={styles.pulseRing} style={{ animationDelay: '0.3s' }} />
              <div className={styles.pulseRing} style={{ animationDelay: '0.6s' }} />
              <svg width="28" height="28" viewBox="0 0 22 22" fill="none">
                <g stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="2" y1="4" x2="2" y2="18" /><line x1="6" y1="2" x2="6" y2="20" />
                  <line x1="10" y1="5" x2="10" y2="17" /><line x1="14" y1="3" x2="14" y2="19" />
                  <line x1="18" y1="6" x2="18" y2="16" />
                </g>
              </svg>
            </div>
            <h3 className={styles.searchingTitle}>Finding your driver…</h3>
            <p className={styles.searchingSubtitle}>
              {destination?.display_name && `To ${destination.display_name.split(',')[0]}`}
            </p>
            <button className={styles.cancelBtn} onClick={handleCancelRide}>Cancel ride</button>
          </motion.div>
        ) : rideState === RIDE_STATES.driver_assigned ? (
          <motion.div
            key="assigned"
            className={styles.sheet}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className={styles.driverInfo}>
              <div className={styles.driverAvatar}>
                {activeRide?.driver_name?.[0]?.toUpperCase() || 'D'}
              </div>
              <div>
                <p className={styles.driverName}>{activeRide?.driver_name || 'Your Driver'}</p>
                <p className={styles.driverMeta}>
                  ★ {activeRide?.driver_avg_rating || '5.0'} · {activeRide?.vehicle_info?.make} {activeRide?.vehicle_info?.model}
                </p>
              </div>
              <div className={styles.otpBadge}>
                <span className={styles.otpLabel}>OTP</span>
                <span className={styles.otpValue}>
                  {activeRide?.otp_code || '— — — —'}
                </span>
              </div>
            </div>
            <div className={styles.routeRow}>
              <div className={styles.routeDot} style={{ background: 'var(--accent)' }} />
              <span className={styles.routeAddr}>{pickup?.display_name?.split(',')[0]}</span>
            </div>
            <div className={styles.routeRow}>
              <div className={styles.routeDot} style={{ background: 'var(--ink)' }} />
              <span className={styles.routeAddr}>{destination?.display_name?.split(',')[0]}</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="booking"
            className={styles.sheet}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className={styles.sheetHandle} />
            <h3 className={styles.sheetTitle}>Where to?</h3>

            <div className={styles.locations}>
              <LocationSearch
                placeholder="Pickup location"
                value={pickup}
                onSelect={setPickup}
                icon={<span style={{ color: 'var(--accent)', fontSize: 10 }}>●</span>}
              />
              <div className={styles.locationDivider} />
              <LocationSearch
                placeholder="Where are you going?"
                value={destination}
                onSelect={handleDestinationSelect}
                icon={<span style={{ color: 'var(--ink)', fontSize: 10 }}>■</span>}
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <AnimatePresence>
              {estimate && destination && (
                <motion.div
                  className={styles.fareCard}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                >
                  <div className={styles.fareRow}>
                    <div>
                      <p className={styles.fareLabel}>EV Ride</p>
                      <p className={styles.fareMeta}>
                        {estimate.breakdown?.distance_km} km · ~{Math.round(estimate.breakdown?.duration_minutes)} min
                      </p>
                    </div>
                    <div className={styles.fareAmount}>
                      <span className={styles.fareCurrency}>₹</span>
                      {estimate.estimated_price}
                    </div>
                  </div>
                  <div className={styles.fareBreakdown}>
                    <span>Base ₹{estimate.breakdown?.base_fare}</span>
                    <span>Distance ₹{estimate.breakdown?.distance_charge}</span>
                    <span>Time ₹{estimate.breakdown?.time_charge}</span>
                  </div>
                  <button
                    className={styles.bookBtn}
                    onClick={handleRequestRide}
                    disabled={requesting}
                  >
                    {requesting ? 'Requesting…' : `Book EV Ride · ₹${estimate.estimated_price}`}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
