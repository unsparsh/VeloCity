import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../services/firebase'
import useAuthStore from '../store/useAuthStore'

export default function ProtectedRoute({ children }) {
  const { user, fetchProfile, setFirebaseUser } = useAuthStore()
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    // When Firebase isn't configured (dev/preview), bypass auth check
    if (!auth) {
      setAuthed(true)
      setChecking(false)
      return
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setFirebaseUser(firebaseUser)
        if (!user) {
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
    return () => unsub()
  }, [])

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <div style={{
          width: 32,
          height: 32,
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
