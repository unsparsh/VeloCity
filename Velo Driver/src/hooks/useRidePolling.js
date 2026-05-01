import { useEffect, useRef } from 'react'
import api from '../services/api'

export default function useRidePolling(isOnline, onRideFound) {
  const timerRef = useRef(null)
  const lastRideIdRef = useRef(null)

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (!isOnline) return

    const poll = async () => {
      try {
        const { data } = await api.get('/rides/driver/pending/')
        if (data.length > 0) {
          const ride = data[0]
          if (ride.id !== lastRideIdRef.current) {
            lastRideIdRef.current = ride.id
            onRideFound(ride)
          }
        }
      } catch { /* keep polling */ }
    }

    poll()
    timerRef.current = setInterval(poll, 5000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isOnline, onRideFound])
}
