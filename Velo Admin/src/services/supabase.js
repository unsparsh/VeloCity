import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// ── Demo credentials ────────────────────────────────────────────────
// Email: demo-admin@velocity.app  |  Password: VelocityDemo2024!
export const DEMO_CREDS = {
  email: 'demo-admin@velocity.app',
  password: 'VelocityDemo2024!',
  displayName: 'Demo Admin',
}

/**
 * Sign-in (or sign-up) the demo admin account via email/password.
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
        data: { display_name: DEMO_CREDS.displayName, role: 'admin' },
      },
    })
    return { data: signup.data, error: signup.error }
  }

  return { data: null, error }
}
