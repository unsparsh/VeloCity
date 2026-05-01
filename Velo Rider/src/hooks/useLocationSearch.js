import { useState, useCallback, useRef } from 'react'
import api from '../services/api'

export default function useLocationSearch() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)

  const search = useCallback((query) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query || query.length < 2) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await api.get('/location/search/', { params: { q: query } })
        setResults(Array.isArray(data) ? data : [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  const clear = useCallback(() => setResults([]), [])

  return { results, loading, search, clear }
}
