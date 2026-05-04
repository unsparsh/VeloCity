import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import LocationSearch from '../components/booking/LocationSearch'
import MapPicker from '../components/map/MapPicker'
import useGeolocation from '../hooks/useGeolocation'
import useRideStore from '../store/useRideStore'
import api from '../services/api'
import styles from './ChooseLocation.module.css'

const MOBILE_BREAKPOINT = 768

export default function ChooseLocation() {
  const navigate = useNavigate()
  const { setPickup, setDestination, setEstimate } = useRideStore()
  const { location: geoLoc, loading: geoLoading } = useGeolocation()

  const [pickup, setPickupLocal]     = useState(null)
  const [destination, setDestLocal]  = useState(null)
  const [estimate, setEstimateLocal] = useState(null)
  const [estLoading, setEstLoading]  = useState(false)
  const [estError, setEstError]      = useState('')
  const [confirming, setConfirming]  = useState(false)
  const [mapPickerOpen, setMapPickerOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT
  )
  const [frequent, setFrequent] = useState([])
  const [frequentLoading, setFrequentLoading] = useState(true)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Fetch the user's frequent destinations from completed rides
  useEffect(() => {
    let cancelled = false
    api.get('/rides/frequent/')
      .then(({ data }) => { if (!cancelled) setFrequent(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setFrequent([]) })
      .finally(() => { if (!cancelled) setFrequentLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Auto-fill pickup from device location
  useEffect(() => {
    if (geoLoc && !pickup) {
      setPickupLocal({
        lat: geoLoc.lat,
        lng: geoLoc.lng,
        display_name: 'Current location',
      })
    }
  }, [geoLoc, pickup])

  const fetchEstimate = useCallback(async (from, to) => {
    if (!from || !to) return
    setEstLoading(true)
    setEstError('')
    try {
      const { data } = await api.get('/rides/estimate-price/', {
        params: {
          pickup_lat:       from.lat,
          pickup_lng:       from.lng,
          destination_lat:  to.lat,
          destination_lng:  to.lng,
        },
      })
      setEstimateLocal(data)
    } catch (err) {
      setEstError(err.message || 'Could not get estimate')
    } finally {
      setEstLoading(false)
    }
  }, [])

  useEffect(() => {
    if (pickup && destination) fetchEstimate(pickup, destination)
    else setEstimateLocal(null)
  }, [pickup, destination, fetchEstimate])

  const handleConfirm = async () => {
    if (!pickup || !destination || confirming) return
    setConfirming(true)
    setPickup(pickup)
    setDestination(destination)
    setEstimate(estimate)
    navigate('/book-ride')
  }

  const canConfirm = pickup && destination && !estLoading && !confirming

  return (
    <div className={styles.page}>

      {/* ── Left panel ── */}
      <div className={styles.panel}>

        {/* Header */}
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate('/')} aria-label="Back">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 14L6 9l5-5" />
            </svg>
          </button>
          <div className={styles.headerBrand}>
            <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
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

        {/* Title */}
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Where to?</h1>
          <p className={styles.sub}>Set your pickup and destination</p>
        </div>

        {/* Location inputs */}
        <div className={styles.inputsCard}>
          <div className={styles.inputRow}>
            <span className={styles.dot} style={{ background: 'var(--accent)' }} />
            <div className={styles.inputWrap}>
              <LocationSearch
                placeholder={geoLoading ? 'Getting your location…' : 'Pickup location'}
                value={pickup}
                onSelect={setPickupLocal}
                enableMapPick
                onPickOnMap={() => setMapPickerOpen(true)}
                icon={
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--accent)" strokeWidth="1.6">
                    <circle cx="7" cy="6" r="2.5" />
                    <path d="M7 1a5 5 0 0 1 0 10C4 11 2 8 7 1z" />
                  </svg>
                }
              />
            </div>
          </div>

          <div className={styles.connectorLine} />

          <div className={styles.inputRow}>
            <span className={styles.dot} style={{ background: 'var(--ink)' }} />
            <div className={styles.inputWrap}>
              <LocationSearch
                placeholder="Destination"
                value={destination}
                onSelect={setDestLocal}
                icon={
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--ink)" strokeWidth="1.6">
                    <rect x="4" y="3" width="6" height="8" rx="1" />
                    <rect x="6" y="7" width="2" height="4" />
                  </svg>
                }
              />
            </div>
          </div>
        </div>

        {/* Estimate card */}
        {(estLoading || estimate || estError) && (
          <div className={styles.estimateCard}>
            {estLoading && (
              <div className={styles.estLoading}>
                <span className={styles.estSpinner} />
                <span>Calculating fare…</span>
              </div>
            )}

            {!estLoading && estError && (
              <p className={styles.estError}>{estError}</p>
            )}

            {!estLoading && estimate && (
              <>
                <div className={styles.estRow}>
                  <div>
                    <div className={styles.estLabel}>Estimated fare</div>
                    <div className={styles.estMeta}>
                      {estimate.distance_km ? `${Number(estimate.distance_km).toFixed(1)} km` : ''}
                      {estimate.duration_min ? ` · ~${estimate.duration_min} min` : ''}
                    </div>
                  </div>
                  <div className={styles.estAmount}>
                    <span className={styles.estCur}>₹</span>
                    {estimate.fare ?? estimate.estimated_fare ?? '—'}
                  </div>
                </div>

                {(estimate.base_fare || estimate.per_km_rate) && (
                  <div className={styles.estBreakdown}>
                    {estimate.base_fare    && <span>Base ₹{estimate.base_fare}</span>}
                    {estimate.per_km_rate  && <span>₹{estimate.per_km_rate}/km</span>}
                    {estimate.surge_multiplier && estimate.surge_multiplier > 1 && (
                      <span className={styles.surge}>{estimate.surge_multiplier}× surge</span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Confirm button */}
        <button
          className={styles.confirmBtn}
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          {confirming ? 'Booking…' : 'Confirm ride'}
          {!confirming && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          )}
        </button>

        {/* Frequent destinations from completed rides */}
        {!destination && (
          <div className={styles.hints}>
            <div className={styles.hintsLabel}>Frequent places</div>

            {frequentLoading ? (
              <div className={styles.hintEmpty}>Loading…</div>
            ) : frequent.length === 0 ? (
              <div className={styles.hintEmpty}>
                Take a ride and your frequent destinations will appear here.
              </div>
            ) : (
              frequent.map((place) => (
                <button
                  key={place.display_name}
                  className={styles.hintItem}
                  onClick={() => setDestLocal({
                    lat: place.lat,
                    lng: place.lng,
                    display_name: place.display_name,
                  })}
                >
                  <span className={styles.hintIcon}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <circle cx="6" cy="5" r="2" />
                      <path d="M6 1a4 4 0 0 1 0 8C3 9 1.5 6.5 6 1z" />
                    </svg>
                  </span>
                  <span className={styles.hintLabel}>{place.display_name}</span>
                  <span className={styles.hintCount}>{place.trip_count}×</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Right: live MapPicker (desktop) OR decorative SVG ── */}
      <div className={styles.mapSide}>
        {mapPickerOpen && !isMobile ? (
          <div className={styles.mapPickerInline}>
            <MapPicker
              initialCenter={pickup ? { lat: pickup.lat, lng: pickup.lng } : (geoLoc ? { lat: geoLoc.lat, lng: geoLoc.lng } : null)}
              onConfirm={(loc) => {
                setPickupLocal(loc)
                setMapPickerOpen(false)
              }}
              onCancel={() => setMapPickerOpen(false)}
            />
          </div>
        ) : (
        <>
        <svg viewBox="0 0 480 560" className={styles.mapSvg} aria-hidden="true">
          <defs>
            <pattern id="clGrid" patternUnits="userSpaceOnUse" width="40" height="23.09">
              <path d="M0 11.55 L20 0 L40 11.55 L20 23.1 Z"
                fill="none" stroke="var(--stroke)" strokeWidth="0.5" opacity="0.6" />
            </pattern>
          </defs>

          <rect width="480" height="560" fill="var(--bg)" />
          <rect width="480" height="560" fill="url(#clGrid)" opacity="0.8" />

          {/* Road network */}
          <g fill="#F3EEE7" stroke="var(--stroke-2)" strokeWidth="1.2">
            <path d="M 60 280 L 240 180 L 420 280 L 390 296 L 240 206 L 90 296 Z" />
            <path d="M 60 280 L 100 302 L 90 308 L 50 286 Z" fill="#EDE7DE" />
            <path d="M 420 280 L 460 258 L 450 252 L 410 274 Z" fill="#EDE7DE" />
          </g>

          {/* Route line */}
          <path
            d={pickup && destination
              ? "M 100 290 L 240 200 L 380 290"
              : "M 100 290 L 240 200"}
            fill="none"
            stroke={pickup && destination ? "var(--accent)" : "var(--stroke-2)"}
            strokeWidth="2"
            strokeDasharray={pickup && destination ? "none" : "4 4"}
            strokeLinecap="round"
          />

          {/* Buildings left */}
          <g stroke="var(--stroke-2)" strokeWidth="1" fill="#fff" strokeLinejoin="round">
            <g transform="translate(40,220)">
              <path d="M0 30 L30 14 L60 30 L30 46 Z" />
              <path d="M0 30 L0 80 L30 96 L30 46 Z" fill="#F6F1EA" />
              <path d="M60 30 L60 80 L30 96 L30 46 Z" fill="#EDE7DE" />
            </g>
            <g transform="translate(100,255)">
              <path d="M0 22 L22 10 L44 22 L22 34 Z" />
              <path d="M0 22 L0 54 L22 66 L22 34 Z" fill="#F6F1EA" />
              <path d="M44 22 L44 54 L22 66 L22 34 Z" fill="#EDE7DE" />
            </g>
          </g>

          {/* Buildings right (accent) */}
          <g stroke="var(--accent)" strokeWidth="1" fill="#fff" strokeLinejoin="round">
            <g transform="translate(370,190)">
              <path d="M0 36 L28 20 L56 36 L28 52 Z" />
              <path d="M0 36 L0 110 L28 126 L28 52 Z" fill="var(--accent-soft)" />
              <path d="M56 36 L56 110 L28 126 L28 52 Z" fill="var(--accent-soft)" />
              <line x1="28" y1="20" x2="28" y2="4" />
              <circle cx="28" cy="2" r="2" fill="var(--accent)" />
            </g>
          </g>

          {/* Pickup pin */}
          <g transform="translate(100,290)" opacity={pickup ? 1 : 0.35}>
            <ellipse cx="0" cy="4" rx="12" ry="4" fill="var(--accent)" opacity="0.2" />
            <g transform="translate(0,-36)">
              <path d="M0 0 C-10 0 -10 -14 0 -22 C10 -14 10 0 0 0 Z"
                fill="#fff" stroke="var(--accent)" strokeWidth="1.4" />
              <circle cx="0" cy="-14" r="3.5" fill="var(--accent)" />
            </g>
          </g>

          {/* Destination pin */}
          <g transform="translate(380,290)" opacity={destination ? 1 : 0.3}>
            <g transform="translate(0,-36)">
              <path d="M0 0 C-10 0 -10 -14 0 -22 C10 -14 10 0 0 0 Z"
                fill="#fff" stroke="var(--ink)" strokeWidth="1.2" />
              <rect x="-3" y="-20" width="6" height="6" fill="var(--ink)" />
            </g>
          </g>

          {/* Car icon */}
          {pickup && (
            <image href="/car.png" x="215" y="180" width="56" height="28"
              preserveAspectRatio="xMidYMid meet" />
          )}

          {/* Labels */}
          <g fontFamily="Geist Mono, monospace" fontSize="8.5" fill="var(--ink-2)" opacity="0.8">
            <g transform="translate(30,338)">
              <rect x="-3" y="-10" width="82" height="16" fill="var(--bg)" stroke="var(--stroke)" />
              <text x="2" y="0" letterSpacing="0.8">PICKUP · NOW</text>
            </g>
            <g transform="translate(320,260)">
              <rect x="-3" y="-10" width="110" height="16" fill="var(--bg)" stroke="var(--accent)" />
              <text x="2" y="0" fill="var(--accent)" letterSpacing="0.8">DESTINATION</text>
            </g>
          </g>
        </svg>

        {/* Map overlay text */}
        <div className={styles.mapOverlay}>
          <div className={styles.mapBadge}>
            <span className={styles.mapBadgeDot} />
            {pickup && destination
              ? 'Route ready'
              : pickup
              ? 'Add destination'
              : 'Set pickup location'}
          </div>
        </div>
        </>
        )}
      </div>

      {/* Mobile: full-screen modal map picker */}
      {mapPickerOpen && isMobile && (
        <div className={styles.mapPickerModal} role="dialog" aria-modal="true">
          <MapPicker
            initialCenter={pickup ? { lat: pickup.lat, lng: pickup.lng } : (geoLoc ? { lat: geoLoc.lat, lng: geoLoc.lng } : null)}
            onConfirm={(loc) => {
              setPickupLocal(loc)
              setMapPickerOpen(false)
            }}
            onCancel={() => setMapPickerOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
