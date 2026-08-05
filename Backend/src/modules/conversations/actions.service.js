import { pool } from '../../db/pool.js'
import { HttpError } from '../../middleware/errorHandler.js'
import { findTool } from '../../ai/tools.js'
import { getToolFeature } from '../../ai/toolAccess.js'
import { planHasFeature } from '../../config/plans.js'

export async function createAction(messageId, functionName, args) {
  const { rows } = await pool.query(
    'INSERT INTO actions (message_id, function_name, arguments, status) VALUES ($1, $2, $3, $4) RETURNING id, function_name, arguments, status, created_at',
    [messageId, functionName, JSON.stringify(args), 'proposed']
  )
  return rows[0]
}

export async function getAction(actionId) {
  const { rows } = await pool.query(
    `SELECT a.*, m.conversation_id, c.company_id
     FROM actions a
     JOIN messages m ON m.id = a.message_id
     JOIN conversations c ON c.id = m.conversation_id
     WHERE a.id = $1`,
    [actionId]
  )
  return rows[0]
}

export async function confirmAction(actionId, companyId) {
  const action = await getAction(actionId)
  if (!action) throw new HttpError(404, 'Action introuvable.')
  if (action.company_id !== companyId) throw new HttpError(403, 'Action non autorisée.')
  if (action.status !== 'proposed') throw new HttpError(400, 'Cette action a déjà été traitée.')

  const tool = findTool(action.function_name)
  if (!tool) throw new HttpError(400, 'Action inconnue.')

  const feature = getToolFeature(action.function_name)
  if (feature) {
    const { rows } = await pool.query('SELECT plan FROM companies WHERE id = $1', [companyId])
    if (!planHasFeature(rows[0]?.plan, feature)) {
      throw new HttpError(402, "Cette action fait partie d'une fonctionnalité qui n'est pas incluse dans ton forfait actuel. Passe à un forfait supérieur dans Paramètres > Facturation pour l'utiliser.")
    }
  }

  try {
    const result = await tool.execute(action.arguments, { companyId })
    const status = result?.error ? 'failed' : 'executed'
    await pool.query('UPDATE actions SET status = $2, result = $3 WHERE id = $1', [action.id, status, JSON.stringify(result)])
    return { status, result }
  } catch (err) {
    await pool.query('UPDATE actions SET status = $2, result = $3 WHERE id = $1', [action.id, 'failed', JSON.stringify({ error: err.message })])
    throw new HttpError(500, `Échec de l'action: ${err.message}`)
  }
}

export async function getRecentActions(companyId, limit = 5) {
  const { rows } = await pool.query(
    `SELECT a.id, a.function_name, a.status, a.created_at
     FROM actions a
     JOIN messages m ON m.id = a.message_id
     JOIN conversations c ON c.id = m.conversation_id
     WHERE c.company_id = $1
     ORDER BY a.created_at DESC
     LIMIT $2`,
    [companyId, limit]
  )
  return rows
}

export async function rejectAction(actionId, companyId) {
  const action = await getAction(actionId)
  if (!action) throw new HttpError(404, 'Action introuvable.')
  if (action.company_id !== companyId) throw new HttpError(403, 'Action non autorisée.')
  await pool.query('UPDATE actions SET status = $2 WHERE id = $1', [actionId, 'rejected'])
}
