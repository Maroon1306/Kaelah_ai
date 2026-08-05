import axios from 'axios'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { pool } from '../../../db/pool.js'
import { HttpError } from '../../../middleware/errorHandler.js'

// --- OAuth-style handshake, initiated by the "Kaelah AI Connector" module once
// installed on the user's own PrestaShop store. Kaelah never asks for a URL,
// API key or password from the user directly — same pattern as WordPress/Drupal. ---

export function createAuthorizationCode(companyId, shopUrl) {
  return jwt.sign({ companyId, shopUrl, provider: 'prestashop', purpose: 'oauth_code' }, process.env.JWT_SECRET, { expiresIn: '10m' })
}

function verifyAuthorizationCode(code, shopUrl) {
  let payload
  try {
    payload = jwt.verify(code, process.env.JWT_SECRET)
  } catch {
    throw new HttpError(400, "Code d'autorisation invalide ou expiré. Relance la connexion depuis le module.")
  }
  if (payload.provider !== 'prestashop' || payload.purpose !== 'oauth_code' || payload.shopUrl !== shopUrl) {
    throw new HttpError(400, "Code d'autorisation invalide.")
  }
  return payload.companyId
}

export async function exchangeCodeForToken(code, shopUrl, shopName) {
  const companyId = verifyAuthorizationCode(code, shopUrl)
  const accessToken = crypto.randomBytes(32).toString('hex')

  await pool.query(
    `INSERT INTO connectors (company_id, provider, status, config, connected_at, updated_at)
     VALUES ($1, 'prestashop', 'connected', $2, now(), now())
     ON CONFLICT (company_id, provider)
     DO UPDATE SET status = 'connected', config = $2, connected_at = now(), updated_at = now()`,
    [companyId, JSON.stringify({ shopUrl, shopName: shopName || shopUrl, accessToken })]
  )

  return { companyId, accessToken }
}

// PrestaShop has no reliable native path-based REST routing for module front
// controllers, so the gateway is a single endpoint dispatched by an `action`
// query parameter — simpler and more robust across PrestaShop 1.6/1.7/8 than
// registering a custom route per operation.
function client(connector) {
  const { shopUrl, accessToken } = connector.config
  if (!shopUrl || !accessToken) throw new HttpError(400, 'Connecteur PrestaShop mal configuré.')
  return axios.create({
    baseURL: `${shopUrl.replace(/\/$/, '')}/module/kaelahaiconnector/api`,
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export async function getProducts(connector, limit = 10) {
  const http = client(connector)
  const { data } = await http.get(`/?action=products&limit=${limit}`)
  return data
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
  const http = client(connector)
  const { data } = await http.get('/?action=orders-summary')
  return data
}

export async function updateProductSEO(connector, { productId, seoTitle, seoDescription }) {
  const http = client(connector)
  const { data } = await http.post(`/?action=product-seo&id=${productId}`, { seoTitle, seoDescription })
  return data
}

export async function updateHomepageSeo(connector, { seoTitle, seoDescription }) {
  const http = client(connector)
  const { data } = await http.post('/?action=homepage-seo', { seoTitle, seoDescription })
  return data
}

export async function updateProductGeo(connector, { productId, conversationalSummary, qaPairs, structuredDataSuggestion }) {
  const http = client(connector)
  const { data } = await http.post(`/?action=product-geo&id=${productId}`, { conversationalSummary, qaPairs, structuredDataSuggestion })
  return data
}

export async function updateHomepageGeo(connector, { conversationalSummary, qaPairs, structuredDataSuggestion }) {
  const http = client(connector)
  const { data } = await http.post('/?action=homepage-geo', { conversationalSummary, qaPairs, structuredDataSuggestion })
  return data
}

export async function updateLlmsTxt(connector, { content }) {
  const http = client(connector)
  const { data } = await http.post('/?action=llms-txt', { content })
  return data
}
