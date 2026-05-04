import { useState, useCallback, useEffect, useRef } from 'react'
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import styles from './MapPicker.module.css'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.2090 } // New Delhi fallback

/**
 * Interactive Google Map for picking an exact pickup point.
 * - Draggable centered pin (the map moves under a fixed pin in the center)
 * - Live reverse geocoding as the map idles
 * - "Use this location" confirms the selection
 *
 * Props:
 *   initialCenter: { lat, lng } | null    starting position
 *   onConfirm:     ({ lat, lng, display_name }) => void
 *   onCancel:      () => void
 */
export default function MapPicker({ initialCenter, onConfirm, onCancel }) {
  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY.includes('DUMMY')) {
    return (
      <div className={styles.errorPane}>
        <p className={styles.errorTitle}>Google Maps API key required</p>
        <p className={styles.errorMsg}>
          Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>.env</code> with a valid
          key (Maps JavaScript + Places + Geocoding APIs enabled).
        </p>
        <button className={styles.cancelBtn} onClick={onCancel}>Close</button>
      </div>
    )
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
      <PickerInner
        initialCenter={initialCenter || DEFAULT_CENTER}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </APIProvider>
  )
}

function PickerInner({ initialCenter, onConfirm, onCancel }) {
  const [center, setCenter] = useState(initialCenter)
  const [address, setAddress] = useState('')
  const [resolving, setResolving] = useState(false)

  return (
    <div className={styles.wrap}>
      <div className={styles.mapWrap}>
        <Map
          mapId="velo-pickup-map"
          defaultCenter={initialCenter}
          defaultZoom={16}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          className={styles.map}
        >
          <CenterTracker onCenterChange={setCenter} />
          <Geocoder center={center} setAddress={setAddress} setResolving={setResolving} />
        </Map>

        {/* Fixed centered pin (the map moves under it) */}
        <div className={styles.fixedPin} aria-hidden="true">
          <svg width="36" height="46" viewBox="0 0 36 46" fill="none">
            <path
              d="M18 1 C9 1 2 8 2 17 C2 28 18 45 18 45 C18 45 34 28 34 17 C34 8 27 1 18 1 Z"
              fill="#18A558"
              stroke="#0F7A40"
              strokeWidth="1.4"
            />
            <circle cx="18" cy="17" r="6" fill="#fff" />
          </svg>
          <div className={styles.pinShadow} />
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.addressBlock}>
          <span className={styles.addressLabel}>Pickup point</span>
          <span className={styles.addressText}>
            {resolving ? 'Resolving address…' : (address || 'Move the map to pick a spot')}
          </span>
          <span className={styles.coords}>
            {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
          </span>
        </div>

        <div className={styles.btnRow}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button
            className={styles.confirmBtn}
            disabled={resolving || !address}
            onClick={() => onConfirm({
              lat: center.lat,
              lng: center.lng,
              display_name: address || `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`,
            })}
          >
            Use this location
          </button>
        </div>
      </div>
    </div>
  )
}

/** Track map center so the pin (fixed in the viewport) reflects map position. */
function CenterTracker({ onCenterChange }) {
  const map = useMap()
  useEffect(() => {
    if (!map) return
    const idleListener = map.addListener('idle', () => {
      const c = map.getCenter()
      if (c) onCenterChange({ lat: c.lat(), lng: c.lng() })
    })
    return () => idleListener.remove()
  }, [map, onCenterChange])
  return null
}

/** Reverse-geocode the current center (debounced via map's idle event). */
function Geocoder({ center, setAddress, setResolving }) {
  const geocodingLib = useMapsLibrary('geocoding')
  const geocoderRef = useRef(null)
  const lastResolvedRef = useRef('')

  useEffect(() => {
    if (geocodingLib && !geocoderRef.current) {
      geocoderRef.current = new geocodingLib.Geocoder()
    }
  }, [geocodingLib])

  const resolve = useCallback(async () => {
    const coder = geocoderRef.current
    if (!coder) return
    const key = `${center.lat.toFixed(5)},${center.lng.toFixed(5)}`
    if (key === lastResolvedRef.current) return
    lastResolvedRef.current = key
    setResolving(true)
    try {
      const { results } = await coder.geocode({ location: center })
      const top = results?.[0]
      setAddress(top?.formatted_address || '')
    } catch {
      setAddress('')
    } finally {
      setResolving(false)
    }
  }, [center, setAddress, setResolving])

  useEffect(() => { resolve() }, [resolve])

  return null
}
