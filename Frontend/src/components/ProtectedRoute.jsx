import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import KaelahLogo from './KaelahLogo'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <div className="animate-pulse-glow rounded-2xl"><KaelahLogo size={40} /></div>
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />

  return children
}
