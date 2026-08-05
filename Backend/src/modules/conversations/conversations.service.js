import { pool } from '../../db/pool.js'
import { getOpenAIClient, OPENAI_MODEL } from '../../ai/openai.client.js'
import { HttpError } from '../../middleware/errorHandler.js'

export async function listConversations(companyId) {
  const { rows } = await pool.query(
    'SELECT id, title, created_at, updated_at FROM conversations WHERE company_id = $1 ORDER BY updated_at DESC',
    [companyId]
  )
  return rows
}

export async function getConversationWithMessages(companyId, conversationId) {
  const { rows: convRows } = await pool.query(
    'SELECT id, title, created_at, updated_at FROM conversations WHERE id = $1 AND company_id = $2',
    [conversationId, companyId]
  )
  if (convRows.length === 0) throw new HttpError(404, 'Conversation introuvable.')

  const { rows: messages } = await pool.query(
    'SELECT id, role, content, metadata, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId]
  )
  return { ...convRows[0], messages }
}

async function generateTitle(firstMessage) {
  const client = getOpenAIClient()
  if (!client) return firstMessage.slice(0, 60)
  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'Génère un titre court (5 mots maximum, sans guillemets) résumant cette conversation. Réponds uniquement avec le titre.' },
        { role: 'user', content: firstMessage },
      ],
      max_tokens: 20,
    })
    return completion.choices[0].message.content.trim().replace(/^"|"$/g, '') || firstMessage.slice(0, 60)
  } catch {
    return firstMessage.slice(0, 60)
  }
}

export async function createConversation(companyId, firstMessage) {
  const title = await generateTitle(firstMessage)
  const { rows } = await pool.query(
    'INSERT INTO conversations (company_id, title) VALUES ($1, $2) RETURNING id, title, created_at, updated_at',
    [companyId, title]
  )
  return rows[0]
}

export async function touchConversation(conversationId) {
  await pool.query('UPDATE conversations SET updated_at = now() WHERE id = $1', [conversationId])
}

export async function assertOwnership(companyId, conversationId) {
  const { rows } = await pool.query('SELECT id FROM conversations WHERE id = $1 AND company_id = $2', [conversationId, companyId])
  if (rows.length === 0) throw new HttpError(404, 'Conversation introuvable.')
}

export async function addMessage(conversationId, role, content, metadata = {}) {
  const { rows } = await pool.query(
    'INSERT INTO messages (conversation_id, role, content, metadata) VALUES ($1, $2, $3, $4) RETURNING id, role, content, metadata, created_at',
    [conversationId, role, content, JSON.stringify(metadata)]
  )
  return rows[0]
}

export async function getRecentHistory(conversationId, limit = 20) {
  const { rows } = await pool.query(
    'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT $2',
    [conversationId, limit]
  )
  return rows.reverse()
}

/**
 * User messages sent by this company since the start of the current
 * calendar month — the basis for the plan's messagesPerMonth quota.
 */
export async function countMessagesThisMonth(companyId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE c.company_id = $1 AND m.role = 'user' AND m.created_at >= date_trunc('month', now())`,
    [companyId]
  )
  return rows[0].count
}
