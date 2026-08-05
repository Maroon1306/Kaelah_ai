import { Router } from 'express'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { requireAuth } from '../../../middleware/auth.js'
import { HttpError } from '../../../middleware/errorHandler.js'
import { pool } from '../../../db/pool.js'
import { assertCanConnectProvider } from '../../../config/plans.js'
import * as drupal from './drupal.service.js'

export const drupalRouter = Router()

// Public: called server-to-server by the "Kaelah AI Connector" Drupal module right
// after the user approves the connection on Kaelah's consent screen.
drupalRouter.post('/oauth/token', asyncHandler(async (req, res) => {
  const { code, siteUrl, siteName } = req.body
  if (!code || !siteUrl) throw new HttpError(400, 'Paramètres manquants (code, siteUrl).')
  const { accessToken } = await drupal.exchangeCodeForToken(code, siteUrl, siteName)
  res.json({ ok: true, accessToken })
}))

drupalRouter.use(requireAuth)

drupalRouter.post('/oauth/consent', asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  await assertCanConnectProvider(pool, req.company, 'drupal')
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

  const code = drupal.createAuthorizationCode(req.company.id, siteUrl)
  parsedCallback.searchParams.set('code', code)
  res.json({ redirectUrl: parsedCallback.toString() })
}))
