import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../services/supabase'

const useDriverStore = create(
  persist(
    (set) => ({
      driver: null,
      session: null,

      setSession: (session) => set({ session }),

      fetchProfile: async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return null
        const user = session.user
        const driver = {
          id: user.id,
          email: user.email,
          display_name: user.user_metadata?.display_name || user.email,
          phone: user.phone || user.user_metadata?.phone || '',
          role: user.user_metadata?.role || 'driver',
        }
        set({ driver, session })
        return driver
      },

      registerProfile: async ({ full_name, phone, license_number, email }) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.auth.updateUser({
            data: { display_name: full_name, phone, license_number, role: 'driver' },
          })
        }
        const driver = {
          id: user?.id,
          email: email || user?.email,
          display_name: full_name,
          phone,
          license_number,
          role: 'driver',
        }
        set({ driver })
        return driver
      },

      logout: async () => {
        await supabase.auth.signOut()
        set({ driver: null, session: null })
      },
    }),
    {
      name: 'velocity-driver-auth',
      partialize: (state) => ({ driver: state.driver }),
    }
  )
)

export default useDriverStore
