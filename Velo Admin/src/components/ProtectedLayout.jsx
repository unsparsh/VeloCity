import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../services/supabase'
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
  const { admin, fetchProfile } = useAdminStore()
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
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
