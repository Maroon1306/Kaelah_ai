import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { requireAuth } from '../../middleware/auth.js'
import { HttpError } from '../../middleware/errorHandler.js'
import * as pushService from './push.service.js'

export const notificationsRouter = Router()

notificationsRouter.get('/push/public-key', (req, res) => {
  res.json({ publicKey: pushService.getPublicKey() })
})

notificationsRouter.use(requireAuth)

notificationsRouter.post('/push/subscribe', asyncHandler(async (req, res) => {
  const { subscription } = req.body
  if (!subscription?.endpoint || !subscription?.keys) throw new HttpError(400, 'Abonnement push invalide.')
  await pushService.saveSubscription(req.user.id, subscription)
  res.status(201).json({ ok: true })
}))

notificationsRouter.post('/push/unsubscribe', asyncHandler(async (req, res) => {
  const { endpoint } = req.body
  if (!endpoint) throw new HttpError(400, 'Endpoint manquant.')
  await pushService.removeSubscription(req.user.id, endpoint)
  res.status(204).end()
}))

notificationsRouter.post('/push/test', asyncHandler(async (req, res) => {
  const result = await pushService.sendPushToUser(req.user.id, {
    title: 'Kaelah AI',
    body: 'Les notifications push fonctionnent — tu recevras ici tes rapports hebdomadaires.',
    url: '/chat',
  })
  res.json(result)
}))
