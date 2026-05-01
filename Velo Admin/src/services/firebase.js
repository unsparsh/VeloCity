import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const hasConfig = Boolean(
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.includes('Placeholder') &&
  firebaseConfig.projectId
)

function _init() {
  if (!hasConfig) return { app: null, auth: null }
  try {
    const _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
    return { app: _app, auth: getAuth(_app) }
  } catch (e) {
    console.warn('[Firebase] Init failed — auth unavailable without real keys.', e.message)
    return { app: null, auth: null }
  }
}

const { app, auth } = _init()

export { auth }
export default app
