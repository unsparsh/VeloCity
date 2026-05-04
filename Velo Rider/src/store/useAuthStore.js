import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../services/supabase'

export const DEMO_USER = {
  id: 'demo-rider-local',
  email: 'demorider@velocity.app',
  display_name: 'Demo Rider',
  full_name: 'Demo Rider',
  phone: '9999999999',
  role: 'rider',
  isDemo: true,
}

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      loading: false,
      error: null,

      setSession: (session) => set({ session }),

      fetchProfile: async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return null
        // Store user metadata from Supabase session
        const user = session.user
        const profile = {
          id: user.id,
          email: user.email,
          display_name: user.user_metadata?.display_name || user.email,
          phone: user.phone || user.user_metadata?.phone || '',
          role: user.user_metadata?.role || 'rider',
        }
        set({ user: profile, session })
        return profile
      },

      registerProfile: async ({ full_name, phone, email }) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.auth.updateUser({
            data: { display_name: full_name, phone, role: 'rider' },
          })
        }
        const profile = {
          id: user?.id,
          email: email || user?.email,
          display_name: full_name,
          phone,
          role: 'rider',
        }
        set({ user: profile })
        return profile
      },

      setDemoUser: () => set({ user: DEMO_USER, session: null }),

      logout: async () => {
        await supabase.auth.signOut()
        set({ user: null, session: null })
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'velocity-auth',
      partialize: (state) => ({ user: state.user }),
    }
  )
)

export default useAuthStore
