import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { requireAuth } from '../../middleware/auth.js'
import { HttpError } from '../../middleware/errorHandler.js'
import { pool } from '../../db/pool.js'
import { shopifyRouter } from './shopify/shopify.routes.js'
import { wordpressRouter } from './wordpress/wordpress.routes.js'
import { drupalRouter } from './drupal/drupal.routes.js'
import { bigcommerceRouter } from './bigcommerce/bigcommerce.routes.js'
import { prestashopRouter } from './prestashop/prestashop.routes.js'
import { wixRouter } from './wix/wix.routes.js'
import { googleSearchConsoleRouter } from './googlesearchconsole/googlesearchconsole.routes.js'

export const connectorsRouter = Router()

// WooCommerce is not a separate connector: it's detected automatically
// through the WordPress connector, since a WooCommerce store is a
// WordPress site with WooCommerce installed (see get_woocommerce_* tools).
const ALL_PROVIDERS = ['shopify', 'wordpress', 'drupal', 'bigcommerce', 'prestashop', 'wix', 'google_search_console']

connectorsRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  if (!req.company) return res.json({ connectors: [] })
  const { rows } = await pool.query(
    'SELECT provider, status, connected_at FROM connectors WHERE company_id = $1',
    [req.company.id]
  )
  const byProvider = Object.fromEntries(rows.map((r) => [r.provider, r]))
  const connectors = ALL_PROVIDERS.map((provider) => ({
    provider,
    status: byProvider[provider]?.status || 'disconnected',
    connectedAt: byProvider[provider]?.connected_at || null,
  }))
  res.json({ connectors })
}))

connectorsRouter.delete('/:provider', requireAuth, asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  await pool.query('DELETE FROM connectors WHERE company_id = $1 AND provider = $2', [req.company.id, req.params.provider])
  res.status(204).end()
}))

connectorsRouter.use('/shopify', shopifyRouter)
connectorsRouter.use('/wordpress', wordpressRouter)
connectorsRouter.use('/drupal', drupalRouter)
connectorsRouter.use('/bigcommerce', bigcommerceRouter)
connectorsRouter.use('/prestashop', prestashopRouter)
connectorsRouter.use('/wix', wixRouter)
connectorsRouter.use('/google-search-console', googleSearchConsoleRouter)
