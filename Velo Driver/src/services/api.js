import axios from 'axios'
import { auth } from './firebase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(async (config) => {
  if (auth?.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken()
      config.headers.Authorization = `Bearer ${token}`
    } catch { /* continue without token */ }
  }
  return config
})

export default api
