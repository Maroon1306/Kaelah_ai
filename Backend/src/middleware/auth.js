import { verifyAccessToken } from '../utils/jwt.js'
import { pool } from '../db/pool.js'

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) return res.status(401).json({ error: 'Authentification requise.' })

  try {
    const payload = verifyAccessToken(token)
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.avatar, u.email_verified, c.id AS company_id, c.company_name, c.company_type,
              c.language, c.timezone, c.plan, c.stripe_customer_id, c.stripe_subscription_id, c.subscription_status,
              c.notification_prefs, c.ai_preferences
       FROM users u
       LEFT JOIN companies c ON c.user_id = u.id
       WHERE u.id = $1`,
      [payload.sub]
    )
    if (rows.length === 0) return res.status(401).json({ error: 'Utilisateur introuvable.' })

    const row = rows[0]
    req.user = { id: row.id, fullName: row.full_name, email: row.email, avatar: row.avatar, emailVerified: row.email_verified }
    req.company = row.company_id
      ? {
          id: row.company_id,
          name: row.company_name,
          type: row.company_type,
          language: row.language,
          timezone: row.timezone,
          plan: row.plan,
          stripeCustomerId: row.stripe_customer_id,
          stripeSubscriptionId: row.stripe_subscription_id,
          subscriptionStatus: row.subscription_status,
          notificationPrefs: row.notification_prefs,
          aiPreferences: row.ai_preferences,
        }
      : null
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Session invalide ou expirée.' })
  }
}
