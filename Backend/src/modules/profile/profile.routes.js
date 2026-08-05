import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { requireAuth } from '../../middleware/auth.js'
import * as profileService from './profile.service.js'

export const profileRouter = Router()

profileRouter.use(requireAuth)

profileRouter.get('/', asyncHandler(async (req, res) => {
  const usage = req.company ? await profileService.getUsage(req.company.id, req.company.plan) : { messagesUsed: 0, automations: 0, connectorsUsed: 0 }
  res.json({ user: req.user, company: req.company, usage })
}))

profileRouter.put('/', asyncHandler(async (req, res) => {
  await profileService.updateProfile(req.user.id, req.company?.id, req.body)
  res.json({ ok: true })
}))

profileRouter.delete('/', asyncHandler(async (req, res) => {
  await profileService.deleteAccount(req.user.id)
  res.status(204).end()
}))
