import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, isDemoPhone, demoSignIn, DEMO_CREDS } from '../services/supabase'
import useAuthStore from '../store/useAuthStore'
import styles from './Login.module.css'

const TABS = ['Phone', 'Email']

export default function Login() {
  const navigate = useNavigate()
  const { fetchProfile } = useAuthStore()

  const [tab, setTab] = useState('Phone')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [step, setStep] = useState('input') // 'input' | 'otp' | 'register'
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDemo, setIsDemo] = useState(false)

  const otpRefs = useRef([])

  /* ── Phone submit ─────────────────────────────────────────────── */
  const handlePhoneSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!phone || phone.length < 10) {
      setError('Enter a valid phone number.')
      return
    }
    setLoading(true)
    try {
      if (isDemoPhone(phone)) {
        // Demo mode — skip real SMS, go straight to OTP input
        setIsDemo(true)
        setStep('otp')
      } else {
        // Real Supabase phone OTP
        const { error: otpError } = await supabase.auth.signInWithOtp({
          phone: phone.startsWith('+') ? phone : `+91${phone}`,
        })
        if (otpError) throw otpError
        setIsDemo(false)
        setStep('otp')
      }
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Try again.')
    } finally {
      setLoading(false)
    }
  }

  /* ── OTP input helpers ────────────────────────────────────────── */
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

  /* ── OTP verify ───────────────────────────────────────────────── */
  const handleOtpSubmit = async (e) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length !== 6) {
      setError('Enter the complete 6-digit OTP.')
      return
    }
    setError('')
    setLoading(true)
    try {
      if (isDemo) {
        // Demo mode — validate against hardcoded OTP
        if (code !== DEMO_CREDS.otp) {
          throw new Error('Invalid OTP. Use 123456 for demo.')
        }
        const result = await demoSignIn()
        if (result.error) throw result.error
        if (result.demoBypass) {
          useAuthStore.getState().setDemoUser()
          navigate('/')
          return
        }
      } else {
        // Real Supabase OTP verification
        const { error: verifyErr } = await supabase.auth.verifyOtp({
          phone: phone.startsWith('+') ? phone : `+91${phone}`,
          token: code,
          type: 'sms',
        })
        if (verifyErr) throw verifyErr
      }
      await afterLogin()
    } catch (err) {
      setError(err.message || 'Invalid OTP. Check and try again.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Email sign-in ────────────────────────────────────────────── */
  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInErr) throw signInErr
      await afterLogin()
    } catch (err) {
      setError(
        err.message?.includes('Invalid login')
          ? 'Wrong email or password.'
          : err.message || 'Sign-in failed.'
      )
    } finally {
      setLoading(false)
    }
  }

  /* ── Google sign-in ───────────────────────────────────────────── */
  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (oauthErr) throw oauthErr
      // Redirect happens — no further code runs
    } catch (err) {
      setError(err.message || 'Google sign-in failed.')
      setLoading(false)
    }
  }

  /* ── After login ──────────────────────────────────────────────── */
  const afterLogin = async () => {
    try {
      await fetchProfile()
      navigate('/')
    } catch {
      setStep('register')
    }
  }

  /* ── Registration ─────────────────────────────────────────────── */
  const handleRegister = async (e) => {
    e.preventDefault()
    if (!fullName.trim()) {
      setError('Please enter your full name.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await supabase.auth.updateUser({
        data: { display_name: fullName, role: 'rider' },
      })
      await fetchProfile()
      navigate('/')
    } catch (err) {
      setError(err.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Brand */}
        <div className={styles.brand}>
          <svg className={styles.brandMark} viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="4" x2="2" y2="18" />
              <line x1="6" y1="2" x2="6" y2="20" />
              <line x1="10" y1="5" x2="10" y2="17" />
              <line x1="14" y1="3" x2="14" y2="19" />
              <line x1="18" y1="6" x2="18" y2="16" />
            </g>
          </svg>
          <span className={styles.brandName}>Velocity</span>
        </div>

        {step === 'register' ? (
          /* Registration step */
          <>
            <div className={styles.heading}>
              <h2>Almost there</h2>
              <p>Just your name and you're in.</p>
            </div>
            <form onSubmit={handleRegister} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Full name</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Sparsh Singh"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <button className={styles.submitBtn} disabled={loading}>
                {loading ? 'Creating account…' : 'Get started'}
              </button>
            </form>
          </>
        ) : step === 'otp' ? (
          /* OTP step */
          <>
            <div className={styles.heading}>
              <h2>Enter OTP</h2>
              <p>
                {isDemo
                  ? <>Demo mode — use <strong>123456</strong></>
                  : <>Sent to <strong>{phone.startsWith('+') ? phone : `+91 ${phone}`}</strong></>
                }
              </p>
            </div>
            <form onSubmit={handleOtpSubmit} className={styles.form}>
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
              <button className={styles.submitBtn} disabled={loading}>
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>
              <button
                type="button"
                className={styles.textBtn}
                onClick={() => { setStep('input'); setOtp(['', '', '', '', '', '']); setError('') }}
              >
                ← Change number
              </button>
            </form>
          </>
        ) : (
          /* Input step */
          <>
            <div className={styles.heading}>
              <h2>Sign in to Velocity</h2>
              <p>Book electric rides in seconds.</p>
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
              {TABS.map((t) => (
                <button
                  key={t}
                  className={`${styles.tabBtn} ${tab === t ? styles.tabActive : ''}`}
                  onClick={() => { setTab(t); setError('') }}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === 'Phone' ? (
              <form onSubmit={handlePhoneSubmit} className={styles.form}>
                <div className={styles.field}>
                  <label className={styles.label}>Mobile number</label>
                  <div className={styles.phoneRow}>
                    <span className={styles.dialCode}>+91</span>
                    <input
                      className={`${styles.input} ${styles.phoneInput}`}
                      type="tel"
                      inputMode="numeric"
                      placeholder="98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      maxLength={10}
                      required
                    />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                    Demo: use <strong>9999999999</strong>
                  </p>
                </div>
                {error && <p className={styles.error}>{error}</p>}
                <button className={styles.submitBtn} disabled={loading}>
                  {loading ? 'Sending OTP…' : 'Send OTP →'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleEmailSubmit} className={styles.form}>
                <div className={styles.field}>
                  <label className={styles.label}>Email address</label>
                  <input
                    className={styles.input}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Password</label>
                  <input
                    className={styles.input}
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error && <p className={styles.error}>{error}</p>}
                <button className={styles.submitBtn} disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in →'}
                </button>
              </form>
            )}

            {/* Divider */}
            <div className={styles.divider}>
              <span>or continue with</span>
            </div>

            {/* Google */}
            <button className={styles.googleBtn} onClick={handleGoogleLogin} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <p className={styles.terms}>
              By continuing, you agree to Velocity's{' '}
              <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
