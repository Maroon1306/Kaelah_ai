import { verifyAccessToken } from '../utils/jwt.js'
import { pool } from '../db/pool.js'

export async function requireAdminAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) return res.status(401).json({ error: 'Authentification admin requise.' })

  try {
    const payload = verifyAccessToken(token)
    if (payload.scope !== 'admin') return res.status(403).json({ error: 'Accès admin refusé.' })

    const { rows } = await pool.query('SELECT id, email FROM admin_users WHERE id = $1', [payload.sub])
    if (rows.length === 0) return res.status(401).json({ error: 'Administrateur introuvable.' })

    req.admin = { id: rows[0].id, email: rows[0].email }
    next()
  } catch {
    return res.status(401).json({ error: 'Session admin invalide ou expirée.' })
  }
}
