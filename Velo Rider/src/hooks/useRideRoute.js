import { useEffect, useState } from 'react'
import api from '../services/api'

/**
 * Fetches the pickup → destination route geometry from the backend.
 * Falls back silently; returns null while loading or on error.
 */
export default function useRideRoute(rideId) {
  const [geometry, setGeometry] = useState(null)

  useEffect(() => {
    if (!rideId) {
      setGeometry(null)
      return
    }
    let cancelled = false
    api.get(`/rides/${rideId}/route/`)
      .then(({ data }) => {
        if (!cancelled) setGeometry(data.geometry)
      })
      .catch(() => {
        if (!cancelled) setGeometry(null)
      })
    return () => { cancelled = true }
  }, [rideId])

  return geometry
}
