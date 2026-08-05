import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h'
const REFRESH_TOKEN_EXPIRES_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 30)

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

export function generateRefreshToken() {
  const token = crypto.randomBytes(48).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000)
  return { token, tokenHash, expiresAt }
}

export function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}
