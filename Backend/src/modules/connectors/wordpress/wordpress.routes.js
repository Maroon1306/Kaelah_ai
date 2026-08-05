import { Router } from 'express'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { requireAuth } from '../../../middleware/auth.js'
import { HttpError } from '../../../middleware/errorHandler.js'
import { pool } from '../../../db/pool.js'
import { assertCanConnectProvider } from '../../../config/plans.js'
import * as wordpress from './wordpress.service.js'

export const wordpressRouter = Router()

// Public: called server-to-server by the "Kaelah AI Connector" plugin right after
// the user approves the connection on Kaelah's consent screen. No Kaelah session
// is available here — only the short-lived authorization code from the redirect.
wordpressRouter.post('/oauth/token', asyncHandler(async (req, res) => {
  const { code, siteUrl, siteName } = req.body
  if (!code || !siteUrl) throw new HttpError(400, 'Paramètres manquants (code, siteUrl).')
  const { accessToken } = await wordpress.exchangeCodeForToken(code, siteUrl, siteName)
  res.json({ ok: true, accessToken })
}))

wordpressRouter.use(requireAuth)

// Called by Kaelah's own consent page after the logged-in user clicks "Autoriser".
// Returns the URL the browser should be sent back to (the plugin's own callback
// endpoint on the user's site), carrying a short-lived authorization code.
wordpressRouter.post('/oauth/consent', asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  await assertCanConnectProvider(pool, req.company, 'wordpress')
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

  const code = wordpress.createAuthorizationCode(req.company.id, siteUrl)
  parsedCallback.searchParams.set('code', code)
  res.json({ redirectUrl: parsedCallback.toString() })
}))
