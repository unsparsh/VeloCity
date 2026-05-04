import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import useRideStore from '../store/useRideStore'
import useAuthStore from '../store/useAuthStore'
import useDriverPolling from '../hooks/useDriverPolling'
import useRideRoute from '../hooks/useRideRoute'
import PaymentSheet from '../components/payment/PaymentSheet'
import api from '../services/api'
import styles from './BookRide.module.css'

const MAP_STYLE  = import.meta.env.VITE_MAPCN_STYLE_URL || 'https://demotiles.maplibre.org/style.json'
const POLL_MS    = 3000
const ACTIVE_STATUSES = ['requested', 'searching', 'driver_assigned', 'in_progress']

export default function BookRide() {
  const navigate = useNavigate()
  const { pickup, destination, estimate, clearRide } = useRideStore()
  const { user } = useAuthStore()

  const mapContainerRef = useRef(null)
  const mapRef          = useRef(null)
  const driverMarkerRef = useRef(null)
  const pickupMarkerRef = useRef(null)
  const destMarkerRef   = useRef(null)
  const pollRef         = useRef(null)

  const [ride, setRide]           = useState(null)
  const [rideState, setRideState] = useState('requesting') // requesting | searching | driver_assigned | in_progress | completed | cancelled | error
  const [error, setError]         = useState('')
  const [cancelling, setCancelling] = useState(false)

  // Redirect back if no booking context
  useEffect(() => {
    if (!pickup || !destination) navigate('/choose-location')
  }, [pickup, destination, navigate])

  // ── Request ride on mount ──────────────────────────────────
  useEffect(() => {
    if (!pickup || !destination) return
    let cancelled = false

    api.post('/rides/request/', {
      pickup_lat:      pickup.lat,
      pickup_lng:      pickup.lng,
      pickup_address:  pickup.display_name,
      dest_lat:        destination.lat,
      dest_lng:        destination.lng,
      dest_address:    destination.display_name,
    })
      .then(({ data }) => {
        if (cancelled) return
        setRide(data)
        setRideState('searching')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message || 'Could not request ride')
        setRideState('error')
      })

    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poll ride status ───────────────────────────────────────
  useEffect(() => {
    if (!ride?.id || !ACTIVE_STATUSES.includes(rideState)) return

    const poll = async () => {
      try {
        const { data } = await api.get(`/rides/${ride.id}/`)
        setRide(data)
        if (data.status === 'driver_assigned') setRideState('driver_assigned')
        else if (data.status === 'in_progress') setRideState('in_progress')
        else if (data.status === 'completed')   setRideState('completed')
        else if (data.status === 'cancelled')   setRideState('cancelled')
      } catch {
        // Keep polling on transient errors
      }
    }

    poll()
    pollRef.current = setInterval(poll, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [ride?.id, rideState])

  // Hooks for driver location + route geometry
  const driverLocation = useDriverPolling(
    ride?.id,
    rideState === 'driver_assigned' || rideState === 'in_progress',
  )
  const routeGeometry = useRideRoute(
    rideState === 'driver_assigned' || rideState === 'in_progress' ? ride?.id : null,
  )

  // ── Initialise map ─────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    if (!pickup) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [pickup.lng, pickup.lat],
      zoom: 14,
    })
    mapRef.current = map

    map.on('load', () => {
      // Pickup marker (green dot)
      const pickupEl = document.createElement('div')
      pickupEl.className = styles.markerPickup
      pickupMarkerRef.current = new maplibregl.Marker({ element: pickupEl })
        .setLngLat([pickup.lng, pickup.lat])
        .addTo(map)

      // Destination marker (dark square)
      const destEl = document.createElement('div')
      destEl.className = styles.markerDest
      destMarkerRef.current = new maplibregl.Marker({ element: destEl })
        .setLngLat([destination.lng, destination.lat])
        .addTo(map)

      // Fit bounds to show both markers
      const bounds = new maplibregl.LngLatBounds(
        [pickup.lng, pickup.lat],
        [destination.lng, destination.lat],
      )
      map.fitBounds(bounds, { padding: 80, maxZoom: 15 })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update driver marker ───────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !driverLocation?.lat || !driverLocation?.lng) return

    if (!driverMarkerRef.current) {
      const el = document.createElement('div')
      el.className = styles.markerDriver
      el.textContent = '🚗'
      driverMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([driverLocation.lng, driverLocation.lat])
        .addTo(map)
    } else {
      driverMarkerRef.current.setLngLat([driverLocation.lng, driverLocation.lat])
    }
  }, [driverLocation])

  // ── Draw route on map ──────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !routeGeometry) return

    const tryDraw = () => {
      if (!map.isStyleLoaded()) { setTimeout(tryDraw, 200); return }

      if (map.getSource('route')) {
        map.getSource('route').setData({ type: 'Feature', geometry: routeGeometry })
      } else {
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', geometry: routeGeometry },
        })
        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#18A558', 'line-width': 3, 'line-opacity': 0.85 },
        })
      }
    }
    tryDraw()
  }, [routeGeometry])

  // ── Cancel ride ────────────────────────────────────────────
  const handleCancel = useCallback(async () => {
    if (!ride?.id || cancelling) return
    setCancelling(true)
    try {
      await api.post(`/rides/${ride.id}/cancel/`)
      clearInterval(pollRef.current)
      setRideState('cancelled')
    } catch (err) {
      setError(err.message || 'Could not cancel ride')
    } finally {
      setCancelling(false)
    }
  }, [ride?.id, cancelling])

  // ── Payment complete ───────────────────────────────────────
  const handlePaid = useCallback(() => {
    clearRide()
    setTimeout(() => navigate('/'), 2500)
  }, [clearRide, navigate])

  // ── Derived display values ─────────────────────────────────
  const etaMin = ride?.eta_minutes ?? ride?.driver?.eta_minutes ?? null
  const distKm = estimate?.distance_km
    ? Number(estimate.distance_km).toFixed(1)
    : ride?.distance_km
    ? Number(ride.distance_km).toFixed(1)
    : null
  const fare = ride?.final_price ?? ride?.estimated_price ?? estimate?.fare ?? estimate?.estimated_fare ?? null

  const statusLabel = {
    requesting:      'Requesting your ride…',
    searching:       'Finding your driver…',
    driver_assigned: 'Driver assigned · On the way',
    in_progress:     'En route · 0 CO₂ emissions',
    completed:       'Arrived · Thank you for riding Velocity',
    cancelled:       'Ride cancelled',
    error:           'Something went wrong',
  }[rideState] || ''

  return (
    <div className={styles.page}>

      {/* ── Left sidebar ── */}
      <aside className={styles.sidebar}>

        {/* Brand header */}
        <div className={styles.sideHeader}>
          <button className={styles.backBtn}
            onClick={() => { clearRide(); navigate('/') }}
            aria-label="Back to home"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13L5 8l5-5" />
            </svg>
          </button>
          <div className={styles.sideBrand}>
            <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
              <g stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
                <line x1="2"  y1="4"  x2="2"  y2="18" />
                <line x1="6"  y1="2"  x2="6"  y2="20" />
                <line x1="10" y1="5"  x2="10" y2="17" />
                <line x1="14" y1="3"  x2="14" y2="19" />
                <line x1="18" y1="6"  x2="18" y2="16" />
              </g>
            </svg>
            <span>Velocity</span>
          </div>
        </div>

        {/* ── Requesting spinner ── */}
        {rideState === 'requesting' && (
          <div className={styles.spinnerSection}>
            <div className={styles.spinner} />
            <p className={styles.spinnerText}>Requesting your ride…</p>
          </div>
        )}

        {/* ── Error state ── */}
        {rideState === 'error' && (
          <div className={styles.errorSection}>
            <p className={styles.errorMsg}>{error}</p>
            <button className={styles.retryBtn}
              onClick={() => navigate('/choose-location')}>
              Try again
            </button>
          </div>
        )}

        {/* ── Cancelled state ── */}
        {rideState === 'cancelled' && (
          <div className={styles.cancelledSection}>
            <div className={styles.cancelledIcon}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="var(--ink)" strokeWidth="1.6">
                <circle cx="14" cy="14" r="12" />
                <path d="M9 9l10 10M19 9L9 19" strokeLinecap="round" />
              </svg>
            </div>
            <p className={styles.cancelledTitle}>Ride cancelled</p>
            <button className={styles.retryBtn} onClick={() => { clearRide(); navigate('/') }}>
              Back to home
            </button>
          </div>
        )}

        {/* ── Active ride cards ── */}
        {(rideState === 'searching' || rideState === 'driver_assigned' || rideState === 'in_progress') && (
          <>
            {/* Status card */}
            <div className={styles.statusCard}>
              <div className={styles.statusRow}>
                <span className={styles.statusDot} />
                <span className={styles.statusText}>{statusLabel}</span>
              </div>
              {rideState === 'searching' && (
                <div className={styles.searchPulse}>
                  <div className={styles.pulseRing} style={{ animationDelay: '0s' }} />
                  <div className={styles.pulseRing} style={{ animationDelay: '0.6s' }} />
                  <div className={styles.pulseRing} style={{ animationDelay: '1.2s' }} />
                  <div className={styles.pulseCore} />
                </div>
              )}
              {(rideState === 'driver_assigned' || rideState === 'in_progress') && etaMin && (
                <div className={styles.etaRow}>
                  <span className={styles.etaVal}>{etaMin}</span>
                  <span className={styles.etaUnit}>min</span>
                  <span className={styles.etaLabel}>ETA</span>
                </div>
              )}
            </div>

            {/* Driver card (when assigned) */}
            {(rideState === 'driver_assigned' || rideState === 'in_progress') && ride?.driver && (
              <div className={styles.driverCard}>
                <div className={styles.driverAvatar}>
                  {ride.driver.name?.[0]?.toUpperCase() || 'D'}
                </div>
                <div className={styles.driverInfo}>
                  <div className={styles.driverName}>{ride.driver.name || 'Your Driver'}</div>
                  <div className={styles.driverMeta}>
                    {ride.driver.vehicle_model || 'EV'} · {ride.driver.vehicle_number || '—'}
                  </div>
                  {ride.driver.rating && (
                    <div className={styles.driverRating}>★ {Number(ride.driver.rating).toFixed(1)}</div>
                  )}
                </div>
                {ride.otp && (
                  <div className={styles.otpBadge}>
                    <span className={styles.otpLabel}>OTP</span>
                    <span className={styles.otpValue}>{ride.otp}</span>
                  </div>
                )}
              </div>
            )}

            {/* Trip meta */}
            <div className={styles.tripCard}>
              <div className={styles.tripRow}>
                <span className={styles.tripDot} style={{ background: 'var(--accent)' }} />
                <span className={styles.tripAddr}>{pickup?.display_name || 'Pickup'}</span>
              </div>
              <div className={styles.tripLine} />
              <div className={styles.tripRow}>
                <span className={styles.tripDot} style={{ background: 'var(--ink)' }} />
                <span className={styles.tripAddr}>{destination?.display_name || 'Destination'}</span>
              </div>
              {(distKm || fare) && (
                <div className={styles.tripMeta}>
                  {distKm && <span>{distKm} km</span>}
                  {fare && <span>₹{Number(fare).toFixed(0)} est.</span>}
                  <span>0g CO₂</span>
                </div>
              )}
            </div>

            {/* Cancel button */}
            {rideState !== 'in_progress' && (
              <button
                className={styles.cancelBtn}
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling…' : 'Cancel ride'}
              </button>
            )}
          </>
        )}

        {/* ── Completed: payment ── */}
        {rideState === 'completed' && (
          <div className={styles.paymentSection}>
            <div className={styles.arrivedBadge}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--accent)" strokeWidth="1.8">
                <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Arrived
            </div>
            <PaymentSheet ride={ride} user={user} onPaid={handlePaid} />
          </div>
        )}
      </aside>

      {/* ── Map ── */}
      <div className={styles.mapWrap}>
        <div ref={mapContainerRef} className={styles.map} />

        {/* Floating status pill on map */}
        {rideState !== 'completed' && rideState !== 'cancelled' && rideState !== 'error' && (
          <div className={styles.mapPill}>
            <span className={styles.mapPillDot} />
            {statusLabel}
          </div>
        )}
      </div>
    </div>
  )
}
