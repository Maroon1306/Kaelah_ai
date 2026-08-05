import { Router } from 'express'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { requireAuth } from '../../../middleware/auth.js'
import { HttpError } from '../../../middleware/errorHandler.js'
import { pool } from '../../../db/pool.js'
import { assertCanConnectProvider } from '../../../config/plans.js'
import * as shopify from './shopify.service.js'

export const shopifyRouter = Router()

shopifyRouter.get('/install', requireAuth, asyncHandler(async (req, res) => {
  const { shop } = req.query
  if (!shop || !/^[a-zA-Z0-9-]+\.myshopify\.com$/.test(shop)) {
    throw new HttpError(400, 'Domaine de boutique Shopify invalide (attendu: monshop.myshopify.com).')
  }
  if (!req.company) throw new HttpError(400, "Aucune entreprise associée à ce compte.")
  await assertCanConnectProvider(pool, req.company, 'shopify')
  const url = shopify.buildAuthUrl({ shop, companyId: req.company.id })
  res.json({ url })
}))

shopifyRouter.get('/callback', asyncHandler(async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  try {
    const { shop, code, state } = req.query
    if (!shop || !code || !state) throw new HttpError(400, 'Callback Shopify incomplet.')
    if (!shopify.verifyHmac(req.query)) throw new HttpError(401, 'Signature Shopify invalide.')

    const { companyId } = shopify.verifyState(state)
    const tokenData = await shopify.exchangeCodeForToken(shop, code)
    await shopify.saveConnector(companyId, shop, tokenData)

    const connector = { config: { shopDomain: shop, accessToken: tokenData.access_token } }
    const webhookAddress = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/webhooks/shopify`
    await shopify.registerWebhook(connector, 'products/create', webhookAddress)

    res.redirect(`${frontendUrl}/settings?tab=connectors&connected=shopify`)
  } catch (err) {
    console.error(err)
    res.redirect(`${frontendUrl}/settings?tab=connectors&error=shopify`)
  }
}))
