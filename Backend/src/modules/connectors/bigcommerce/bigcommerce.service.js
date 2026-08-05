import axios from 'axios'
import jwt from 'jsonwebtoken'
import { pool } from '../../../db/pool.js'
import { HttpError } from '../../../middleware/errorHandler.js'

const API_VERSION = 'v3'

/**
 * BigCommerce apps are installed by the merchant from BigCommerce's own
 * marketplace (or a draft-app install link BigCommerce gives you in the
 * Developer Portal) — unlike Shopify, Kaelah never builds the initial
 * authorize URL itself, so it can't embed a companyId in it up front.
 * Instead: BigCommerce calls our public callback with the code, we exchange
 * it for a real access token, then hand the merchant's browser a short-lived
 * signed "claim" token to bring back to Kaelah's own consent page (see
 * bigcommerce.routes.js /callback and /claim) where they're logged in and we
 * finally know which company to attach the connector to.
 */
export async function exchangeCodeForToken({ code, scope, context }) {
  const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/connectors/bigcommerce/callback`
  const { data } = await axios.post('https://login.bigcommerce.com/oauth2/token', {
    client_id: process.env.BIGCOMMERCE_CLIENT_ID,
    client_secret: process.env.BIGCOMMERCE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code,
    scope,
    context,
  })
  return data // { access_token, scope, user, context }
}

export function createClaimToken({ storeHash, accessToken, scope }) {
  return jwt.sign({ storeHash, accessToken, scope, provider: 'bigcommerce', purpose: 'claim' }, process.env.JWT_SECRET, { expiresIn: '10m' })
}

export function verifyClaimToken(claim) {
  let payload
  try {
    payload = jwt.verify(claim, process.env.JWT_SECRET)
  } catch {
    throw new HttpError(400, "Jeton de connexion invalide ou expiré. Réinstalle l'app depuis BigCommerce.")
  }
  if (payload.provider !== 'bigcommerce' || payload.purpose !== 'claim') {
    throw new HttpError(400, 'Jeton de connexion invalide.')
  }
  return payload
}

export async function saveConnector(companyId, { storeHash, accessToken, scope }) {
  await pool.query(
    `INSERT INTO connectors (company_id, provider, status, config, scopes, connected_at, updated_at)
     VALUES ($1, 'bigcommerce', 'connected', $2, $3, now(), now())
     ON CONFLICT (company_id, provider)
     DO UPDATE SET status = 'connected', config = $2, scopes = $3, connected_at = now(), updated_at = now()`,
    [companyId, JSON.stringify({ storeHash, accessToken }), scope]
  )
}

export async function disconnectByStoreHash(storeHash) {
  await pool.query("UPDATE connectors SET status = 'disconnected' WHERE provider = 'bigcommerce' AND config->>'storeHash' = $1", [storeHash])
}

function client(connector) {
  const { storeHash, accessToken } = connector.config
  if (!storeHash || !accessToken) throw new HttpError(400, 'Connecteur BigCommerce mal configuré.')
  return axios.create({
    baseURL: `https://api.bigcommerce.com/stores/${storeHash}/${API_VERSION}`,
    headers: { 'X-Auth-Token': accessToken, 'Content-Type': 'application/json', Accept: 'application/json' },
  })
}

function clientV2(connector) {
  const { storeHash, accessToken } = connector.config
  if (!storeHash || !accessToken) throw new HttpError(400, 'Connecteur BigCommerce mal configuré.')
  return axios.create({
    baseURL: `https://api.bigcommerce.com/stores/${storeHash}/v2`,
    headers: { 'X-Auth-Token': accessToken, 'Content-Type': 'application/json', Accept: 'application/json' },
  })
}

export async function getProducts(connector, limit = 10) {
  const http = client(connector)
  const { data } = await http.get(`/catalog/products?limit=${limit}`)
  return (data.data || []).map((p) => ({
    id: p.id,
    title: p.name,
    price: p.price,
    link: p.custom_url?.url ? `https://${connector.config.storeHash}.mybigcommerce.com${p.custom_url.url}` : null,
    seoTitle: p.page_title || '',
    seoDescription: p.meta_description || '',
  }))
}

export async function findProductByTitle(connector, title) {
  if (!title) return null
  const products = await getProducts(connector, 250)
  const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const target = normalize(title)
  return (
    products.find((p) => normalize(p.title) === target) ||
    products.find((p) => normalize(p.title).includes(target) || target.includes(normalize(p.title))) ||
    null
  )
}

export async function getOrdersSummary(connector) {
  const http = clientV2(connector)
  const { data } = await http.get('/orders?limit=100')
  const orders = Array.isArray(data) ? data : []
  const revenue = orders.reduce((sum, o) => sum + Number(o.total_inc_tax || 0), 0)
  return {
    ordersCount: orders.length,
    revenue: Number(revenue.toFixed(2)),
    currency: orders[0]?.currency_code || null,
  }
}

export async function updateProductSEO(connector, { productId, seoTitle, seoDescription }) {
  const http = client(connector)
  const body = {}
  if (seoTitle) body.page_title = seoTitle
  if (seoDescription) body.meta_description = seoDescription
  const { data } = await http.put(`/catalog/products/${productId}`, body)
  return { product: data.data }
}

/**
 * Store-wide (homepage) SEO title/description. Uses BigCommerce's store
 * settings SEO endpoint — verify against a real store once credentials are
 * available, since this couldn't be live-tested (BigCommerce has no free
 * self-hosted option to test locally, unlike WordPress/Drupal).
 */
export async function updateShopSEO(connector, { title, description }) {
  const http = client(connector)
  const current = await http.get('/settings/storefront/seo')
  const existing = current.data.data || {}
  const body = {
    meta_description: existing.meta_description || '',
    meta_keywords: existing.meta_keywords || '',
    page_title: existing.page_title || '',
    www_redirect: existing.www_redirect || 'none',
  }
  if (title) body.page_title = title
  if (description) body.meta_description = description
  const { data } = await http.put('/settings/storefront/seo', body)
  return data.data || {}
}
