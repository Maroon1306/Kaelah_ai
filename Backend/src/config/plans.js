import { HttpError } from '../middleware/errorHandler.js'

// Central source of truth for what each plan allows. Keep this in sync with
// the public catalog in billing.service.js (pricing) — this file is about
// limits/access, not price.
export const PLAN_LIMITS = {
  starter: {
    messagesPerMonth: 500,
    maxConnectors: 1,
    // WordPress/WooCommerce, Drupal and PrestaShop are free for Kaelah to
    // support (self-hosted plugins, no per-store API costs) — a real,
    // sustainable entry point. Shopify/BigCommerce/Wix stay Pro+.
    allowedProviders: ['wordpress', 'drupal', 'prestashop'],
    features: [],
  },
  pro: {
    messagesPerMonth: 2000,
    maxConnectors: 3,
    allowedProviders: null, // null = every provider
    features: ['bulk', 'google_search_console'],
  },
  business: {
    messagesPerMonth: null, // null = unlimited
    maxConnectors: null,
    allowedProviders: null,
    features: ['bulk', 'google_search_console', 'agent'],
  },
}

export function getPlanLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.starter
}

export function planAllowsProvider(plan, provider) {
  const { allowedProviders } = getPlanLimits(plan)
  return !allowedProviders || allowedProviders.includes(provider)
}

export function planHasFeature(plan, feature) {
  return getPlanLimits(plan).features.includes(feature)
}

const PLAN_LABELS = { starter: 'Starter', pro: 'Pro', business: 'Business' }

/**
 * Throws a friendly, upgrade-oriented error (never a bare "forbidden") when
 * a company's plan doesn't allow connecting `provider` — used at the start
 * of every connector's install/consent endpoint. Takes `pool` directly so
 * every route only needs one import to get both the provider check and the
 * live connector-count check.
 */
export async function assertCanConnectProvider(pool, company, provider) {
  const plan = company?.plan || 'starter'
  const limits = getPlanLimits(plan)

  if (!planAllowsProvider(plan, provider)) {
    throw new HttpError(402, `Ce connecteur n'est pas disponible sur ton forfait ${PLAN_LABELS[plan]}. Passe au forfait Pro pour le débloquer.`)
  }
  if (limits.maxConnectors != null) {
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS count FROM connectors WHERE company_id = $1 AND status = 'connected' AND provider != $2",
      [company.id, provider]
    )
    if (rows[0].count >= limits.maxConnectors) {
      throw new HttpError(402, `Ton forfait ${PLAN_LABELS[plan]} est limité à ${limits.maxConnectors} connecteur(s) actif(s). Déconnecte-en un ou passe à un forfait supérieur pour en ajouter d'autres.`)
    }
  }
}
