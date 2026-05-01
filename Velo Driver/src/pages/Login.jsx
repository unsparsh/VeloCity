import { lazy, Suspense, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { auth } from '../services/firebase'
import useDriverStore from '../store/useDriverStore'
import styles from './Login.module.css'

const STEPS = { PHONE: 'phone', OTP: 'otp' }

function getRecaptcha() {
  if (!auth) return null
  if (!window._rcDriver) {
    window._rcDriver = new RecaptchaVerifier(auth, 'recaptcha-driver', { size: 'invisible' })
  }
  return window._rcDriver
}

export default function Login() {
  const navigate = useNavigate()
  const { fetchProfile } = useDriverStore()

  const [step, setStep] = useState(STEPS.PHONE)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')
    if (!auth) { setError('Firebase not configured.'); return }
    if (phone.length < 10) { setError('Enter a valid phone number.'); return }
    setLoading(true)
    try {
      const rc = getRecaptcha()
      const formatted = phone.startsWith('+') ? phone : `+91${phone}`
      const result = await signInWithPhoneNumber(auth, formatted, rc)
      setConfirm(result)
      setStep(STEPS.OTP)
    } catch (err) {
      setError(err.message || 'Failed to send OTP.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    if (otp.length !== 6) { setError('Enter the 6-digit OTP.'); return }
    setLoading(true)
    try {
      await confirm.confirm(otp)
      await fetchProfile()
      navigate('/home', { replace: true })
    } catch (err) {
      if (err?.response?.status === 404) {
        setError('No driver account found. Contact your fleet manager.')
      } else {
        setError(err.message || 'Invalid OTP.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    if (!auth) { setError('Firebase not configured.'); return }
    setLoading(true)
    setError('')
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
      await fetchProfile()
      navigate('/home', { replace: true })
    } catch (err) {
      if (err?.response?.status === 404) {
        setError('No driver account found. Contact your fleet manager.')
      } else {
        setError(err.message || 'Google sign-in failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoRow}>
          <svg width="28" height="28" viewBox="0 0 22 22" fill="none">
            <g stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="4" x2="2" y2="18" /><line x1="6" y1="2" x2="6" y2="20" />
              <line x1="10" y1="5" x2="10" y2="17" /><line x1="14" y1="3" x2="14" y2="19" />
              <line x1="18" y1="6" x2="18" y2="16" />
            </g>
          </svg>
          <span className={styles.logoText}>Driver</span>
        </div>

        <h1 className={styles.title}>
          {step === STEPS.PHONE ? 'Sign in' : 'Verify OTP'}
        </h1>
        <p className={styles.subtitle}>
          {step === STEPS.PHONE
            ? 'Enter your registered driver phone number'
            : `Code sent to ${phone}`}
        </p>

        {step === STEPS.PHONE ? (
          <form onSubmit={handleSendOtp} className={styles.form}>
            <div className={styles.fieldGroup}>
              <span className={styles.prefix}>+91</span>
              <input
                className={styles.input}
                type="tel"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                maxLength={10}
                autoFocus
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.btn} type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className={styles.form}>
            <input
              className={`${styles.input} ${styles.otpInput}`}
              type="text"
              inputMode="numeric"
              placeholder="· · · · · ·"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
            />
            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.btn} type="submit" disabled={loading}>
              {loading ? 'Verifying…' : 'Verify & Sign in'}
            </button>
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => { setStep(STEPS.PHONE); setOtp(''); setError('') }}
            >
              Back
            </button>
          </form>
        )}

        <div className={styles.divider}><span>or</span></div>

        <button className={styles.googleBtn} onClick={handleGoogle} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div id="recaptcha-driver" />
      </div>
    </div>
  )
}
