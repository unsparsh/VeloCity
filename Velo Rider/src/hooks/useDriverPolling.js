import { useState, useEffect, useRef } from 'react'
import api from '../services/api'

export default function useDriverPolling(rideId, isActive) {
  const [driverLocation, setDriverLocation] = useState(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!isActive || !rideId) {
      setDriverLocation(null)
      return
    }

    const poll = async () => {
      try {
        const { data } = await api.get(`/rides/${rideId}/driver-location/`)
        setDriverLocation(data)
      } catch {
        // Location temporarily unavailable — keep last known position
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 3000)
    return () => clearInterval(intervalRef.current)
  }, [rideId, isActive])

  return driverLocation
}
