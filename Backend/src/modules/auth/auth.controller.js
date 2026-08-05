import { HttpError } from '../../middleware/errorHandler.js'
import * as authService from './auth.service.js'

const REFRESH_COOKIE = 'kaelah_refresh'
const REFRESH_MAX_AGE_MS = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 30) * 24 * 60 * 60 * 1000

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_MAX_AGE_MS,
    path: '/api/auth',
  })
}

export async function register(req, res) {
  const { fullName, email, password, companyName, companyType } = req.body
  if (!fullName || !email || !password) throw new HttpError(400, 'Nom complet, email et mot de passe sont requis.')
  if (password.length < 8) throw new HttpError(400, 'Le mot de passe doit contenir au moins 8 caractères.')

  const { user, company } = await authService.registerUser({ fullName, email, password, companyName, companyType })
  const { accessToken, refreshToken } = await authService.issueSession(user)
  setRefreshCookie(res, refreshToken)
  await authService.createEmailOtp(user).catch((err) => console.error('[auth] Échec envoi OTP inscription:', err.message))
  res.status(201).json({ accessToken, user, company })
}

export async function verifyEmail(req, res) {
  const { code } = req.body
  if (!code) throw new HttpError(400, 'Code manquant.')
  await authService.verifyEmailOtp(req.user.id, code)
  res.json({ verified: true })
}

export async function resendOtp(req, res) {
  await authService.createEmailOtp(req.user)
  res.status(204).end()
}

export async function login(req, res) {
  const { email, password } = req.body
  if (!email || !password) throw new HttpError(400, 'Email et mot de passe sont requis.')

  const user = await authService.verifyCredentials(email, password)
  const company = await authService.getCompanyForUser(user.id)
  const { accessToken, refreshToken } = await authService.issueSession(user)
  setRefreshCookie(res, refreshToken)
  res.json({ accessToken, user, company })
}

export async function refresh(req, res) {
  const refreshToken = req.cookies?.[REFRESH_COOKIE]
  if (!refreshToken) throw new HttpError(401, 'Aucune session à rafraîchir.')

  const { accessToken, refreshToken: nextRefreshToken } = await authService.rotateSession(refreshToken)
  setRefreshCookie(res, nextRefreshToken)
  res.json({ accessToken })
}

export async function logout(req, res) {
  const refreshToken = req.cookies?.[REFRESH_COOKIE]
  if (refreshToken) await authService.revokeSession(refreshToken)
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' })
  res.status(204).end()
}

export async function me(req, res) {
  res.json({ user: req.user, company: req.company })
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) throw new HttpError(400, 'Mot de passe actuel et nouveau mot de passe requis.')
  if (newPassword.length < 8) throw new HttpError(400, 'Le nouveau mot de passe doit contenir au moins 8 caractères.')

  await authService.changePassword(req.user.id, currentPassword, newPassword)
  res.status(204).end()
}
