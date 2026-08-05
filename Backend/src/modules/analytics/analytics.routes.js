import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { requireAuth } from '../../middleware/auth.js'
import * as analyticsService from './analytics.service.js'

export const analyticsRouter = Router()

analyticsRouter.use(requireAuth)

analyticsRouter.get('/overview', asyncHandler(async (req, res) => {
  if (!req.company) return res.json({ available: false })
  res.json(await analyticsService.getOverview(req.company.id))
}))

analyticsRouter.get('/sales', asyncHandler(async (req, res) => {
  if (!req.company) return res.json({ history: [] })
  const history = await analyticsService.getSnapshotHistory(req.company.id)
  res.json({ history })
}))

analyticsRouter.get('/seo', asyncHandler(async (req, res) => {
  if (!req.company) return res.json({ available: false })
  res.json(await analyticsService.getSeoOverview(req.company.id))
}))
