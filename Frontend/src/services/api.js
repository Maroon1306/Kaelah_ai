/**
 * Real API client for the Kaelah AI backend (Backend/).
 * All calls go through `request()`, which attaches the JWT access token,
 * sends/receives the httpOnly refresh cookie, and normalizes errors.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api'
const TOKEN_KEY = 'kaelah_access_token'

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function request(path, options = {}) {
  const token = getStoredToken()
  const headers = { ...options.headers }
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  })

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
function del(path) {
  return request(path, { method: 'DELETE' })
}

export const api = {
  // Auth
  register: (fullName, email, password, companyName, companyType) =>
    post('/auth/register', { fullName, email, password, companyName, companyType }),
  login: (email, password) => post('/auth/login', { email, password }),
  refresh: () => post('/auth/refresh'),
  logout: () => post('/auth/logout'),
  me: () => request('/auth/me'),
  verifyEmail: (code) => post('/auth/verify-email', { code }),
  resendOtp: () => post('/auth/resend-otp'),
  changePassword: (currentPassword, newPassword) => put('/auth/password', { currentPassword, newPassword }),

  // Profile
  getProfile: () => request('/profile'),
  updateProfile: (data) => put('/profile', data),
  deleteAccount: () => del('/profile'),

  // Team
  getTeam: () => request('/team'),

  // Conversations & chat
  getConversations: () => request('/conversations'),
  getConversation: (id) => request(`/conversations/${id}`),
  sendMessage: (message, conversationId) => post('/chat', { message, conversationId }),

  // Actions
  confirmAction: (id) => post(`/actions/${id}/confirm`),
  rejectAction: (id) => post(`/actions/${id}/reject`),
  getRecentActions: () => request('/actions/recent'),

  // Connectors
  getConnectors: () => request('/connectors'),
  disconnectConnector: (provider) => del(`/connectors/${provider}`),
  getShopifyInstallUrl: (shop) => request(`/connectors/shopify/install?shop=${encodeURIComponent(shop)}`),
  wordpressOauthConsent: (data) => post('/connectors/wordpress/oauth/consent', data),
  drupalOauthConsent: (data) => post('/connectors/drupal/oauth/consent', data),
  getBigcommerceInstallUrl: () => request('/connectors/bigcommerce/install'),
  bigcommerceClaim: (data) => post('/connectors/bigcommerce/claim', data),
  prestashopOauthConsent: (data) => post('/connectors/prestashop/oauth/consent', data),
  getWixInstallUrl: () => request('/connectors/wix/install'),
  wixClaim: (data) => post('/connectors/wix/claim', data),
  getGoogleSearchConsoleInstallUrl: () => request('/connectors/google-search-console/install'),

  // SEO / GEO
  analyzeSeo: (url) => post('/seo/analyze', { url }),
  optimizeSeo: (url) => post('/seo/optimize', { url }),
  optimizeGeo: (url) => post('/geo/optimize', { url }),

  // Analytics
  getAnalyticsOverview: () => request('/analytics/overview'),
  getSalesHistory: () => request('/analytics/sales'),
  getSeoOverview: () => request('/analytics/seo'),

  // Automations
  getAutomations: () => request('/automations'),
  createAutomation: (data) => post('/automations', data),
  updateAutomation: (id, data) => put(`/automations/${id}`, data),
  deleteAutomation: (id) => del(`/automations/${id}`),

  // Billing
  getPlans: () => request('/billing/plans'),
  getInvoices: () => request('/billing/invoices'),
  createCheckoutSession: (planId) => post('/billing/checkout', { planId }),
  createPortalSession: () => post('/billing/portal'),

  // Uploads
  uploadFile: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return request('/uploads', { method: 'POST', body: formData })
  },
}

export default api
