import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { requireAuth } from '../../middleware/auth.js'
import { HttpError } from '../../middleware/errorHandler.js'
import * as automationsService from './automations.service.js'

export const automationsRouter = Router()

automationsRouter.use(requireAuth)

automationsRouter.get('/', asyncHandler(async (req, res) => {
  if (!req.company) return res.json({ automations: [] })
  res.json({ automations: await automationsService.list(req.company.id) })
}))

automationsRouter.post('/', asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  const automation = await automationsService.create(req.company.id, req.body)
  res.status(201).json({ automation })
}))

automationsRouter.put('/:id', asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  const automation = await automationsService.update(req.company.id, req.params.id, req.body)
  res.json({ automation })
}))

automationsRouter.delete('/:id', asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  await automationsService.remove(req.company.id, req.params.id)
  res.status(204).end()
}))
