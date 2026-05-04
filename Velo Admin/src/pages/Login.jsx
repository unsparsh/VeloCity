import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, demoSignIn, DEMO_CREDS } from '../services/supabase'
import useAdminStore from '../store/useAdminStore'
import styles from './Login.module.css'

export default function Login() {
  const navigate = useNavigate()
  const { fetchProfile } = useAdminStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const afterLogin = async () => {
    try {
      await fetchProfile()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const status = err?.response?.status
      if (status === 403 || status === 401) {
        setError('Access denied. Contact the fleet manager.')
      } else if (status === 404) {
        setError('No Velocity account found for this email.')
      } else {
        setError(err.message || 'Sign-in failed.')
      }
      await supabase.auth.signOut()
    }
  }

  const handleEmail = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err
      await afterLogin()
    } catch (err) {
      setError(err.message?.includes('Invalid login') ? 'Wrong email or password.' : err.message || 'Sign-in failed.')
    } finally { setLoading(false) }
  }

  const handleDemo = async () => {
    setError(''); setLoading(true)
    try {
      const { error: err } = await demoSignIn()
      if (err) throw err
      await afterLogin()
    } catch (err) {
      setError(err.message || 'Demo sign-in failed.')
    } finally { setLoading(false) }
  }

  const handleGoogle = async () => {
    setError(''); setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/dashboard' },
      })
      if (err) throw err
    } catch (err) {
      setError(err.message || 'Google sign-in failed.')
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <g stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="4" x2="2" y2="18" />
              <line x1="6" y1="2" x2="6" y2="20" />
              <line x1="10" y1="5" x2="10" y2="17" />
              <line x1="14" y1="3" x2="14" y2="19" />
              <line x1="18" y1="6" x2="18" y2="16" />
            </g>
          </svg>
          <div>
            <div className={styles.brandName}>Velocity</div>
            <div className={styles.brandSub}>Admin Console</div>
          </div>
        </div>

        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>Staff access only</p>

        <form onSubmit={handleEmail} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Email address</label>
            <input className={styles.input} type="email" placeholder="admin@velocity.in"
              value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input className={styles.input} type="password" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className={styles.divider}><span>or</span></div>

        <button className={styles.googleBtn} onClick={handleGoogle} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908C16.618 14.075 17.64 11.767 17.64 9.2Z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <button className={styles.googleBtn} onClick={handleDemo} disabled={loading}
          style={{ marginTop: 8, background: 'var(--accent)', color: '#fff', border: 'none' }}>
          🚀 Demo Login
        </button>
      </div>
    </div>
  )
}
