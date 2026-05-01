import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedLayout from './components/ProtectedLayout'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Rides = lazy(() => import('./pages/Rides'))
const Drivers = lazy(() => import('./pages/Drivers'))
const Payments = lazy(() => import('./pages/Payments'))

function PageSpinner() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)',
    }}>
      <div style={{
        width: 32, height: 32,
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
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="rides" element={<Rides />} />
            <Route path="drivers" element={<Drivers />} />
            <Route path="payments" element={<Payments />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  )
}
