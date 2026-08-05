import cron from 'node-cron'
import { runAutonomousAgentForAllCompanies } from './agent.service.js'

/**
 * Local-dev-only stand-in for a real production scheduler. Runs in-process
 * with node-cron, so it only fires while this exact backend process stays
 * alive — fine for local testing, not for production (a restart, deploy, or
 * scale-to-zero silently drops the schedule). Once hosting is decided, this
 * should be replaced with an external trigger (Cloud Scheduler hitting
 * POST /api/agent/run-all, a platform cron add-on, etc.) calling the same
 * runAutonomousAgentForAllCompanies() function — not rewritten from scratch.
 *
 * Disabled unless AGENT_CRON_ENABLED=true, since running it unexpectedly
 * would mutate real connected stores.
 */
export function startLocalDevScheduler() {
  if (process.env.AGENT_CRON_ENABLED !== 'true') return

  const schedule = process.env.AGENT_CRON_SCHEDULE || '0 6 * * 0' // Sundays 06:00
  cron.schedule(schedule, async () => {
    console.log('[agent] Running scheduled autonomous run for all companies...')
    try {
      const results = await runAutonomousAgentForAllCompanies()
      console.log(`[agent] Scheduled run complete for ${results.length} compan${results.length === 1 ? 'y' : 'ies'}.`)
    } catch (err) {
      console.error('[agent] Scheduled run failed:', err.message)
    }
  })
  console.log(`[agent] Local dev scheduler enabled (${schedule}).`)
}
