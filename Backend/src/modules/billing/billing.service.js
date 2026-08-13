import { pool } from '../../db/pool.js'
import { HttpError } from '../../middleware/errorHandler.js'
import { getPaddle } from './paddle.client.js'

export const PLAN_CATALOG = [
  { id: 'starter', priceId: process.env.PADDLE_PRICE_STARTER, price: 29 },
  { id: 'pro', priceId: process.env.PADDLE_PRICE_PRO, price: 79 },
  { id: 'business', priceId: process.env.PADDLE_PRICE_BUSINESS, price: 199 },
]

function planForPriceId(priceId) {
  return PLAN_CATALOG.find((p) => p.priceId === priceId)?.id || 'starter'
}

/**
 * Paddle checkout runs client-side via Paddle.js (the overlay), unlike
 * Stripe's server-created redirect session — the backend just hands the
 * frontend the price id and its own public client token.
 */
export function getCheckoutConfig(planId) {
  const plan = PLAN_CATALOG.find((p) => p.id === planId)
  if (!plan || !plan.priceId) throw new HttpError(400, 'Plan invalide ou prix Paddle non configuré pour ce plan.')
  if (!process.env.PADDLE_CLIENT_TOKEN) throw new HttpError(503, "Paddle n'est pas configuré côté serveur (PADDLE_CLIENT_TOKEN manquant).")

  return {
    priceId: plan.priceId,
    clientToken: process.env.PADDLE_CLIENT_TOKEN,
    environment: process.env.PADDLE_ENV === 'production' ? 'production' : 'sandbox',
  }
}

/**
 * A company that already has an active Paddle subscription changes plan by
 * updating that subscription's price directly — no new checkout needed.
 */
export async function changePlan(company, planId) {
  const paddle = getPaddle()
  if (!paddle) throw new HttpError(503, "Paddle n'est pas configuré côté serveur.")
  if (!company.paddleSubscriptionId) throw new HttpError(400, "Aucun abonnement Paddle actif — utilise le paiement pour t'abonner d'abord.")

  const plan = PLAN_CATALOG.find((p) => p.id === planId)
  if (!plan || !plan.priceId) throw new HttpError(400, 'Plan invalide ou prix Paddle non configuré pour ce plan.')

  await paddle.subscriptions.update(company.paddleSubscriptionId, {
    items: [{ priceId: plan.priceId, quantity: 1 }],
    prorationBillingMode: 'prorated_immediately',
  })
}

export async function getManagementUrl(company) {
  const paddle = getPaddle()
  if (!paddle) throw new HttpError(503, "Paddle n'est pas configuré côté serveur.")
  if (!company.paddleSubscriptionId) throw new HttpError(400, 'Aucun abonnement Paddle actif pour cette entreprise.')

  const subscription = await paddle.subscriptions.get(company.paddleSubscriptionId)
  return subscription.managementUrls?.updatePaymentMethod || subscription.managementUrls?.cancel || null
}

export async function getInvoices(company) {
  const paddle = getPaddle()
  if (!paddle || !company.paddleCustomerId) return []

  const transactions = paddle.transactions.list({ customerId: [company.paddleCustomerId], perPage: 20, status: ['completed', 'paid', 'billed', 'past_due'] })
  const items = []
  for await (const tx of transactions) {
    let hostedUrl = null
    try {
      const pdf = await paddle.transactions.getInvoicePDF(tx.id)
      hostedUrl = pdf.url
    } catch {
      // Not every transaction has an invoice (e.g. zero-value/trial) — skip the link, keep the row.
    }
    items.push({
      id: tx.id,
      date: tx.billedAt || tx.createdAt,
      amount: tx.details?.totals?.total ? (Number(tx.details.totals.total) / 100).toFixed(2) : '0.00',
      currency: tx.currencyCode,
      status: tx.status === 'completed' || tx.status === 'paid' ? 'paid' : tx.status,
      hostedUrl,
    })
  }
  return items
}

async function applySubscriptionUpsert(subscription) {
  const priceId = subscription.items?.[0]?.price?.id
  const plan = planForPriceId(priceId)
  // First event for a subscription (subscription.created) only has the
  // company id via customData; every later event (renewals, plan changes)
  // matches by the subscription id already saved on the company row.
  const companyId = subscription.customData?.companyId || null
  const { rowCount } = await pool.query(
    `UPDATE companies SET plan = $1, paddle_subscription_id = $2, paddle_customer_id = $3, subscription_status = $4
     WHERE paddle_subscription_id = $2 OR id = $5`,
    [plan, subscription.id, subscription.customerId, subscription.status, companyId]
  )
  if (rowCount === 0) {
    console.error(`[paddle] Webhook pour l'abonnement ${subscription.id} : aucune entreprise correspondante (customData.companyId=${companyId}).`)
  }
}

async function applySubscriptionCanceled(subscription) {
  await pool.query(
    "UPDATE companies SET plan = 'starter', subscription_status = 'canceled' WHERE paddle_subscription_id = $1",
    [subscription.id]
  )
}

export async function verifyAndParseWebhook(rawBody, signature) {
  const paddle = getPaddle()
  if (!paddle) throw new HttpError(503, "Paddle n'est pas configuré côté serveur.")
  if (!process.env.PADDLE_WEBHOOK_SECRET) throw new HttpError(503, "PADDLE_WEBHOOK_SECRET manquant côté serveur.")
  return paddle.webhooks.unmarshal(rawBody, process.env.PADDLE_WEBHOOK_SECRET, signature)
}

export async function handleWebhookEvent(event) {
  switch (event.eventType) {
    case 'subscription.created':
    case 'subscription.updated':
      await applySubscriptionUpsert(event.data)
      break
    case 'subscription.canceled':
      await applySubscriptionCanceled(event.data)
      break
    default:
      break
  }
}
