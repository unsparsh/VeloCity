import { useState, useRef, useEffect, useCallback } from 'react'
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps'
import styles from './LocationSearch.module.css'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

/**
 * Pickup/destination input powered by Google Places Autocomplete.
 *
 * Props:
 *   placeholder:     string
 *   value:           { display_name } | null
 *   onSelect:        (selection | null) => void
 *                    selection: { lat, lng, display_name, raw }
 *   icon:            ReactNode (left-side icon)
 *   enableMapPick:   boolean (shows "Pick on map" item at bottom of dropdown)
 *   onPickOnMap:     () => void (called when user taps "Pick on map")
 */
export default function LocationSearch(props) {
  const { enableMapPick = false } = props

  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY.includes('DUMMY')) {
    // Render a degraded inline input so the page is still usable while
    // the developer wires up a real key.
    return <DegradedInput {...props} />
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
      <Inner {...props} enableMapPick={enableMapPick} />
    </APIProvider>
  )
}

function Inner({ placeholder, value, onSelect, icon, enableMapPick, onPickOnMap }) {
  const placesLib = useMapsLibrary('places')
  const geocodingLib = useMapsLibrary('geocoding')

  const autocompleteServiceRef = useRef(null)
  const placesServiceRef = useRef(null)
  const geocoderRef = useRef(null)
  const sessionTokenRef = useRef(null)

  const [query, setQuery] = useState(value?.display_name || '')
  const [predictions, setPredictions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef(null)
  const debounceRef = useRef(null)

  // Initialise Google services once libs are ready
  useEffect(() => {
    if (placesLib && !autocompleteServiceRef.current) {
      autocompleteServiceRef.current = new placesLib.AutocompleteService()
      // Hidden div is required by PlacesService constructor
      const div = document.createElement('div')
      placesServiceRef.current = new placesLib.PlacesService(div)
      sessionTokenRef.current = new placesLib.AutocompleteSessionToken()
    }
  }, [placesLib])

  useEffect(() => {
    if (geocodingLib && !geocoderRef.current) {
      geocoderRef.current = new geocodingLib.Geocoder()
    }
  }, [geocodingLib])

  // Sync external value changes (e.g. when ChooseLocation sets pickup
  // from the map picker).
  useEffect(() => {
    if (value?.display_name && value.display_name !== query) {
      setQuery(value.display_name)
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchPredictions = useCallback((q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q || q.length < 2 || !autocompleteServiceRef.current) {
      setPredictions([])
      return
    }
    debounceRef.current = setTimeout(() => {
      setLoading(true)
      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: q,
          sessionToken: sessionTokenRef.current,
          componentRestrictions: { country: 'in' },
        },
        (results, status) => {
          setLoading(false)
          if (status === 'OK' && results) {
            setPredictions(results)
          } else {
            setPredictions([])
          }
        }
      )
    }, 250)
  }, [])

  const handleChange = (e) => {
    const q = e.target.value
    setQuery(q)
    setOpen(true)
    fetchPredictions(q)
  }

  const handleSelectPrediction = (prediction) => {
    const placesService = placesServiceRef.current
    if (!placesService) return
    placesService.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['geometry', 'formatted_address', 'name'],
        sessionToken: sessionTokenRef.current,
      },
      (place, status) => {
        if (status !== 'OK' || !place?.geometry?.location) return
        const display = place.formatted_address || prediction.description
        setQuery(display)
        setOpen(false)
        setPredictions([])
        // Refresh session token after each selection (Google billing best practice)
        if (window.google?.maps?.places) {
          sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken()
        }
        onSelect({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          display_name: display,
          raw: { place_id: prediction.place_id, ...place },
        })
      }
    )
  }

  const handleClear = () => {
    setQuery('')
    setPredictions([])
    onSelect(null)
  }

  const handlePickOnMap = () => {
    setOpen(false)
    onPickOnMap?.()
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.inputRow}>
        <span className={styles.icon}>{icon}</span>
        <input
          className={styles.input}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onFocus={() => (predictions.length > 0 || enableMapPick) && setOpen(true)}
          autoComplete="off"
        />
        {query && (
          <button className={styles.clearBtn} onClick={handleClear} aria-label="Clear">
            ✕
          </button>
        )}
      </div>

      {open && (predictions.length > 0 || loading || enableMapPick) && (
        <ul className={styles.dropdown}>
          {loading && <li className={styles.hint}>Searching…</li>}

          {predictions.map((p) => (
            <li
              key={p.place_id}
              className={styles.item}
              onMouseDown={() => handleSelectPrediction(p)}
            >
              <span className={styles.itemIcon}>📍</span>
              <div className={styles.itemText}>
                <span className={styles.itemMain}>
                  {p.structured_formatting?.main_text || p.description}
                </span>
                <span className={styles.itemSub}>
                  {p.structured_formatting?.secondary_text || ''}
                </span>
              </div>
            </li>
          ))}

          {enableMapPick && (
            <li
              className={`${styles.item} ${styles.mapPickItem}`}
              onMouseDown={handlePickOnMap}
            >
              <span className={styles.itemIcon}>🗺️</span>
              <div className={styles.itemText}>
                <span className={styles.itemMain}>Pick on map</span>
                <span className={styles.itemSub}>Drop a pin at the exact spot</span>
              </div>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

/** Fallback when no Google API key is configured — input still works visually. */
function DegradedInput({ placeholder, value, icon, enableMapPick, onPickOnMap }) {
  const [query, setQuery] = useState(value?.display_name || '')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (value?.display_name && value.display_name !== query) {
      setQuery(value.display_name)
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.inputRow}>
        <span className={styles.icon}>{icon}</span>
        <input
          className={styles.input}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => enableMapPick && setOpen(true)}
          autoComplete="off"
        />
      </div>
      {open && (
        <ul className={styles.dropdown}>
          <li className={styles.hint}>
            Set VITE_GOOGLE_MAPS_API_KEY in .env for autocomplete
          </li>
          {enableMapPick && (
            <li
              className={`${styles.item} ${styles.mapPickItem}`}
              onMouseDown={() => { setOpen(false); onPickOnMap?.() }}
            >
              <span className={styles.itemIcon}>🗺️</span>
              <div className={styles.itemText}>
                <span className={styles.itemMain}>Pick on map</span>
                <span className={styles.itemSub}>Drop a pin at the exact spot</span>
              </div>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
