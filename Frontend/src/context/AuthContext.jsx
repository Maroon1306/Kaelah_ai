import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, getStoredToken, setStoredToken, ApiError } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function bootstrap() {
      if (!getStoredToken()) { setLoading(false); return }
      try {
        const { user, company } = await api.me()
        setUser(user)
        setCompany(company)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          try {
            const { accessToken } = await api.refresh()
            setStoredToken(accessToken)
            const { user, company } = await api.me()
            setUser(user)
            setCompany(company)
          } catch {
            setStoredToken(null)
          }
        }
      } finally {
        setLoading(false)
      }
    }
    bootstrap()
  }, [])

  const login = useCallback(async (email, password) => {
    const { accessToken, user, company } = await api.login(email, password)
    setStoredToken(accessToken)
    setUser(user)
    setCompany(company)
  }, [])

  const register = useCallback(async (fullName, email, password, companyName, companyType) => {
    const { accessToken, user, company } = await api.register(fullName, email, password, companyName, companyType)
    setStoredToken(accessToken)
    setUser(user)
    setCompany(company)
  }, [])

  const logout = useCallback(async () => {
    try { await api.logout() } catch { /* best effort */ }
    setStoredToken(null)
    setUser(null)
    setCompany(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    const { user, company } = await api.me()
    setUser(user)
    setCompany(company)
  }, [])

  return (
    <AuthContext.Provider value={{ user, company, setCompany, loading, isAuthenticated: !!user, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
