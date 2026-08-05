import axios from 'axios'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { pool } from '../../../db/pool.js'
import { HttpError } from '../../../middleware/errorHandler.js'

// --- OAuth-style handshake, initiated by the "Kaelah AI Connector" module once
// installed on the user's own Drupal site. Mirrors the WordPress connector. ---

export function createAuthorizationCode(companyId, siteUrl) {
  return jwt.sign({ companyId, siteUrl, provider: 'drupal', purpose: 'oauth_code' }, process.env.JWT_SECRET, { expiresIn: '10m' })
}

function verifyAuthorizationCode(code, siteUrl) {
  let payload
  try {
    payload = jwt.verify(code, process.env.JWT_SECRET)
  } catch {
    throw new HttpError(400, "Code d'autorisation invalide ou expiré. Relance la connexion depuis le module.")
  }
  if (payload.provider !== 'drupal' || payload.purpose !== 'oauth_code' || payload.siteUrl !== siteUrl) {
    throw new HttpError(400, "Code d'autorisation invalide.")
  }
  return payload.companyId
}

export async function exchangeCodeForToken(code, siteUrl, siteName) {
  const companyId = verifyAuthorizationCode(code, siteUrl)
  const accessToken = crypto.randomBytes(32).toString('hex')

  await pool.query(
    `INSERT INTO connectors (company_id, provider, status, config, connected_at, updated_at)
     VALUES ($1, 'drupal', 'connected', $2, now(), now())
     ON CONFLICT (company_id, provider)
     DO UPDATE SET status = 'connected', config = $2, connected_at = now(), updated_at = now()`,
    [companyId, JSON.stringify({ siteUrl, siteName: siteName || siteUrl, accessToken })]
  )

  return { companyId, accessToken }
}

function client(connector) {
  const { siteUrl, accessToken } = connector.config
  if (!siteUrl || !accessToken) throw new HttpError(400, 'Connecteur Drupal mal configuré.')
  return axios.create({
    baseURL: `${siteUrl.replace(/\/$/, '')}/kaelah-api/v1`,
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export async function getContent(connector, limit = 10) {
  const http = client(connector)
  const { data } = await http.get(`/content?limit=${limit}`)
  return data
}

export async function updateContent(connector, { nodeId, title, body }) {
  const http = client(connector)
  const { data } = await http.post(`/content/${nodeId}`, { title, body })
  return data
}

export async function updateSeoMeta(connector, { nodeId, seoTitle, seoDescription }) {
  const http = client(connector)
  const { data } = await http.post(`/seo/${nodeId}`, { seoTitle, seoDescription })
  return data
}

export async function updateHomepageSeo(connector, { seoTitle, seoDescription }) {
  const http = client(connector)
  const { data } = await http.post('/seo/homepage', { seoTitle, seoDescription })
  return data
}

export async function updateGeo(connector, { nodeId, conversationalSummary, qaPairs, structuredDataSuggestion }) {
  const http = client(connector)
  const { data } = await http.post(`/geo/${nodeId}`, { conversationalSummary, qaPairs, structuredDataSuggestion })
  return data
}

export async function updateHomepageGeo(connector, { conversationalSummary, qaPairs, structuredDataSuggestion }) {
  const http = client(connector)
  const { data } = await http.post('/geo/homepage', { conversationalSummary, qaPairs, structuredDataSuggestion })
  return data
}

export async function updateLlmsTxt(connector, { content }) {
  const http = client(connector)
  const { data } = await http.post('/llms-txt', { content })
  return data
}

export async function findContentByTitle(connector, title) {
  if (!title) return null
  const all = await getContent(connector, 50)
  const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const target = normalize(title)
  return (
    all.find((n) => normalize(n.title) === target) ||
    all.find((n) => normalize(n.title).includes(target) || target.includes(normalize(n.title))) ||
    null
  )
}
