import axios from 'axios'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { pool } from '../../../db/pool.js'
import { HttpError } from '../../../middleware/errorHandler.js'

// --- Wix's "external install flow": the merchant clicks Kaelah's own
// "Connecter" button (no Wix session needed yet), which sends them to
// https://www.wix.com/app-installer?appId=...&postInstallationUrl=..., and
// Wix redirects back here with a signed instance we verify ourselves —
// no authorization-code exchange needed for this step. ---

/**
 * Verifies Wix's signed instance parameter: "<hmac-sha256-signature>.<base64url-json>".
 * See https://dev.wix.com/docs/build-apps/develop-your-app/access/app-instances/parse-the-app-instance-query-parameter
 */
export function verifySignedInstance(signedInstance) {
  const parts = String(signedInstance).split('.')
  if (parts.length !== 2) throw new HttpError(400, 'Instance Wix invalide.')
  const [signature, encodedData] = parts

  const expected = crypto.createHmac('sha256', process.env.WIX_APP_SECRET).update(encodedData).digest('base64url')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new HttpError(400, 'Signature Wix invalide.')
  }

  let data
  try {
    data = JSON.parse(Buffer.from(encodedData, 'base64url').toString('utf8'))
  } catch {
    throw new HttpError(400, "Données d'instance Wix illisibles.")
  }
  if (!data.instanceId) throw new HttpError(400, 'instanceId manquant dans l\'instance Wix.')
  return data
}

export function createClaimToken({ instanceId, siteDisplayName }) {
  return jwt.sign({ instanceId, siteDisplayName, provider: 'wix', purpose: 'claim' }, process.env.JWT_SECRET, { expiresIn: '10m' })
}

export function verifyClaimToken(token) {
  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    throw new HttpError(400, 'Jeton de connexion invalide ou expiré.')
  }
  if (payload.provider !== 'wix' || payload.purpose !== 'claim') throw new HttpError(400, 'Jeton de connexion invalide.')
  return payload
}

export async function saveConnector(companyId, { instanceId, siteDisplayName, catalogVersion }) {
  await pool.query(
    `INSERT INTO connectors (company_id, provider, status, config, connected_at, updated_at)
     VALUES ($1, 'wix', 'connected', $2, now(), now())
     ON CONFLICT (company_id, provider)
     DO UPDATE SET status = 'connected', config = $2, connected_at = now(), updated_at = now()`,
    [companyId, JSON.stringify({ instanceId, siteDisplayName: siteDisplayName || null, catalogVersion: catalogVersion || null })]
  )
}

export async function disconnectByInstanceId(instanceId) {
  await pool.query(
    "UPDATE connectors SET status = 'disconnected', updated_at = now() WHERE provider = 'wix' AND config->>'instanceId' = $1",
    [instanceId]
  )
}

/**
 * Wix apps use client_credentials + instanceId to mint a short-lived (4h)
 * access token on demand — there is no long-lived stored access/refresh
 * token to manage, unlike Shopify/BigCommerce/PrestaShop.
 */
async function getAccessToken(connector) {
  const { instanceId } = connector.config
  if (!instanceId) throw new HttpError(400, 'Connecteur Wix mal configuré.')
  const { data } = await axios.post('https://www.wixapis.com/oauth2/token', {
    grant_type: 'client_credentials',
    client_id: process.env.WIX_APP_ID,
    client_secret: process.env.WIX_APP_SECRET,
    instance_id: instanceId,
  })
  return data.access_token
}

async function client(connector) {
  const accessToken = await getAccessToken(connector)
  return axios.create({
    baseURL: 'https://www.wixapis.com',
    headers: { Authorization: accessToken },
  })
}

/**
 * Wix Stores has two incompatible catalog generations on different sites:
 * Catalog V1 (older sites) and Catalog V3 (sites created since ~mid-2025).
 * A Wix app must support both to be installable everywhere, and each site
 * only speaks one of the two. Detected once at connect time and cached on
 * the connector so we don't re-check on every call.
 */
export async function detectCatalogVersion(instanceId) {
  try {
    const accessToken = await getAccessToken({ config: { instanceId } })
    const http = axios.create({ baseURL: 'https://www.wixapis.com', headers: { Authorization: accessToken } })
    const { data } = await http.get('/stores/v3/provision/version')
    return JSON.stringify(data).includes('V3') ? 'v3' : 'v1'
  } catch {
    return 'v1'
  }
}

function formatProductV1(p) {
  const tags = p.seoData?.tags || []
  return {
    id: p.id,
    title: p.name,
    price: p.priceData?.price,
    link: p.productPageUrl ? `${p.productPageUrl.base}${p.productPageUrl.path}` : null,
    seoTitle: tags.find((t) => t.type === 'title')?.children || '',
    seoDescription: tags.find((t) => t.type === 'meta' && t.props?.name === 'description')?.props?.content || '',
  }
}

function formatProductV3(p) {
  return {
    id: p.id,
    title: p.name,
    price: p.variantSummary?.minPriceVariant?.price ?? null,
    link: p.url?.url || null,
    // Catalog V3 has no per-product SEO title/meta-description fields in its
    // REST API (confirmed against the current Wix API reference) — SEO for
    // V3 catalogs is generated dynamically by Wix itself, not editable here.
    seoTitle: '',
    seoDescription: '',
  }
}

export async function getProducts(connector, limit = 10) {
  const http = await client(connector)
  if (connector.config.catalogVersion === 'v3') {
    const { data } = await http.post('/stores/v3/products/query', {
      fields: ['URL', 'MIN_PRICE_VARIANT', 'CURRENCY'],
      query: { cursorPaging: { limit } },
    })
    return (data.products || []).map(formatProductV3)
  }
  const { data } = await http.post('/stores/v1/products/query', { query: { paging: { limit } } })
  return (data.products || []).map(formatProductV1)
}

export async function findProductByTitle(connector, title) {
  if (!title) return null
  const products = await getProducts(connector, 100)
  const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const target = normalize(title)
  return (
    products.find((p) => normalize(p.title) === target) ||
    products.find((p) => normalize(p.title).includes(target) || target.includes(normalize(p.title))) ||
    null
  )
}

export async function getOrdersSummary(connector) {
  const http = await client(connector)
  const { data } = await http.post('/ecom/v1/orders/search', { search: { cursorPaging: { limit: 100 } } })
  const orders = data.orders || []
  const revenue = orders.reduce((sum, o) => sum + Number(o.priceSummary?.total?.amount || 0), 0)
  return {
    ordersCount: orders.length,
    revenue: Number(revenue.toFixed(2)),
    currency: orders[0]?.currency || null,
  }
}

export async function updateProductSEO(connector, { productId, seoTitle, seoDescription }) {
  if (connector.config.catalogVersion === 'v3') {
    return {
      error: 'not_supported',
      message: "Cette boutique Wix utilise la nouvelle version de Wix Stores (Catalog V3), qui ne permet pas encore de modifier le titre SEO et la meta description d'un produit par API — cette fonctionnalité doit être réglée manuellement dans l'éditeur Wix pour le moment.",
    }
  }
  const http = await client(connector)
  const tags = []
  if (seoTitle) tags.push({ type: 'title', children: seoTitle })
  if (seoDescription) tags.push({ type: 'meta', props: { name: 'description', content: seoDescription } })
  const { data } = await http.patch(`/stores/v1/products/${productId}`, { product: { id: productId, seoData: { tags } } })
  return formatProductV1(data.product)
}
