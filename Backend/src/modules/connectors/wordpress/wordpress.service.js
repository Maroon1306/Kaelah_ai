import axios from 'axios'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { pool } from '../../../db/pool.js'
import { HttpError } from '../../../middleware/errorHandler.js'

// --- OAuth-style handshake, initiated by the "Kaelah AI Connector" plugin once
// installed on the user's own WordPress site. Kaelah never asks for a URL,
// API key or application password from the user directly. ---

export function createAuthorizationCode(companyId, siteUrl) {
  return jwt.sign({ companyId, siteUrl, provider: 'wordpress', purpose: 'oauth_code' }, process.env.JWT_SECRET, { expiresIn: '10m' })
}

function verifyAuthorizationCode(code, siteUrl) {
  let payload
  try {
    payload = jwt.verify(code, process.env.JWT_SECRET)
  } catch {
    throw new HttpError(400, "Code d'autorisation invalide ou expiré. Relance la connexion depuis le plugin.")
  }
  if (payload.provider !== 'wordpress' || payload.purpose !== 'oauth_code' || payload.siteUrl !== siteUrl) {
    throw new HttpError(400, "Code d'autorisation invalide.")
  }
  return payload.companyId
}

export async function exchangeCodeForToken(code, siteUrl, siteName) {
  const companyId = verifyAuthorizationCode(code, siteUrl)
  const accessToken = crypto.randomBytes(32).toString('hex')

  await pool.query(
    `INSERT INTO connectors (company_id, provider, status, config, connected_at, updated_at)
     VALUES ($1, 'wordpress', 'connected', $2, now(), now())
     ON CONFLICT (company_id, provider)
     DO UPDATE SET status = 'connected', config = $2, connected_at = now(), updated_at = now()`,
    [companyId, JSON.stringify({ siteUrl, siteName: siteName || siteUrl, accessToken })]
  )

  return { companyId, accessToken }
}

function client(connector) {
  const { siteUrl, accessToken } = connector.config
  if (!siteUrl || !accessToken) throw new HttpError(400, 'Connecteur WordPress mal configuré.')
  return axios.create({
    baseURL: `${siteUrl.replace(/\/$/, '')}/wp-json/kaelah/v1`,
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export async function getPosts(connector, limit = 10) {
  const http = client(connector)
  const { data } = await http.get(`/posts?limit=${limit}`)
  return data
}

export async function getPages(connector, limit = 10) {
  const http = client(connector)
  const { data } = await http.get(`/pages?limit=${limit}`)
  return data
}

export async function updateContent(connector, { postId, title, content }) {
  const http = client(connector)
  const { data } = await http.post(`/content/${postId}`, { title, content })
  return data
}

export async function createPost(connector, { title, content, seoTitle, seoDescription }) {
  const http = client(connector)
  const { data } = await http.post('/posts', { title, content, seoTitle, seoDescription })
  return data
}

export async function updateSeoMeta(connector, { postId, seoTitle, seoDescription }) {
  const http = client(connector)
  const { data } = await http.post(`/seo/${postId}`, { seoTitle, seoDescription })
  return data
}

export async function updateHomepageSeo(connector, { seoTitle, seoDescription }) {
  const http = client(connector)
  const { data } = await http.post('/seo/homepage', { seoTitle, seoDescription })
  return data
}

export async function updateGeo(connector, { postId, conversationalSummary, qaPairs, structuredDataSuggestion }) {
  const http = client(connector)
  const { data } = await http.post(`/geo/${postId}`, { conversationalSummary, qaPairs, structuredDataSuggestion })
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

export async function getMedia(connector, limit = 50) {
  const http = client(connector)
  const { data } = await http.get(`/media?limit=${limit}`)
  return data
}

export async function findMediaByUrl(connector, imageUrl) {
  if (!imageUrl) return null
  const media = await getMedia(connector, 100)
  const normalize = (u) => (u || '').split('?')[0].replace(/\/$/, '')
  const target = normalize(imageUrl)
  return media.find((m) => normalize(m.url) === target) || media.find((m) => target.endsWith(normalize(m.url).split('/').pop())) || null
}

export async function updateImageAlt(connector, { mediaId, alt }) {
  const http = client(connector)
  const { data } = await http.post(`/media/${mediaId}/alt`, { alt })
  return data
}

export async function getCategories(connector, limit = 50) {
  const http = client(connector)
  const { data } = await http.get(`/categories?limit=${limit}`)
  return data
}

export async function findCategoryByTitle(connector, title) {
  if (!title) return null
  const categories = await getCategories(connector, 100)
  const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const target = normalize(title)
  return (
    categories.find((c) => normalize(c.title) === target) ||
    categories.find((c) => normalize(c.title).includes(target) || target.includes(normalize(c.title))) ||
    null
  )
}

export async function updateCategorySEO(connector, { categoryId, seoTitle, seoDescription }) {
  const http = client(connector)
  const { data } = await http.post(`/categories/${categoryId}/seo`, { seoTitle, seoDescription })
  return data
}

export async function getWooCommerceProducts(connector, limit = 10) {
  const http = client(connector)
  try {
    const { data } = await http.get(`/woocommerce/products?limit=${limit}`)
    return data
  } catch (err) {
    if (err.response?.data?.code === 'kaelah_woocommerce_not_active') return []
    throw err
  }
}

export async function getWooCommerceOrdersSummary(connector) {
  const http = client(connector)
  const { data } = await http.get('/woocommerce/orders-summary')
  return data
}

export async function findContentByTitle(connector, title) {
  if (!title) return null
  const [posts, pages, products] = await Promise.all([
    getPosts(connector, 50),
    getPages(connector, 50),
    getWooCommerceProducts(connector, 50).catch(() => []),
  ])
  const all = [...posts, ...pages, ...products]
  const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const target = normalize(title)
  return (
    all.find((p) => normalize(p.title) === target) ||
    all.find((p) => normalize(p.title).includes(target) || target.includes(normalize(p.title))) ||
    null
  )
}
