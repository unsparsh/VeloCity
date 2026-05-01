import { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'

const Login = lazy(() => import('./pages/Login'))
const DriverHome = lazy(() => import('./pages/DriverHome'))
const ProtectedRoute = lazy(() => import('./components/ProtectedRoute'))

function Spinner() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid var(--stroke)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/home" element={
            <ProtectedRoute><DriverHome /></ProtectedRoute>
          } />
        </Routes>
      </Suspense>
    </Router>
  )
}
