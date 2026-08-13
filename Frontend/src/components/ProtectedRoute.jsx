import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import KaelahLogo from './KaelahLogo'

/**
 * `requireSubscription` (default true) sends anyone without an active paid
 * plan back to onboarding's plan step instead of the requested page — every
 * plan, including Starter, requires payment, so nothing past onboarding is
 * reachable until that's done. Settings and onboarding itself opt out
 * (settings so a lapsed subscriber can still reach Billing to fix it).
 */
export default function ProtectedRoute({ children, requireSubscription = true }) {
  const { isAuthenticated, loading, company } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <div className="animate-pulse-glow rounded-2xl"><KaelahLogo size={40} /></div>
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  if (requireSubscription && company && company.subscriptionStatus !== 'active') return <Navigate to="/onboarding" replace />

  return children
}
