import { useEffect, useRef } from 'react'
import api from '../services/api'

export default function useLocationBroadcast(isActive) {
  const timerRef = useRef(null)

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (!isActive || !navigator.geolocation) return

    const broadcast = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          api.post('/location/driver-update/', {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading ?? 0,
          }).catch(() => {})
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
      )
    }

    broadcast()
    timerRef.current = setInterval(broadcast, 5000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isActive])
}
