import crypto from 'node:crypto'
import { pool } from '../../db/pool.js'
import { HttpError } from '../../middleware/errorHandler.js'
import { sendMail } from '../../utils/mailer.js'

const INVITE_EXPIRES_DAYS = 7

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function listMembers(companyId) {
  const { rows } = await pool.query(
    `SELECT cm.id, cm.email, cm.role, cm.status, cm.invited_at, u.full_name
     FROM company_members cm
     LEFT JOIN users u ON u.id = cm.user_id
     WHERE cm.company_id = $1 ORDER BY cm.invited_at ASC`,
    [companyId]
  )
  return rows
}

export async function inviteMember(company, inviterName, email, role) {
  if (!email || !email.trim()) throw new HttpError(400, 'Email requis.')
  if (!['admin', 'collaborator', 'analyst'].includes(role)) throw new HttpError(400, 'Rôle invalide.')

  const { rows: existing } = await pool.query(
    "SELECT id, status FROM company_members WHERE company_id = $1 AND email = $2",
    [company.id, email]
  )
  if (existing.some((m) => m.status === 'active')) throw new HttpError(409, 'Cette personne fait déjà partie de ton équipe.')

  const token = crypto.randomBytes(24).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + INVITE_EXPIRES_DAYS * 24 * 60 * 60 * 1000)

  let member
  if (existing.length > 0) {
    const { rows } = await pool.query(
      `UPDATE company_members SET role = $2, status = 'invited', invite_token_hash = $3, invite_expires_at = $4, invited_at = now()
       WHERE id = $1 RETURNING id, email, role, status, invited_at`,
      [existing[0].id, role, tokenHash, expiresAt]
    )
    member = rows[0]
  } else {
    const { rows } = await pool.query(
      `INSERT INTO company_members (company_id, email, role, status, invite_token_hash, invite_expires_at)
       VALUES ($1, $2, $3, 'invited', $4, $5) RETURNING id, email, role, status, invited_at`,
      [company.id, email, role, tokenHash, expiresAt]
    )
    member = rows[0]
  }

  const acceptUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/team/accept?token=${token}`
  await sendMail({
    to: email,
    subject: `${inviterName} t'invite à rejoindre ${company.name} sur Kaelah AI`,
    html: `<p>${inviterName} t'invite à rejoindre l'équipe <strong>${company.name}</strong> sur Kaelah AI.</p><p><a href="${acceptUrl}">Accepter l'invitation</a></p><p>Ce lien expire dans ${INVITE_EXPIRES_DAYS} jours. Si tu n'as pas encore de compte Kaelah AI, tu pourras en créer un avec cette même adresse email avant que le lien ne te rattache à l'équipe.</p>`,
  }).catch((err) => console.error('[team] Échec envoi invitation:', err.message))

  return member
}

export async function acceptInvite(token, user) {
  const tokenHash = hashToken(token)
  const { rows } = await pool.query(
    `SELECT id, company_id, email, invite_expires_at FROM company_members
     WHERE invite_token_hash = $1 AND status = 'invited'`,
    [tokenHash]
  )
  if (rows.length === 0) throw new HttpError(400, 'Invitation invalide ou déjà utilisée.')
  const invite = rows[0]
  if (new Date(invite.invite_expires_at) < new Date()) throw new HttpError(400, 'Cette invitation a expiré, demande-en une nouvelle.')
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new HttpError(403, `Cette invitation a été envoyée à ${invite.email} — connecte-toi avec ce compte pour l'accepter.`)
  }

  await pool.query(
    `UPDATE company_members SET user_id = $2, status = 'active', invite_token_hash = NULL, invite_expires_at = NULL WHERE id = $1`,
    [invite.id, user.id]
  )
  return { companyId: invite.company_id }
}

export async function removeMember(companyId, memberId) {
  const { rowCount } = await pool.query('DELETE FROM company_members WHERE id = $1 AND company_id = $2', [memberId, companyId])
  if (rowCount === 0) throw new HttpError(404, 'Membre introuvable.')
}
