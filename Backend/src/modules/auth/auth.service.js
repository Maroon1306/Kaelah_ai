import crypto from 'node:crypto'
import { pool } from '../../db/pool.js'
import { hashPassword, comparePassword } from '../../utils/password.js'
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '../../utils/jwt.js'
import { HttpError } from '../../middleware/errorHandler.js'
import { sendMail } from '../../utils/mailer.js'

const OTP_EXPIRES_MINUTES = 15

export async function registerUser({ fullName, email, password, companyName, companyType }) {
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email])
  if (existing.rows.length > 0) throw new HttpError(409, 'Un compte existe déjà avec cet email.')

  const passwordHash = await hashPassword(password)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: userRows } = await client.query(
      'INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, full_name, email, avatar, email_verified, created_at',
      [fullName, email, passwordHash]
    )
    const user = userRows[0]

    const { rows: companyRows } = await client.query(
      'INSERT INTO companies (user_id, company_name, company_type) VALUES ($1, $2, $3) RETURNING id, company_name, company_type, language, timezone, plan',
      [user.id, companyName || fullName, companyType || null]
    )
    const company = companyRows[0]

    await client.query(
      'INSERT INTO company_members (company_id, user_id, email, role) VALUES ($1, $2, $3, $4)',
      [company.id, user.id, email, 'admin']
    )

    await client.query('COMMIT')
    return { user, company }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function changePassword(userId, currentPassword, newPassword) {
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId])
  if (rows.length === 0) throw new HttpError(404, 'Utilisateur introuvable.')

  const valid = await comparePassword(currentPassword, rows[0].password_hash)
  if (!valid) throw new HttpError(401, 'Mot de passe actuel incorrect.')

  const passwordHash = await hashPassword(newPassword)
  await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, passwordHash])
}

export async function verifyCredentials(email, password) {
  const { rows } = await pool.query('SELECT id, full_name, email, password_hash, avatar, email_verified FROM users WHERE email = $1', [email])
  if (rows.length === 0) throw new HttpError(401, 'Email ou mot de passe incorrect.')

  const user = rows[0]
  const valid = await comparePassword(password, user.password_hash)
  if (!valid) throw new HttpError(401, 'Email ou mot de passe incorrect.')

  delete user.password_hash
  return user
}

export async function issueSession(user) {
  const accessToken = signAccessToken(user)
  const { token: refreshToken, tokenHash, expiresAt } = generateRefreshToken()
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [user.id, tokenHash, expiresAt]
  )
  return { accessToken, refreshToken }
}

export async function rotateSession(refreshToken) {
  const tokenHash = hashRefreshToken(refreshToken)
  const { rows } = await pool.query(
    `SELECT rt.id, rt.expires_at, u.id AS user_id, u.full_name, u.email, u.avatar
     FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1`,
    [tokenHash]
  )
  if (rows.length === 0) throw new HttpError(401, 'Session invalide, veuillez vous reconnecter.')

  const row = rows[0]
  if (new Date(row.expires_at) < new Date()) {
    await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [row.id])
    throw new HttpError(401, 'Session expirée, veuillez vous reconnecter.')
  }

  await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [row.id])
  const user = { id: row.user_id, full_name: row.full_name, email: row.email, avatar: row.avatar }
  return issueSession(user)
}

export async function revokeSession(refreshToken) {
  const tokenHash = hashRefreshToken(refreshToken)
  await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash])
}

function hashOtp(code) {
  return crypto.createHash('sha256').update(code).digest('hex')
}

/**
 * Generates a 6-digit email verification code, stores only its hash (same
 * pattern as refresh tokens), and emails the plain code. Old unconsumed
 * codes for this user/purpose are invalidated first so only the latest one
 * ever works.
 */
export async function createEmailOtp(user, purpose = 'verify_email') {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0')
  const codeHash = hashOtp(code)
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000)

  await pool.query(
    'UPDATE email_otps SET consumed_at = now() WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL',
    [user.id, purpose]
  )
  await pool.query(
    'INSERT INTO email_otps (user_id, code_hash, purpose, expires_at) VALUES ($1, $2, $3, $4)',
    [user.id, codeHash, purpose, expiresAt]
  )

  await sendMail({
    to: user.email,
    subject: 'Votre code de vérification Kaelah AI',
    html: `<p>Bonjour ${user.full_name || user.fullName || ''},</p><p>Votre code de vérification est :</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</p><p>Ce code expire dans ${OTP_EXPIRES_MINUTES} minutes.</p>`,
  })

  return { expiresAt }
}

export async function verifyEmailOtp(userId, code, purpose = 'verify_email') {
  const codeHash = hashOtp(String(code || '').trim())
  const { rows } = await pool.query(
    `SELECT id, expires_at FROM email_otps
     WHERE user_id = $1 AND purpose = $2 AND code_hash = $3 AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [userId, purpose, codeHash]
  )
  if (rows.length === 0) throw new HttpError(400, 'Code invalide.')
  if (new Date(rows[0].expires_at) < new Date()) throw new HttpError(400, 'Code expiré, demandez-en un nouveau.')

  await pool.query('UPDATE email_otps SET consumed_at = now() WHERE id = $1', [rows[0].id])
  if (purpose === 'verify_email') {
    await pool.query('UPDATE users SET email_verified = true WHERE id = $1', [userId])
  }
  return { verified: true }
}

export async function getCompanyForUser(userId) {
  const { rows } = await pool.query('SELECT id, company_name, company_type, language, timezone, plan FROM companies WHERE user_id = $1', [userId])
  return rows[0] || null
}
