import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../services/firebase'
import useDriverStore from '../store/useDriverStore'

export default function ProtectedRoute({ children }) {
  const { driver, fetchProfile, setFirebaseUser } = useDriverStore()
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    if (!auth) {
      setAuthed(true)
      setChecking(false)
      return
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setFirebaseUser(firebaseUser)
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
    return () => unsub()
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
