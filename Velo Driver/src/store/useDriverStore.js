import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { auth } from '../services/firebase'
import api from '../services/api'

const useDriverStore = create(
  persist(
    (set) => ({
      driver: null,
      firebaseUser: null,

      setFirebaseUser: (firebaseUser) => set({ firebaseUser }),

      fetchProfile: async () => {
        const { data } = await api.get('/auth/driver/me/')
        set({ driver: data })
        return data
      },

      registerProfile: async ({ full_name, phone, license_number, email }) => {
        const { data } = await api.post('/auth/driver/register/', {
          full_name, phone, license_number, email,
        })
        set({ driver: data })
        return data
      },

      logout: async () => {
        if (auth) await auth.signOut()
        set({ driver: null, firebaseUser: null })
      },
    }),
    {
      name: 'velocity-driver-auth',
      partialize: (state) => ({ driver: state.driver }),
    }
  )
)

export default useDriverStore
