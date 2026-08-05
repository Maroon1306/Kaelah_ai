import { pool } from '../../db/pool.js'
import { BULK_PRODUCT_PROVIDERS, BULK_PRODUCT_LIMIT } from '../../ai/bulkProductProviders.js'
import { generateProductSeo } from '../seo/seo.service.js'
import { sendWeeklyReport } from '../reports/reports.service.js'
import { planHasFeature } from '../../config/plans.js'

async function getConnectedProviders(companyId) {
  const { rows } = await pool.query(
    "SELECT provider, config FROM connectors WHERE company_id = $1 AND status = 'connected'",
    [companyId]
  )
  return rows
}

/**
 * The autonomous agent's one safe, unattended action: for each connected
 * store, fill in SEO title/description only for products that have NONE
 * at all — it never overwrites something a human or a previous run already
 * set. Capped per connector per run to stay conservative. This is what
 * runs unattended; anything riskier (rewriting existing copy, bulk content
 * generation) stays a chat-confirmed action.
 */
async function autoFillMissingProductSeo(companyId) {
  const connectors = await getConnectedProviders(companyId)
  const results = []

  for (const connector of connectors) {
    const providerConfig = BULK_PRODUCT_PROVIDERS[connector.provider]
    if (!providerConfig) continue

    try {
      const products = await providerConfig.getProducts(connector, BULK_PRODUCT_LIMIT)
      const missing = products.filter((p) => !p.seoTitle || !p.seoDescription).slice(0, 10)

      let applied = 0
      let unsupported = 0
      for (const product of missing) {
        try {
          const seo = await generateProductSeo({ title: product.title, price: product.price })
          const result = await providerConfig.updateSeo(connector, product, seo)
          // Some providers (e.g. Wix Catalog V3) don't throw on an
          // unsupported write — they return { error, message } — so a
          // successful promise resolution alone doesn't mean it worked.
          if (result?.error) unsupported += 1
          else applied += 1
        } catch {
          // Skip this product, keep going — one bad product shouldn't stop the run.
        }
      }
      results.push({ provider: connector.provider, productsChecked: products.length, productsMissingSeo: missing.length, applied, unsupported })
    } catch (err) {
      results.push({ provider: connector.provider, error: err.message })
    }
  }

  return results
}

/**
 * Full unattended run: quietly fill in missing SEO, then send the weekly
 * report summarizing everything (including what this run itself just did).
 * Callable manually right now (see agent.routes.js / run_autonomous_agent_now
 * tool); wiring an actual weekly trigger needs a real scheduler tied to
 * wherever the backend ends up hosted (see startLocalDevScheduler for the
 * local-only stand-in).
 */
export async function runAutonomousAgent(companyId) {
  const seoFillResults = await autoFillMissingProductSeo(companyId)
  const reportResult = await sendWeeklyReport(companyId)
  return { ranAt: new Date().toISOString(), seoFillResults, report: reportResult }
}

/**
 * The scheduled/bulk version, unlike the manual chat-triggered run, has no
 * per-request plan check upstream (there's no request) — so it must filter
 * to Business-plan companies itself before doing any work.
 */
export async function runAutonomousAgentForAllCompanies() {
  const { rows } = await pool.query(
    `SELECT DISTINCT c.id AS company_id, c.plan FROM connectors co
     JOIN companies c ON c.id = co.company_id
     WHERE co.status = 'connected'`
  )
  const results = []
  for (const row of rows) {
    if (!planHasFeature(row.plan, 'agent')) continue
    try {
      results.push({ companyId: row.company_id, ...(await runAutonomousAgent(row.company_id)) })
    } catch (err) {
      results.push({ companyId: row.company_id, error: err.message })
    }
  }
  return results
}
