import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { requireAdminAuth } from '../../middleware/adminAuth.js'
import { HttpError } from '../../middleware/errorHandler.js'
import * as adminService from './admin.service.js'

export const adminRouter = Router()

adminRouter.post('/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) throw new HttpError(400, 'Email et mot de passe requis.')
  res.json(await adminService.login(email, password))
}))

adminRouter.use(requireAdminAuth)

adminRouter.get('/auth/me', (req, res) => res.json({ admin: req.admin }))

adminRouter.put('/auth/password', asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) throw new HttpError(400, 'Mot de passe actuel et nouveau mot de passe requis.')
  if (newPassword.length < 8) throw new HttpError(400, 'Le nouveau mot de passe doit contenir au moins 8 caractères.')
  await adminService.changePassword(req.admin.id, currentPassword, newPassword)
  res.status(204).end()
}))

adminRouter.get('/users', asyncHandler(async (req, res) => {
  res.json({ users: await adminService.listUsers() })
}))

adminRouter.get('/feedback', asyncHandler(async (req, res) => {
  res.json({ feedback: await adminService.listFeedback() })
}))

adminRouter.get('/stats', asyncHandler(async (req, res) => {
  res.json(await adminService.getStats())
}))

adminRouter.get('/payments', asyncHandler(async (req, res) => {
  res.json({ payments: await adminService.listPayments() })
}))
