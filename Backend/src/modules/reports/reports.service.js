import { pool } from '../../db/pool.js'
import { sendMail } from '../../utils/mailer.js'
import { analyzeUrl, analyzeGeoUrl } from '../seo/seo.service.js'
import { sendPushToCompany } from '../notifications/push.service.js'

/**
 * Best-effort homepage URL for a connector, derived from whatever was
 * captured during its own OAuth/connect flow — not every provider stores
 * one (BigCommerce's storefront domain can differ from its API storeHash,
 * Wix only stores an instanceId), so some connectors are skipped from the
 * scored part of the report and just show their connection status.
 */
function getConnectorSiteUrl(connector) {
  const { provider, config } = connector
  switch (provider) {
    case 'shopify': return config.shopDomain ? `https://${config.shopDomain}` : null
    case 'wordpress': return config.siteUrl || null
    case 'drupal': return config.siteUrl || null
    case 'prestashop': return config.shopUrl || null
    case 'bigcommerce': return config.storeHash ? `https://${config.storeHash}.mybigcommerce.com` : null
    default: return null
  }
}

async function getRecentActionsSummary(companyId, sinceDays = 7) {
  const { rows } = await pool.query(
    `SELECT a.function_name, a.status, a.created_at
     FROM actions a
     JOIN messages m ON m.id = a.message_id
     JOIN conversations c ON c.id = m.conversation_id
     WHERE c.company_id = $1 AND a.created_at > now() - ($2 || ' days')::interval
     ORDER BY a.created_at DESC`,
    [companyId, sinceDays]
  )
  return {
    total: rows.length,
    applied: rows.filter((r) => r.status === 'executed').length,
    failed: rows.filter((r) => r.status === 'failed').length,
    items: rows,
  }
}

export async function generateWeeklyReport(companyId) {
  const { rows: connectorRows } = await pool.query(
    "SELECT provider, status, config FROM connectors WHERE company_id = $1 AND status = 'connected'",
    [companyId]
  )

  const siteAudits = []
  for (const connector of connectorRows) {
    const siteUrl = getConnectorSiteUrl(connector)
    if (!siteUrl) {
      siteAudits.push({ provider: connector.provider, connected: true, audited: false })
      continue
    }
    try {
      const [seo, geo] = await Promise.all([analyzeUrl(siteUrl), analyzeGeoUrl(siteUrl)])
      siteAudits.push({ provider: connector.provider, connected: true, audited: true, url: siteUrl, seoScore: seo.score, geoScore: geo.score, seoIssues: seo.issues, geoIssues: geo.issues })
    } catch (err) {
      siteAudits.push({ provider: connector.provider, connected: true, audited: false, error: err.message })
    }
  }

  const actions = await getRecentActionsSummary(companyId)

  return {
    generatedAt: new Date().toISOString(),
    connectorsCount: connectorRows.length,
    siteAudits,
    actions,
  }
}

function renderReportHtml(report, companyName) {
  const auditRows = report.siteAudits
    .map((a) => {
      if (!a.audited) return `<tr><td>${a.provider}</td><td colspan="2">Connecté — audit non disponible pour ce connecteur</td></tr>`
      return `<tr><td>${a.provider}</td><td>SEO : ${a.seoScore}/100</td><td>GEO : ${a.geoScore}/100</td></tr>`
    })
    .join('')

  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
      <h1 style="font-size:20px;">Rapport hebdomadaire — ${companyName || ''}</h1>
      <p>Voici un résumé de la semaine sur vos boutiques connectées à Kaelah AI.</p>
      <h2 style="font-size:16px;">Scores par connecteur</h2>
      <table style="width:100%;border-collapse:collapse;" cellpadding="6">
        ${auditRows || '<tr><td>Aucun connecteur actif.</td></tr>'}
      </table>
      <h2 style="font-size:16px;margin-top:24px;">Actions cette semaine</h2>
      <p>${report.actions.applied} action(s) appliquée(s), ${report.actions.failed} échec(s), sur ${report.actions.total} proposée(s).</p>
      <p style="color:#888;font-size:12px;margin-top:32px;">Rapport généré le ${new Date(report.generatedAt).toLocaleString('fr-FR')}.</p>
    </div>
  `
}

export async function sendWeeklyReport(companyId) {
  const { rows } = await pool.query(
    `SELECT c.company_name, c.notification_prefs, u.email FROM companies c JOIN users u ON u.id = c.user_id WHERE c.id = $1`,
    [companyId]
  )
  if (rows.length === 0) return { sent: false, reason: 'company_not_found' }

  const report = await generateWeeklyReport(companyId)

  let result = { sent: false, reason: 'weekly_notifications_disabled' }
  if (rows[0].notification_prefs?.weekly !== false) {
    const html = renderReportHtml(report, rows[0].company_name)
    result = await sendMail({ to: rows[0].email, subject: 'Votre rapport hebdomadaire Kaelah AI', html })
  }

  await sendPushToCompany(companyId, {
    title: 'Rapport hebdomadaire disponible',
    body: `${report.actions.applied} action(s) appliquée(s) cette semaine sur ${report.connectorsCount} connecteur(s).`,
    url: '/chat',
  })

  return { ...result, report }
}
