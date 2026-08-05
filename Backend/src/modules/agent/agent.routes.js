import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { requireAuth } from '../../middleware/auth.js'
import { HttpError } from '../../middleware/errorHandler.js'
import { planHasFeature } from '../../config/plans.js'
import { runAutonomousAgent } from './agent.service.js'

export const agentRouter = Router()

agentRouter.use(requireAuth)

// Manual trigger — real weekly triggering needs a scheduler tied to actual
// hosting (see agent.scheduler.js), not decided yet, so this is how the
// agent gets tested/run for now. Checked directly here (not just via the
// chat tool's feature gate) since this HTTP route can be called on its own.
agentRouter.post('/run', asyncHandler(async (req, res) => {
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  if (!planHasFeature(req.company.plan, 'agent')) {
    throw new HttpError(402, "L'agent autonome n'est pas inclus dans ton forfait actuel. Passe au forfait Business pour le débloquer.")
  }
  res.json(await runAutonomousAgent(req.company.id))
}))
