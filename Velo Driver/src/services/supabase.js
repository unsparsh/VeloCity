import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// ── Demo credentials ────────────────────────────────────────────────
// Use these to bypass real OTP / SMS provider during development.
// Phone: 9999999999  |  OTP: 123456
export const DEMO_CREDS = {
  phone: '9999999999',
  otp: '123456',
  email: 'demo-driver@velocity.app',
  password: 'VelocityDemo2024!',
  displayName: 'Demo Driver',
}

/**
 * Returns true when the entered phone matches the demo phone number.
 */
export function isDemoPhone(phone) {
  return phone.replace(/\D/g, '').endsWith(DEMO_CREDS.phone)
}

/**
 * Sign-in (or sign-up) the demo driver account via email/password so that
 * a real Supabase session is created without needing an SMS provider.
 */
export async function demoSignIn() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: DEMO_CREDS.email,
    password: DEMO_CREDS.password,
  })

  if (!error) return { data, error: null }

  if (error.message?.includes('Invalid login credentials')) {
    const signup = await supabase.auth.signUp({
      email: DEMO_CREDS.email,
      password: DEMO_CREDS.password,
      options: {
        data: { display_name: DEMO_CREDS.displayName, role: 'driver' },
      },
    })
    return { data: signup.data, error: signup.error }
  }

  return { data: null, error }
}
