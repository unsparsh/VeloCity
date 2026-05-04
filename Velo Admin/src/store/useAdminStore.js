import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../services/supabase'

const useAdminStore = create(
  persist(
    (set) => ({
      admin: null,
      session: null,

      setSession: (session) => set({ session }),

      fetchProfile: async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return null
        const user = session.user
        const admin = {
          id: user.id,
          email: user.email,
          display_name: user.user_metadata?.display_name || user.email,
          role: user.user_metadata?.role || 'admin',
        }
        set({ admin, session })
        return admin
      },

      logout: async () => {
        await supabase.auth.signOut()
        set({ admin: null, session: null })
      },
    }),
    {
      name: 'velocity-admin-auth',
      partialize: (state) => ({ admin: state.admin }),
    }
  )
)

export default useAdminStore
