import { Navigate } from 'react-router-dom'
import { useAdminAuth } from '../../context/AdminAuthContext'
import KaelahLogo from '../KaelahLogo'

export default function AdminProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAdminAuth()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <div className="animate-pulse-glow rounded-2xl"><KaelahLogo size={40} /></div>
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/admin/login" replace />

  return children
}
