import { useCallback, useEffect, useState } from 'react'
import { paymentsApi } from '../services/payments'

/**
 * Loads and caches the authenticated user's wallet + recent transactions.
 */
export default function useWallet() {
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await paymentsApi.getWallet()
      setWallet(data.wallet)
      setTransactions(data.transactions || [])
    } catch (err) {
      setError(err.message || 'Failed to load wallet.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { wallet, transactions, loading, error, refresh }
}
