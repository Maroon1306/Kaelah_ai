import Stripe from 'stripe'
import { pool } from '../../db/pool.js'
import { HttpError } from '../../middleware/errorHandler.js'

let stripeClient = null
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY)
  return stripeClient
}

export const PLAN_CATALOG = [
  { id: 'starter', priceId: process.env.STRIPE_PRICE_STARTER, price: 29 },
  { id: 'pro', priceId: process.env.STRIPE_PRICE_PRO, price: 79 },
  { id: 'business', priceId: process.env.STRIPE_PRICE_BUSINESS, price: 199 },
]

function planForPriceId(priceId) {
  return PLAN_CATALOG.find((p) => p.priceId === priceId)?.id || 'starter'
}

export async function createCheckoutSession(company, userEmail, planId) {
  const stripe = getStripe()
  if (!stripe) throw new HttpError(503, "Stripe n'est pas configuré côté serveur (STRIPE_SECRET_KEY manquant).")

  const plan = PLAN_CATALOG.find((p) => p.id === planId)
  if (!plan || !plan.priceId) throw new HttpError(400, 'Plan invalide ou prix Stripe non configuré pour ce plan.')

  let customerId = company.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({ email: userEmail, metadata: { companyId: company.id } })
    customerId = customer.id
    await pool.query('UPDATE companies SET stripe_customer_id = $1 WHERE id = $2', [customerId, company.id])
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}/settings?tab=billing&checkout=success`,
    cancel_url: `${process.env.FRONTEND_URL}/settings?tab=billing&checkout=cancelled`,
  })
  return session.url
}

export async function createPortalSession(company) {
  const stripe = getStripe()
  if (!stripe) throw new HttpError(503, "Stripe n'est pas configuré côté serveur.")
  if (!company.stripeCustomerId) throw new HttpError(400, "Aucun abonnement Stripe actif pour cette entreprise.")

  const session = await stripe.billingPortal.sessions.create({
    customer: company.stripeCustomerId,
    return_url: `${process.env.FRONTEND_URL}/settings?tab=billing`,
  })
  return session.url
}

export async function getInvoices(company) {
  const stripe = getStripe()
  if (!stripe || !company.stripeCustomerId) return []
  const invoices = await stripe.invoices.list({ customer: company.stripeCustomerId, limit: 20 })
  return invoices.data.map((inv) => ({
    id: inv.id,
    date: new Date(inv.created * 1000).toISOString(),
    amount: (inv.amount_paid / 100).toFixed(2),
    currency: inv.currency,
    status: inv.status,
    hostedUrl: inv.hosted_invoice_url,
  }))
}

export function constructWebhookEvent(rawBody, signature) {
  const stripe = getStripe()
  if (!stripe) throw new HttpError(503, "Stripe n'est pas configuré côté serveur.")
  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)
}

export async function applySubscriptionUpdate(subscription) {
  const stripe = getStripe()
  const priceId = subscription.items.data[0]?.price?.id
  const plan = planForPriceId(priceId)
  await pool.query(
    'UPDATE companies SET plan = $1, stripe_subscription_id = $2, subscription_status = $3 WHERE stripe_customer_id = $4',
    [plan, subscription.id, subscription.status, subscription.customer]
  )
}

export async function applySubscriptionDeleted(subscription) {
  await pool.query(
    "UPDATE companies SET plan = 'starter', subscription_status = 'canceled' WHERE stripe_customer_id = $1",
    [subscription.customer]
  )
}

export async function handleWebhookEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const stripe = getStripe()
      const session = event.data.object
      if (session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription)
        await applySubscriptionUpdate(subscription)
      }
      break
    }
    case 'customer.subscription.updated':
      await applySubscriptionUpdate(event.data.object)
      break
    case 'customer.subscription.deleted':
      await applySubscriptionDeleted(event.data.object)
      break
    default:
      break
  }
}
