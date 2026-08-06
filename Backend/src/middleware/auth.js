import { verifyAccessToken } from '../utils/jwt.js'
import { pool } from '../db/pool.js'

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) return res.status(401).json({ error: 'Authentification requise.' })

  try {
    const payload = verifyAccessToken(token)
    // A user resolves to the company they own, or — if they own none — the
    // company they've accepted a team invite for (see team.routes.js).
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.avatar, u.email_verified,
              COALESCE(owned.id, member_co.id) AS company_id,
              COALESCE(owned.company_name, member_co.company_name) AS company_name,
              COALESCE(owned.company_type, member_co.company_type) AS company_type,
              COALESCE(owned.language, member_co.language) AS language,
              COALESCE(owned.timezone, member_co.timezone) AS timezone,
              COALESCE(owned.plan, member_co.plan) AS plan,
              COALESCE(owned.stripe_customer_id, member_co.stripe_customer_id) AS stripe_customer_id,
              COALESCE(owned.stripe_subscription_id, member_co.stripe_subscription_id) AS stripe_subscription_id,
              COALESCE(owned.subscription_status, member_co.subscription_status) AS subscription_status,
              COALESCE(owned.notification_prefs, member_co.notification_prefs) AS notification_prefs,
              COALESCE(owned.ai_preferences, member_co.ai_preferences) AS ai_preferences,
              CASE WHEN owned.id IS NOT NULL THEN 'admin' ELSE member.role END AS member_role
       FROM users u
       LEFT JOIN companies owned ON owned.user_id = u.id
       LEFT JOIN company_members member ON member.user_id = u.id AND member.status = 'active' AND owned.id IS NULL
       LEFT JOIN companies member_co ON member_co.id = member.company_id
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
          role: row.member_role,
        }
      : null
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Session invalide ou expirée.' })
  }
}
