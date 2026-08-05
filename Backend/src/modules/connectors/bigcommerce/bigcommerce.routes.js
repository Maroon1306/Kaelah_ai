import { Router } from 'express'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { requireAuth } from '../../../middleware/auth.js'
import { HttpError } from '../../../middleware/errorHandler.js'
import { pool } from '../../../db/pool.js'
import { assertCanConnectProvider } from '../../../config/plans.js'
import * as bigcommerce from './bigcommerce.service.js'

export const bigcommerceRouter = Router()

// Public: BigCommerce redirects the merchant's browser here after they
// install the app from the marketplace (or a draft-app install link).
bigcommerceRouter.get('/callback', asyncHandler(async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  try {
    const { code, scope, context } = req.query
    if (!code || !context) throw new HttpError(400, 'Callback BigCommerce incomplet.')

    const tokenData = await bigcommerce.exchangeCodeForToken({ code, scope, context })
    const storeHash = String(context).replace(/^stores\//, '')
    const claim = bigcommerce.createClaimToken({ storeHash, accessToken: tokenData.access_token, scope: tokenData.scope })

    res.redirect(`${frontendUrl}/connect/bigcommerce?claim=${encodeURIComponent(claim)}&store=${encodeURIComponent(storeHash)}`)
  } catch (err) {
    console.error(err)
    res.redirect(`${frontendUrl}/settings?tab=connectors&error=bigcommerce`)
  }
}))

// Public: BigCommerce calls this when the app is removed from a store.
bigcommerceRouter.post('/uninstall', asyncHandler(async (req, res) => {
  const storeHash = req.query.context ? String(req.query.context).replace(/^stores\//, '') : null
  if (storeHash) await bigcommerce.disconnectByStoreHash(storeHash)
  res.status(200).end()
}))

// Public: opened (in an iframe) when the merchant clicks the app inside their
// BigCommerce control panel. Kaelah has no embedded iframe UI, so send them
// straight to the connectors screen — useful whether or not they're already
// logged in (ProtectedRoute bounces to /login otherwise, preserving the
// destination via the existing post-login redirect).
bigcommerceRouter.get('/load', (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?tab=connectors`)
})

bigcommerceRouter.use(requireAuth)

// Draft (unpublished) BigCommerce apps have no shareable install link: the
// merchant must be signed into their own store's control panel already,
// then go to Apps > Develop to install it themselves. This is BigCommerce's
// own stable deep-link to that exact screen.
bigcommerceRouter.get('/install', (req, res) => {
  res.json({ url: 'https://login.bigcommerce.com/deep-links/manage/marketplace/apps/develop' })
})

// Called by Kaelah's own /connect/bigcommerce consent page once the logged-in
// user approves attaching the just-installed store to their company.
bigcommerceRouter.post('/claim', asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  await assertCanConnectProvider(pool, req.company, 'bigcommerce')
  const { claim } = req.body
  if (!claim) throw new HttpError(400, 'Jeton de connexion manquant.')

  const { storeHash, accessToken, scope } = bigcommerce.verifyClaimToken(claim)
  await bigcommerce.saveConnector(req.company.id, { storeHash, accessToken, scope })
  res.json({ ok: true, storeHash })
}))
