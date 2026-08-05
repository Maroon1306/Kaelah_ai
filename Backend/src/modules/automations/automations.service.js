import { pool } from '../../db/pool.js'
import { HttpError } from '../../middleware/errorHandler.js'

export async function list(companyId) {
  const { rows } = await pool.query('SELECT * FROM automations WHERE company_id = $1 ORDER BY created_at DESC', [companyId])
  return rows
}

export async function create(companyId, { triggerType, actionType, configuration }) {
  if (!triggerType || !actionType) throw new HttpError(400, 'trigger_type et action_type sont requis.')
  const { rows } = await pool.query(
    'INSERT INTO automations (company_id, trigger_type, action_type, configuration) VALUES ($1, $2, $3, $4) RETURNING *',
    [companyId, triggerType, actionType, JSON.stringify(configuration || {})]
  )
  return rows[0]
}

export async function update(companyId, id, { isActive, configuration }) {
  const { rows } = await pool.query(
    `UPDATE automations SET
       is_active = COALESCE($3, is_active),
       configuration = COALESCE($4, configuration)
     WHERE id = $1 AND company_id = $2 RETURNING *`,
    [id, companyId, isActive ?? null, configuration ? JSON.stringify(configuration) : null]
  )
  if (rows.length === 0) throw new HttpError(404, 'Automatisation introuvable.')
  return rows[0]
}

export async function remove(companyId, id) {
  await pool.query('DELETE FROM automations WHERE id = $1 AND company_id = $2', [id, companyId])
}

export async function findActive(companyId, triggerType, actionType) {
  const { rows } = await pool.query(
    'SELECT * FROM automations WHERE company_id = $1 AND trigger_type = $2 AND action_type = $3 AND is_active = true',
    [companyId, triggerType, actionType]
  )
  return rows[0] || null
}
