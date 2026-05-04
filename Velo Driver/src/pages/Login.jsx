import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, isDemoPhone, demoSignIn, DEMO_CREDS } from '../services/supabase'
import useDriverStore from '../store/useDriverStore'
import styles from './Login.module.css'

const STEPS = { PHONE: 'phone', OTP: 'otp' }

export default function Login() {
  const navigate = useNavigate()
  const { fetchProfile } = useDriverStore()
  const [step, setStep] = useState(STEPS.PHONE)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDemo, setIsDemo] = useState(false)
  const otpRefs = useRef([])

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')
    if (phone.length < 10) { setError('Enter a valid 10-digit phone number.'); return }
    setLoading(true)
    try {
      if (isDemoPhone(phone)) {
        setIsDemo(true)
        setStep(STEPS.OTP)
      } else {
        const { error: otpErr } = await supabase.auth.signInWithOtp({
          phone: phone.startsWith('+') ? phone : `+91${phone}`,
        })
        if (otpErr) throw otpErr
        setIsDemo(false)
        setStep(STEPS.OTP)
      }
    } catch (err) {
      setError(err.message || 'Failed to send OTP.')
    } finally { setLoading(false) }
  }

  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return
    const next = [...otp]
    next[index] = value
    setOtp(next)
    if (value && index < 5) otpRefs.current[index + 1]?.focus()
    if (!value && index > 0) otpRefs.current[index - 1]?.focus()
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    const code = otp.join('')
    setError('')
    if (code.length !== 6) { setError('Enter the complete 6-digit OTP.'); return }
    setLoading(true)
    try {
      if (isDemo) {
        if (code !== DEMO_CREDS.otp) throw new Error('Invalid OTP. Use 123456 for demo.')
        const result = await demoSignIn()
        if (result.error) throw result.error
      } else {
        const { error: err } = await supabase.auth.verifyOtp({
          phone: phone.startsWith('+') ? phone : `+91${phone}`,
          token: code,
          type: 'sms',
        })
        if (err) throw err
      }
      await fetchProfile()
      navigate('/home', { replace: true })
    } catch (err) {
      setError(err.message || 'Invalid OTP.')
    } finally { setLoading(false) }
  }

  const handleGoogle = async () => {
    setLoading(true); setError('')
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/home' },
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
          <div className={styles.brandMark}>V</div>
          <span className={styles.brandName}>Volt<span>·driver</span></span>
        </div>

        {step === STEPS.PHONE ? (
          <>
            <div className={styles.heading}>
              <h2>Sign in</h2>
              <p>Enter your registered driver phone number</p>
            </div>
            <form onSubmit={handleSendOtp} className={styles.form}>
              <div className={styles.phoneField}>
                <span className={styles.dialCode}>+91</span>
                <input
                  className={styles.phoneInput}
                  type="tel"
                  inputMode="numeric"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  maxLength={10}
                  autoFocus
                  required
                />
              </div>
              <p className={styles.demoHint}>
                Demo: use <strong>9999999999</strong>
              </p>
              {error && <p className={styles.error}>{error}</p>}
              <button className={styles.btn} type="submit" disabled={loading}>
                {loading ? 'Sending OTP…' : 'Send OTP →'}
              </button>
            </form>

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
          </>
        ) : (
          <>
            <div className={styles.heading}>
              <h2>Verify OTP</h2>
              <p>
                {isDemo
                  ? <>Demo mode — use <strong>123456</strong></>
                  : <>Sent to <strong>+91 {phone}</strong></>
                }
              </p>
            </div>
            <form onSubmit={handleVerifyOtp} className={styles.form}>
              <div className={styles.otpRow}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    className={styles.otpBox}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    autoFocus={i === 0}
                  />
                ))}
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button className={styles.btn} type="submit" disabled={loading}>
                {loading ? 'Verifying…' : 'Verify & Sign in'}
              </button>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => { setStep(STEPS.PHONE); setOtp(['', '', '', '', '', '']); setError('') }}
              >
                ← Change number
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
