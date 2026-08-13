import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { requireAuth } from '../../middleware/auth.js'
import { HttpError } from '../../middleware/errorHandler.js'
import { pool } from '../../db/pool.js'

export const feedbackRouter = Router()

feedbackRouter.use(requireAuth)

feedbackRouter.post('/', asyncHandler(async (req, res) => {
  const { message } = req.body
  if (!message || !message.trim()) throw new HttpError(400, 'Message requis.')

  await pool.query(
    'INSERT INTO feedback (user_id, company_id, message) VALUES ($1, $2, $3)',
    [req.user.id, req.company?.id || null, message.trim()]
  )
  res.status(201).json({ ok: true })
}))
