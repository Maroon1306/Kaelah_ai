import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { requireAuth } from '../../middleware/auth.js'
import { HttpError } from '../../middleware/errorHandler.js'
import * as teamService from './team.service.js'

export const teamRouter = Router()

teamRouter.use(requireAuth)

teamRouter.get('/', asyncHandler(async (req, res) => {
  if (!req.company) return res.json({ members: [] })
  res.json({ members: await teamService.listMembers(req.company.id) })
}))

teamRouter.post('/invite', asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  const { email, role } = req.body
  const member = await teamService.inviteMember(req.company, req.user.fullName, email, role || 'collaborator')
  res.status(201).json({ member })
}))

teamRouter.post('/accept', asyncHandler(async (req, res) => {
  const { token } = req.body
  if (!token) throw new HttpError(400, 'Jeton manquant.')
  const result = await teamService.acceptInvite(token, req.user)
  res.json({ ok: true, companyId: result.companyId })
}))

teamRouter.delete('/:id', asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  await teamService.removeMember(req.company.id, req.params.id)
  res.status(204).end()
}))
