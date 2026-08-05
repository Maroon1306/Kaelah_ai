import { Router } from 'express'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { requireAuth } from '../../../middleware/auth.js'
import { HttpError } from '../../../middleware/errorHandler.js'
import { planHasFeature } from '../../../config/plans.js'
import * as gsc from './googlesearchconsole.service.js'

export const googleSearchConsoleRouter = Router()

// Public: Google redirects the merchant's browser here after they approve
// access, carrying the authorization code and our signed state.
googleSearchConsoleRouter.get('/callback', asyncHandler(async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  try {
    const { code, state } = req.query
    if (!code || !state) throw new HttpError(400, 'Callback Google incomplet.')

    const { companyId } = gsc.verifyState(String(state))
    const tokenData = await gsc.exchangeCodeForToken(String(code))
    if (!tokenData.refresh_token) {
      // Happens if the user already granted access before and Google didn't
      // re-issue a refresh token — ask them to revoke access and retry so
      // `prompt=consent` forces a fresh one next time.
      throw new HttpError(400, "Google n'a pas renvoyé de jeton de rafraîchissement. Révoque l'accès de Kaelah AI dans ton compte Google (myaccount.google.com/permissions) puis reconnecte-toi.")
    }
    await gsc.saveConnector(companyId, { accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token })

    res.redirect(`${frontendUrl}/settings?tab=connectors&connected=google_search_console`)
  } catch (err) {
    console.error(err)
    res.redirect(`${frontendUrl}/settings?tab=connectors&error=google_search_console`)
  }
}))

googleSearchConsoleRouter.use(requireAuth)

googleSearchConsoleRouter.get('/install', (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  if (!planHasFeature(req.company.plan, 'google_search_console')) {
    throw new HttpError(402, "Le suivi Google Search Console n'est pas inclus dans ton forfait actuel. Passe au forfait Pro pour le débloquer.")
  }
  res.json({ url: gsc.buildAuthUrl({ companyId: req.company.id }) })
})
