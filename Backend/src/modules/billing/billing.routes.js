import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { requireAuth } from '../../middleware/auth.js'
import { HttpError } from '../../middleware/errorHandler.js'
import * as billingService from './billing.service.js'

export const billingRouter = Router()
export const billingWebhookRouter = Router()

billingRouter.get('/plans', (req, res) => {
  res.json({ plans: billingService.PLAN_CATALOG.map(({ id, price }) => ({ id, price })) })
})

billingRouter.use(requireAuth)

// New subscription: the frontend opens the Paddle.js overlay itself with
// this config — there's no server-created redirect session like Stripe.
billingRouter.post('/checkout', asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  const { planId } = req.body
  const config = billingService.getCheckoutConfig(planId)
  res.json({ ...config, customerEmail: req.user.email, companyId: req.company.id })
}))

// Existing subscription: change the price directly via the API instead of
// reopening the checkout overlay.
billingRouter.post('/change-plan', asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  const { planId } = req.body
  await billingService.changePlan(req.company, planId)
  res.json({ ok: true })
}))

billingRouter.post('/portal', asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  const url = await billingService.getManagementUrl(req.company)
  res.json({ url })
}))

billingRouter.get('/invoices', asyncHandler(async (req, res) => {
  if (!req.company) return res.json({ invoices: [] })
  res.json({ invoices: await billingService.getInvoices(req.company) })
}))

// Mounted directly at /api/billing/webhook with express.raw() in app.js —
// Paddle signature verification needs the raw body, so the route here is
// "/" (the mount point already supplies the full "/webhook" path).
billingWebhookRouter.post('/', asyncHandler(async (req, res) => {
  const signature = req.get('paddle-signature')
  let event
  try {
    event = await billingService.verifyAndParseWebhook(req.body.toString(), signature)
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`)
  }
  await billingService.handleWebhookEvent(event)
  res.json({ received: true })
}))
