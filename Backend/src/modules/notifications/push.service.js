import webpush from 'web-push'
import { pool } from '../../db/pool.js'

let configured = false

function ensureConfigured() {
  if (configured) return true
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@kaelah.ai', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
  configured = true
  return true
}

export function getPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null
}

export async function saveSubscription(userId, subscription) {
  const { endpoint, keys } = subscription
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth = $4`,
    [userId, endpoint, keys.p256dh, keys.auth]
  )
}

export async function removeSubscription(userId, endpoint) {
  await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2', [userId, endpoint])
}

/**
 * Sends a push notification to every device a user has subscribed on.
 * Silently drops subscriptions the browser has revoked (410/404) so they
 * don't pile up and keep failing forever.
 */
export async function sendPushToUser(userId, payload) {
  if (!ensureConfigured()) return { sent: false, reason: 'vapid_not_configured' }

  const { rows } = await pool.query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1', [userId])
  let sent = 0
  for (const sub of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
      sent += 1
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id])
      } else {
        console.error('[push] Échec envoi notification:', err.message)
      }
    }
  }
  return { sent: sent > 0, count: sent }
}

/**
 * Push variant of sendMail's company-wide fan-out: notifies every active
 * member of a company who has push enabled, not just the owner.
 */
export async function sendPushToCompany(companyId, payload) {
  const { rows } = await pool.query(
    `SELECT DISTINCT u.id FROM users u
     LEFT JOIN companies owned ON owned.user_id = u.id
     LEFT JOIN company_members cm ON cm.user_id = u.id AND cm.status = 'active'
     WHERE owned.id = $1 OR cm.company_id = $1`,
    [companyId]
  )
  for (const row of rows) {
    await sendPushToUser(row.id, payload)
  }
}
