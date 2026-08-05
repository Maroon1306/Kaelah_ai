import { Router } from 'express'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { requireAuth } from '../../../middleware/auth.js'
import { HttpError } from '../../../middleware/errorHandler.js'
import { pool } from '../../../db/pool.js'
import { assertCanConnectProvider } from '../../../config/plans.js'
import * as prestashop from './prestashop.service.js'

export const prestashopRouter = Router()

// Public: called server-to-server by the "Kaelah AI Connector" module right after
// the user approves the connection on Kaelah's consent screen. No Kaelah session
// is available here — only the short-lived authorization code from the redirect.
prestashopRouter.post('/oauth/token', asyncHandler(async (req, res) => {
  const { code, shopUrl, shopName } = req.body
  if (!code || !shopUrl) throw new HttpError(400, 'Paramètres manquants (code, shopUrl).')
  const { accessToken } = await prestashop.exchangeCodeForToken(code, shopUrl, shopName)
  res.json({ ok: true, accessToken })
}))

prestashopRouter.use(requireAuth)

// Called by Kaelah's own consent page after the logged-in user clicks "Autoriser".
// Returns the URL the browser should be sent back to (the module's own callback
// endpoint on the user's store), carrying a short-lived authorization code.
prestashopRouter.post('/oauth/consent', asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  await assertCanConnectProvider(pool, req.company, 'prestashop')
  const { siteUrl, callbackUrl } = req.body
  if (!siteUrl || !callbackUrl) throw new HttpError(400, 'Paramètres manquants (siteUrl, callbackUrl).')

  let parsedCallback
  try {
    parsedCallback = new URL(callbackUrl)
  } catch {
    throw new HttpError(400, 'URL de rappel invalide.')
  }
  let parsedSite
  try {
    parsedSite = new URL(siteUrl)
  } catch {
    throw new HttpError(400, 'URL du site invalide.')
  }
  if (parsedCallback.hostname !== parsedSite.hostname) {
    throw new HttpError(400, "L'URL de rappel ne correspond pas au site à connecter.")
  }

  const code = prestashop.createAuthorizationCode(req.company.id, siteUrl)
  parsedCallback.searchParams.set('code', code)
  res.json({ redirectUrl: parsedCallback.toString() })
}))
