/**
 * Separate API client for the admin panel — deliberately independent from
 * services/api.js so an admin session and a regular user session never
 * share a token slot (both can be logged in at once, in the same browser).
 */
import { ApiError } from './api'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'
const TOKEN_KEY = 'kaelah_admin_access_token'

export function getStoredAdminToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredAdminToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request(path, options = {}) {
  const token = getStoredAdminToken()
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  if (res.status === 204) return null

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await res.json() : await res.text()

  if (!res.ok) {
    const message = (isJson && data?.error) || `Erreur API (${res.status})`
    throw new ApiError(res.status, message)
  }
  return data
}

function post(path, body) {
  return request(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined })
}
function put(path, body) {
  return request(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined })
}

export const adminApi = {
  login: (email, password) => post('/admin/auth/login', { email, password }),
  me: () => request('/admin/auth/me'),
  changePassword: (currentPassword, newPassword) => put('/admin/auth/password', { currentPassword, newPassword }),
  getStats: () => request('/admin/stats'),
  getUsers: () => request('/admin/users'),
  getFeedback: () => request('/admin/feedback'),
  getPayments: () => request('/admin/payments'),
}
