import { pool } from '../../db/pool.js'
import { getPlanLimits } from '../../config/plans.js'

export async function getUsage(companyId, plan) {
  // Scoped to the current calendar month — matches the quota actually
  // enforced in kaelah.orchestrator.js, not a lifetime count.
  const { rows: [messages] } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE c.company_id = $1 AND m.role = 'user' AND m.created_at >= date_trunc('month', now())`,
    [companyId]
  )
  const { rows: [automations] } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM automations WHERE company_id = $1 AND is_active = true',
    [companyId]
  )
  const { rows: [connectors] } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM connectors WHERE company_id = $1 AND status = 'connected'",
    [companyId]
  )

  const limits = getPlanLimits(plan)

  return {
    messagesUsed: messages.count,
    messagesLimit: limits.messagesPerMonth,
    automations: automations.count,
    connectorsUsed: connectors.count,
    connectorsLimit: limits.maxConnectors,
    features: limits.features,
  }
}

export async function updateProfile(userId, companyId, { fullName, avatar, companyName, companyType, language, timezone, notificationPrefs, aiPreferences }) {
  if (fullName !== undefined || avatar !== undefined) {
    await pool.query(
      'UPDATE users SET full_name = COALESCE($2, full_name), avatar = COALESCE($3, avatar) WHERE id = $1',
      [userId, fullName ?? null, avatar ?? null]
    )
  }
  if (companyId && (companyName !== undefined || companyType !== undefined || language !== undefined || timezone !== undefined || notificationPrefs !== undefined || aiPreferences !== undefined)) {
    await pool.query(
      `UPDATE companies SET
         company_name = COALESCE($2, company_name),
         company_type = COALESCE($3, company_type),
         language = COALESCE($4, language),
         timezone = COALESCE($5, timezone),
         notification_prefs = COALESCE($6, notification_prefs),
         ai_preferences = COALESCE($7, ai_preferences)
       WHERE id = $1`,
      [companyId, companyName ?? null, companyType ?? null, language ?? null, timezone ?? null, notificationPrefs ? JSON.stringify(notificationPrefs) : null, aiPreferences ? JSON.stringify(aiPreferences) : null]
    )
  }
}

export async function deleteAccount(userId) {
  // ON DELETE CASCADE on every foreign key rooted at users/companies takes
  // care of conversations, messages, connectors, automations, etc.
  await pool.query('DELETE FROM users WHERE id = $1', [userId])
}
