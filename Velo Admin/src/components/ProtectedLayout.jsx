import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../services/firebase'
import useAdminStore from '../store/useAdminStore'
import Sidebar from './Sidebar'
import styles from './ProtectedLayout.module.css'

function Spinner() {
  return (
    <div className={styles.spinnerWrap}>
      <div className={styles.spinner} />
    </div>
  )
}

export default function ProtectedLayout() {
  const { admin, fetchProfile, setFirebaseUser } = useAdminStore()
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    if (!auth) {
      // Dev mode without real Firebase keys — allow through
      setAuthed(true)
      setChecking(false)
      return
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setFirebaseUser(firebaseUser)
        if (!admin) {
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

  if (checking) return <Spinner />
  if (!authed) return <Navigate to="/login" replace />

  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
