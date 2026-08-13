import { pool } from '../../db/pool.js'
import { HttpError } from '../../middleware/errorHandler.js'
import { hashPassword, comparePassword } from '../../utils/password.js'
import { signAdminAccessToken } from '../../utils/jwt.js'
import { PLAN_CATALOG } from '../billing/billing.service.js'
import { getPaddle } from '../billing/paddle.client.js'

export async function login(email, password) {
  const { rows } = await pool.query('SELECT id, email, password_hash FROM admin_users WHERE email = $1', [email])
  if (rows.length === 0) throw new HttpError(401, 'Identifiants invalides.')

  const admin = rows[0]
  const valid = await comparePassword(password, admin.password_hash)
  if (!valid) throw new HttpError(401, 'Identifiants invalides.')

  const accessToken = signAdminAccessToken(admin)
  return { accessToken, admin: { id: admin.id, email: admin.email } }
}

export async function changePassword(adminId, currentPassword, newPassword) {
  const { rows } = await pool.query('SELECT password_hash FROM admin_users WHERE id = $1', [adminId])
  if (rows.length === 0) throw new HttpError(404, 'Administrateur introuvable.')

  const valid = await comparePassword(currentPassword, rows[0].password_hash)
  if (!valid) throw new HttpError(401, 'Mot de passe actuel incorrect.')

  const passwordHash = await hashPassword(newPassword)
  await pool.query('UPDATE admin_users SET password_hash = $2 WHERE id = $1', [adminId, passwordHash])
}

export async function listUsers() {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.email_verified, u.created_at,
            c.company_name, c.plan, c.subscription_status
     FROM users u
     LEFT JOIN companies c ON c.user_id = u.id
     ORDER BY u.created_at DESC`
  )
  return rows
}

export async function listFeedback() {
  const { rows } = await pool.query(
    `SELECT f.id, f.message, f.created_at, u.full_name, u.email, c.company_name
     FROM feedback f
     LEFT JOIN users u ON u.id = f.user_id
     LEFT JOIN companies c ON c.id = f.company_id
     ORDER BY f.created_at DESC
     LIMIT 200`
  )
  return rows
}

function planPrice(planId) {
  return PLAN_CATALOG.find((p) => p.id === planId)?.price || 0
}

export async function getStats() {
  const { rows: companies } = await pool.query(
    'SELECT plan, subscription_status, paddle_subscription_id, created_at FROM companies'
  )
  const { rows: [{ count: totalUsers }] } = await pool.query('SELECT COUNT(*)::int AS count FROM users')

  const planBreakdown = { starter: 0, pro: 0, business: 0 }
  let mrr = 0
  for (const c of companies) {
    planBreakdown[c.plan] = (planBreakdown[c.plan] || 0) + 1
    if (c.paddle_subscription_id && c.subscription_status === 'active') mrr += planPrice(c.plan)
  }

  // Signups per week for the last 10 weeks — enough for a small histogram
  // without dragging in a charting library on the backend.
  const weeks = []
  for (let i = 9; i >= 0; i--) {
    const start = new Date()
    start.setDate(start.getDate() - i * 7 - start.getDay())
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    const count = companies.filter((c) => new Date(c.created_at) >= start && new Date(c.created_at) < end).length
    weeks.push({ weekStart: start.toISOString(), count })
  }

  return {
    totalUsers,
    totalCompanies: companies.length,
    planBreakdown,
    mrr,
    signupsByWeek: weeks,
  }
}

export async function listPayments() {
  const paddle = getPaddle()
  if (!paddle) return []

  const { rows: companies } = await pool.query('SELECT id, company_name, paddle_customer_id FROM companies WHERE paddle_customer_id IS NOT NULL')
  const companyByCustomer = new Map(companies.map((c) => [c.paddle_customer_id, c.company_name]))

  const transactions = paddle.transactions.list({ perPage: 50, status: ['completed', 'paid', 'billed'] })
  const items = []
  for await (const tx of transactions) {
    items.push({
      id: tx.id,
      companyName: companyByCustomer.get(tx.customerId) || tx.customerId || '—',
      date: tx.billedAt || tx.createdAt,
      amount: tx.details?.totals?.total ? (Number(tx.details.totals.total) / 100).toFixed(2) : '0.00',
      currency: tx.currencyCode,
      status: tx.status,
    })
    if (items.length >= 50) break
  }
  return items
}
