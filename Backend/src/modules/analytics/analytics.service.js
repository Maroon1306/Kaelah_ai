import { pool } from '../../db/pool.js'
import * as shopify from '../connectors/shopify/shopify.service.js'
import { analyzeUrl } from '../seo/seo.service.js'

async function getConnectedShopify(companyId) {
  const { rows } = await pool.query(
    "SELECT * FROM connectors WHERE company_id = $1 AND provider = 'shopify' AND status = 'connected'",
    [companyId]
  )
  return rows[0] || null
}

export async function getLatestSnapshot(companyId) {
  const { rows } = await pool.query(
    'SELECT * FROM analytics_snapshots WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1',
    [companyId]
  )
  return rows[0] || null
}

export async function getSnapshotHistory(companyId, limit = 30) {
  const { rows } = await pool.query(
    'SELECT * FROM analytics_snapshots WHERE company_id = $1 ORDER BY created_at DESC LIMIT $2',
    [companyId, limit]
  )
  return rows.reverse()
}

export async function computeAndStoreSnapshot(companyId) {
  const connector = await getConnectedShopify(companyId)
  if (!connector) return null

  const [ordersSummary, products] = await Promise.all([
    shopify.getOrdersSummary(connector),
    shopify.getProducts(connector, 20),
  ])

  const { rows } = await pool.query(
    `INSERT INTO analytics_snapshots (company_id, revenue, orders, customers, products)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [companyId, ordersSummary.revenue, ordersSummary.ordersCount, null, products.length]
  )
  return rows[0]
}

export async function getOverview(companyId) {
  let snapshot = await getLatestSnapshot(companyId)
  const connector = await getConnectedShopify(companyId)

  if (!snapshot && connector) snapshot = await computeAndStoreSnapshot(companyId)
  if (!snapshot) return { available: false }

  return { available: true, ...snapshot }
}

export async function getSeoOverview(companyId) {
  const connector = await getConnectedShopify(companyId)
  if (!connector) return { available: false }
  const shopDomain = connector.config.shopDomain
  const result = await analyzeUrl(`https://${shopDomain}`)
  return { available: true, ...result }
}
