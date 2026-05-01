import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { auth } from '../services/firebase'
import api from '../services/api'

const useAdminStore = create(
  persist(
    (set) => ({
      admin: null,
      firebaseUser: null,

      setFirebaseUser: (firebaseUser) => set({ firebaseUser }),

      fetchProfile: async () => {
        const { data } = await api.get('/auth/me/')
        set({ admin: data })
        return data
      },

      logout: async () => {
        if (auth) await auth.signOut()
        set({ admin: null, firebaseUser: null })
      },
    }),
    {
      name: 'velocity-admin-auth',
      partialize: (state) => ({ admin: state.admin }),
    }
  )
)

export default useAdminStore
