import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { requireAuth } from '../../middleware/auth.js'
import { HttpError } from '../../middleware/errorHandler.js'
import { generateWeeklyReport, sendWeeklyReport } from './reports.service.js'

export const reportsRouter = Router()

reportsRouter.use(requireAuth)

reportsRouter.get('/weekly', asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  res.json(await generateWeeklyReport(req.company.id))
}))

reportsRouter.post('/weekly/send', asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  res.json(await sendWeeklyReport(req.company.id))
}))
