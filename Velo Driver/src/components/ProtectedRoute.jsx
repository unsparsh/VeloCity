import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import useDriverStore from '../store/useDriverStore'

const SUPABASE_CONFIGURED = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
const DEMO_AUTH = import.meta.env.VITE_DEMO_AUTH === 'true'

export default function ProtectedRoute({ children }) {
  const { driver, fetchProfile } = useDriverStore()
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    if (!SUPABASE_CONFIGURED || DEMO_AUTH) {
      setAuthed(true)
      setChecking(false)
      return
    }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        if (!driver) {
          try {
            await fetchProfile()
          } catch {
            setAuthed(false)
            setChecking(false)
            return
          }
        }
        setAuthed(true)
      } else {
        setAuthed(false)
      }
      setChecking(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          setAuthed(true)
        } else {
          setAuthed(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg)',
      }}>
        <div style={{
          width: 32, height: 32,
          border: '3px solid var(--stroke)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return authed ? children : <Navigate to="/login" replace />
}
