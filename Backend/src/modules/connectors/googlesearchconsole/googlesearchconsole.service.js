import axios from 'axios'
import jwt from 'jsonwebtoken'
import { pool } from '../../../db/pool.js'
import { HttpError } from '../../../middleware/errorHandler.js'

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

// --- Standard Google OAuth2 authorization-code flow, Kaelah-initiated (like
// Shopify) — companyId travels in the signed `state` param, no separate
// claim step needed since there's no marketplace install in between. ---

export function buildAuthUrl({ companyId }) {
  const state = jwt.sign({ companyId, provider: 'google_search_console' }, process.env.JWT_SECRET, { expiresIn: '10m' })
  const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/connectors/google-search-console/callback`
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export function verifyState(state) {
  const payload = jwt.verify(state, process.env.JWT_SECRET)
  if (payload.provider !== 'google_search_console') throw new HttpError(400, 'État OAuth invalide.')
  return payload
}

export async function exchangeCodeForToken(code) {
  const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/connectors/google-search-console/callback`
  const { data } = await axios.post('https://oauth2.googleapis.com/token', {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })
  return data // { access_token, refresh_token, expires_in }
}

export async function saveConnector(companyId, { accessToken, refreshToken }) {
  await pool.query(
    `INSERT INTO connectors (company_id, provider, status, config, connected_at, updated_at)
     VALUES ($1, 'google_search_console', 'connected', $2, now(), now())
     ON CONFLICT (company_id, provider)
     DO UPDATE SET status = 'connected', config = $2, connected_at = now(), updated_at = now()`,
    [companyId, JSON.stringify({ accessToken, refreshToken })]
  )
}

/**
 * Google access tokens expire in ~1h — always refresh on demand rather than
 * tracking expiry ourselves, simplest correct approach for our call volume.
 */
async function getAccessToken(connector) {
  const { refreshToken } = connector.config
  if (!refreshToken) throw new HttpError(400, 'Connecteur Google Search Console mal configuré.')
  const { data } = await axios.post('https://oauth2.googleapis.com/token', {
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  })
  return data.access_token
}

async function client(connector) {
  const accessToken = await getAccessToken(connector)
  return axios.create({
    baseURL: 'https://www.googleapis.com/webmasters/v3',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export async function getSites(connector) {
  const http = await client(connector)
  const { data } = await http.get('/sites')
  return (data.siteEntry || []).map((s) => ({ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel }))
}

function formatDate(d) {
  return d.toISOString().slice(0, 10)
}

/**
 * Real ranking positions for a site's top queries over the last N days —
 * this is genuine Search Console data (average position, clicks,
 * impressions), not an estimate.
 */
export async function getSearchPositions(connector, { siteUrl, days = 28, limit = 20 } = {}) {
  const http = await client(connector)
  const sites = await getSites(connector)
  const target = siteUrl ? sites.find((s) => s.siteUrl.includes(siteUrl)) : sites[0]
  if (!target) {
    return {
      error: 'no_verified_site',
      message: siteUrl
        ? `Propriété Search Console introuvable pour "${siteUrl}".`
        : "Aucune propriété Search Console vérifiée sur ce compte Google. Ajoute et vérifie ton site sur search.google.com/search-console avant de pouvoir suivre ses positions.",
    }
  }

  const endDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // GSC data lags ~2-3 days
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

  const { data } = await http.post(`/sites/${encodeURIComponent(target.siteUrl)}/searchAnalytics/query`, {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    dimensions: ['query'],
    rowLimit: limit,
  })

  return {
    siteUrl: target.siteUrl,
    periodDays: days,
    queries: (data.rows || []).map((r) => ({
      query: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: Math.round(r.ctr * 1000) / 10,
      position: Math.round(r.position * 10) / 10,
    })),
  }
}
