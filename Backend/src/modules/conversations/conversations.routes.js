import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { requireAuth } from '../../middleware/auth.js'
import { HttpError } from '../../middleware/errorHandler.js'
import * as conversations from './conversations.service.js'
import * as actionsService from './actions.service.js'
import { handleChatMessage } from '../../ai/kaelah.orchestrator.js'

export const conversationsRouter = Router()
export const chatRouter = Router()
export const actionsRouter = Router()

conversationsRouter.use(requireAuth)
chatRouter.use(requireAuth)
actionsRouter.use(requireAuth)

conversationsRouter.get('/', asyncHandler(async (req, res) => {
  if (!req.company) return res.json({ conversations: [] })
  const rows = await conversations.listConversations(req.company.id)
  res.json({ conversations: rows })
}))

conversationsRouter.get('/:id', asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  const conversation = await conversations.getConversationWithMessages(req.company.id, req.params.id)
  res.json({ conversation })
}))

chatRouter.post('/', asyncHandler(async (req, res) => {
  const { message, conversationId } = req.body
  if (!message || !message.trim()) throw new HttpError(400, 'Un message est requis.')
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')

  const result = await handleChatMessage({ companyId: req.company.id, plan: req.company.plan, subscriptionStatus: req.company.subscriptionStatus, autoActions: !!req.company.aiPreferences?.autoActions, conversationId, text: message })
  res.json(result)
}))

actionsRouter.get('/recent', asyncHandler(async (req, res) => {
  if (!req.company) return res.json({ actions: [] })
  const actions = await actionsService.getRecentActions(req.company.id)
  res.json({ actions })
}))

actionsRouter.post('/:id/confirm', asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  const result = await actionsService.confirmAction(req.params.id, req.company.id)
  res.json(result)
}))

actionsRouter.post('/:id/reject', asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  await actionsService.rejectAction(req.params.id, req.company.id)
  res.status(204).end()
}))
