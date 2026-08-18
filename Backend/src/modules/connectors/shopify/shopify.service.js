import axios from 'axios'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { pool } from '../../../db/pool.js'
import { HttpError } from '../../../middleware/errorHandler.js'

const API_VERSION = '2024-10'

export function buildAuthUrl({ shop, companyId }) {
  const state = jwt.sign({ companyId, provider: 'shopify' }, process.env.JWT_SECRET, { expiresIn: '10m' })
  const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/connectors/shopify/callback`
  const params = new URLSearchParams({
    client_id: process.env.SHOPIFY_API_KEY,
    scope: process.env.SHOPIFY_SCOPES || 'read_products,write_products,read_orders,read_customers,write_content',
    redirect_uri: redirectUri,
    state,
  })
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`
}

export function verifyState(state) {
  return jwt.verify(state, process.env.JWT_SECRET)
}

export function verifyHmac(query) {
  const { hmac, ...rest } = query
  const message = Object.keys(rest).sort().map((key) => `${key}=${rest[key]}`).join('&')
  const digest = crypto.createHmac('sha256', process.env.SHOPIFY_API_SECRET).update(message).digest('hex')
  return digest === hmac
}

export async function exchangeCodeForToken(shop, code) {
  const { data } = await axios.post(`https://${shop}/admin/oauth/access_token`, {
    client_id: process.env.SHOPIFY_API_KEY,
    client_secret: process.env.SHOPIFY_API_SECRET,
    code,
  })
  return data // { access_token, scope }
}

export async function saveConnector(companyId, shop, tokenData) {
  await pool.query(
    `INSERT INTO connectors (company_id, provider, status, config, scopes, connected_at, updated_at)
     VALUES ($1, 'shopify', 'connected', $2, $3, now(), now())
     ON CONFLICT (company_id, provider)
     DO UPDATE SET status = 'connected', config = $2, scopes = $3, connected_at = now(), updated_at = now()`,
    [companyId, JSON.stringify({ shopDomain: shop, accessToken: tokenData.access_token }), tokenData.scope]
  )
}

function client(connector) {
  const { shopDomain, accessToken } = connector.config
  if (!shopDomain || !accessToken) throw new HttpError(400, 'Connecteur Shopify mal configuré.')
  return axios.create({
    baseURL: `https://${shopDomain}/admin/api/${API_VERSION}`,
    headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
  })
}

export async function getProducts(connector, limit = 10) {
  const http = client(connector)
  const { data } = await http.get(`/products.json?limit=${limit}`)
  return data.products.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    price: p.variants?.[0]?.price,
    image: p.image?.src || null,
    seoTitle: p.title,
    tags: p.tags,
  }))
}

export async function findProductByTitle(connector, title) {
  if (!title) return null
  const http = client(connector)
  const { data } = await http.get(`/products.json?limit=250&fields=id,title`)
  const products = data.products || []
  const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const target = normalize(title)
  return (
    products.find((p) => normalize(p.title) === target) ||
    products.find((p) => normalize(p.title).includes(target) || target.includes(normalize(p.title))) ||
    null
  )
}

export async function getOrdersSummary(connector) {
  const http = client(connector)
  const { data } = await http.get('/orders.json?status=any&limit=100')
  const orders = data.orders || []
  const revenue = orders.reduce((sum, o) => sum + Number(o.total_price || 0), 0)
  return {
    ordersCount: orders.length,
    revenue: Number(revenue.toFixed(2)),
    currency: orders[0]?.currency || null,
  }
}

export async function registerWebhook(connector, topic, address) {
  const http = client(connector)
  try {
    await http.post('/webhooks.json', { webhook: { topic, address, format: 'json' } })
  } catch (err) {
    console.warn(`[shopify] Could not register webhook ${topic}:`, err.response?.data || err.message)
  }
}

export async function findConnectorByShop(shopDomain) {
  const { rows } = await pool.query(
    "SELECT * FROM connectors WHERE provider = 'shopify' AND config->>'shopDomain' = $1 AND status = 'connected'",
    [shopDomain]
  )
  return rows[0] || null
}

export async function updateProductSEO(connector, { productId, title, seoTitle, seoDescription }) {
  const http = client(connector)
  const body = { product: { id: productId } }
  if (title) body.product.title = title
  if (seoTitle || seoDescription) {
    body.product.metafields_global_title_tag = seoTitle
    body.product.metafields_global_description_tag = seoDescription
  }
  const { data } = await http.put(`/products/${productId}.json`, body)
  return { product: data.product }
}

/**
 * Replaces every existing image on a product with a single new one, fetched
 * by Shopify itself from the given external URL (Cloudinary, in practice —
 * wherever the user's chat upload landed). Deletes the old images after the
 * new one is confirmed attached, so a failed upload never leaves the
 * product with no image at all.
 */
export async function replaceProductImage(connector, { productId, imageUrl }) {
  const http = client(connector)
  const { data: existing } = await http.get(`/products/${productId}/images.json`)
  const oldImages = existing.images || []

  const { data: created } = await http.post(`/products/${productId}/images.json`, { image: { src: imageUrl } })

  for (const img of oldImages) {
    await http.delete(`/products/${productId}/images/${img.id}.json`).catch(() => {})
  }

  return { image: created.image }
}

export async function getCollections(connector, limit = 10) {
  const http = client(connector)
  const [custom, smart] = await Promise.all([
    http.get(`/custom_collections.json?limit=${limit}`),
    http.get(`/smart_collections.json?limit=${limit}`),
  ])
  const format = (c, type) => ({
    id: c.id,
    type,
    title: c.title,
    link: c.handle ? `https://${connector.config.shopDomain}/collections/${c.handle}` : null,
    seoTitle: c.metafields_global_title_tag || '',
    seoDescription: c.metafields_global_description_tag || '',
  })
  return [
    ...(custom.data.custom_collections || []).map((c) => format(c, 'custom')),
    ...(smart.data.smart_collections || []).map((c) => format(c, 'smart')),
  ].slice(0, limit)
}

export async function findCollectionByTitle(connector, title) {
  if (!title) return null
  const collections = await getCollections(connector, 250)
  const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const target = normalize(title)
  return (
    collections.find((c) => normalize(c.title) === target) ||
    collections.find((c) => normalize(c.title).includes(target) || target.includes(normalize(c.title))) ||
    null
  )
}

export async function updateCollectionSEO(connector, { collectionId, collectionType, seoTitle, seoDescription }) {
  const http = client(connector)
  const endpoint = collectionType === 'smart' ? 'smart_collections' : 'custom_collections'
  const key = collectionType === 'smart' ? 'smart_collection' : 'custom_collection'
  const body = { [key]: { id: collectionId } }
  if (seoTitle) body[key].metafields_global_title_tag = seoTitle
  if (seoDescription) body[key].metafields_global_description_tag = seoDescription
  const { data } = await http.put(`/${endpoint}/${collectionId}.json`, body)
  const c = data[key]
  return {
    id: c.id,
    title: c.title,
    seoTitle: c.metafields_global_title_tag || '',
    seoDescription: c.metafields_global_description_tag || '',
  }
}

export async function updateShopSEO(connector, { title, description }) {
  const http = client(connector)
  const result = {}
  if (title) {
    const { data } = await http.post('/metafields.json', {
      metafield: { namespace: 'global', key: 'title_tag', value: title, type: 'single_line_text_field' },
    })
    result.title = data.metafield.value
  }
  if (description) {
    const { data } = await http.post('/metafields.json', {
      metafield: { namespace: 'global', key: 'description_tag', value: description, type: 'string' },
    })
    result.description = data.metafield.value
  }
  return result
}
