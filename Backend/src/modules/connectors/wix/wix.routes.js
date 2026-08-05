import { Router } from 'express'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { requireAuth } from '../../../middleware/auth.js'
import { HttpError } from '../../../middleware/errorHandler.js'
import { pool } from '../../../db/pool.js'
import { assertCanConnectProvider } from '../../../config/plans.js'
import * as wix from './wix.service.js'

export const wixRouter = Router()

// Public: Wix redirects the merchant's browser here (this is the
// `postInstallationUrl` passed on the external-install link) right after
// they add the app to their site, carrying a signed instance we verify
// ourselves — no separate authorization-code exchange needed.
wixRouter.get('/callback', asyncHandler(async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  try {
    const signedInstance = req.query.signedInstance
    if (!signedInstance) throw new HttpError(400, 'Callback Wix incomplet.')

    const { instanceId, siteDisplayName } = wix.verifySignedInstance(String(signedInstance))
    const claim = wix.createClaimToken({ instanceId, siteDisplayName })
    const label = siteDisplayName || instanceId
    res.redirect(`${frontendUrl}/connect/wix?claim=${encodeURIComponent(claim)}&store=${encodeURIComponent(label)}`)
  } catch (err) {
    console.error(err)
    res.redirect(`${frontendUrl}/settings?tab=connectors&error=wix`)
  }
}))

// Public: Wix's "App Instance Removed" webhook.
wixRouter.post('/uninstall', asyncHandler(async (req, res) => {
  const instanceId = req.body?.instanceId || req.body?.data?.instanceId
  if (instanceId) await wix.disconnectByInstanceId(instanceId)
  res.status(200).end()
}))

wixRouter.use(requireAuth)

// Kaelah-initiated external install link — the merchant never has to find
// this app in the App Market search themselves. Until the app is submitted
// and approved for the App Market, it's "unlisted" and the install URL must
// carry a shareUrlId (from the app dashboard's Share Install Link) — see
// WIX_SHARE_URL_ID in .env.example. Once the app is listed, this can be
// dropped.
wixRouter.get('/install', (req, res) => {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000'
  const params = new URLSearchParams({
    appId: process.env.WIX_APP_ID,
    postInstallationUrl: `${backendUrl}/api/connectors/wix/callback`,
  })
  if (process.env.WIX_SHARE_URL_ID) {
    params.set('shareUrlId', process.env.WIX_SHARE_URL_ID)
  }
  res.json({ url: `https://www.wix.com/app-installer?${params.toString()}` })
})

// Called by Kaelah's own /connect/wix consent page once the logged-in user
// approves attaching the just-installed site to their company.
wixRouter.post('/claim', asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  await assertCanConnectProvider(pool, req.company, 'wix')
  const { claim } = req.body
  if (!claim) throw new HttpError(400, 'Jeton de connexion manquant.')

  const { instanceId, siteDisplayName } = wix.verifyClaimToken(claim)
  const catalogVersion = await wix.detectCatalogVersion(instanceId)
  await wix.saveConnector(req.company.id, { instanceId, siteDisplayName, catalogVersion })
  res.json({ ok: true, catalogVersion })
}))
