import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { adminApi, getStoredAdminToken, setStoredAdminToken } from '../services/adminApi'

const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function bootstrap() {
      if (!getStoredAdminToken()) { setLoading(false); return }
      try {
        const { admin } = await adminApi.me()
        setAdmin(admin)
      } catch {
        setStoredAdminToken(null)
      } finally {
        setLoading(false)
      }
    }
    bootstrap()
  }, [])

  const login = useCallback(async (email, password) => {
    const { accessToken, admin } = await adminApi.login(email, password)
    setStoredAdminToken(accessToken)
    setAdmin(admin)
  }, [])

  const logout = useCallback(() => {
    setStoredAdminToken(null)
    setAdmin(null)
  }, [])

  return (
    <AdminAuthContext.Provider value={{ admin, loading, isAuthenticated: !!admin, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return ctx
}
