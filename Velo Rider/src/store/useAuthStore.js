import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { auth } from '../services/firebase'
import api from '../services/api'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      firebaseUser: null,
      token: null,
      loading: false,
      error: null,

      setFirebaseUser: (firebaseUser) => set({ firebaseUser }),

      setToken: (token) => set({ token }),

      fetchProfile: async () => {
        try {
          const { data } = await api.get('/auth/me/')
          set({ user: data })
          return data
        } catch {
          set({ user: null })
        }
      },

      registerProfile: async ({ full_name, phone, email }) => {
        const { data } = await api.post('/auth/register/', { full_name, phone, email })
        set({ user: data })
        return data
      },

      logout: async () => {
        await auth.signOut()
        set({ user: null, firebaseUser: null, token: null })
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
