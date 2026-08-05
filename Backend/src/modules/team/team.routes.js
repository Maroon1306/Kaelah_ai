import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { requireAuth } from '../../middleware/auth.js'
import { pool } from '../../db/pool.js'

export const teamRouter = Router()

teamRouter.use(requireAuth)

teamRouter.get('/', asyncHandler(async (req, res) => {
  if (!req.company) return res.json({ members: [] })
  const { rows } = await pool.query(
    `SELECT cm.id, cm.email, cm.role, cm.status, cm.invited_at, u.full_name
     FROM company_members cm
     LEFT JOIN users u ON u.id = cm.user_id
     WHERE cm.company_id = $1 ORDER BY cm.invited_at ASC`,
    [req.company.id]
  )
  res.json({ members: rows })
}))

// Multi-seat invites are not part of the current product spec yet — kept as a
// clear "not available" response instead of silently pretending to invite someone.
teamRouter.post('/invite', asyncHandler(async (req, res) => {
  res.status(501).json({ error: "L'invitation d'équipe arrive bientôt." })
}))
