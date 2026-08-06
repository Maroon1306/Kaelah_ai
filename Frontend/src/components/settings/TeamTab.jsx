import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserPlus, Loader2, X, AlertCircle } from 'lucide-react'
import Button from '../Button'
import Modal from '../Modal'
import { api } from '../../services/api'

function initialsFor(name, email) {
  const source = name || email || '?'
  return source.split(/[\s@.]/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export default function TeamTab() {
  const { t } = useTranslation()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('collaborator')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')
  const [removingId, setRemovingId] = useState(null)

  const loadMembers = () => api.getTeam().then(({ members }) => setMembers(members)).finally(() => setLoading(false))

  useEffect(() => { loadMembers() }, [])

  const handleInvite = async (e) => {
    e.preventDefault()
    setError('')
    setInviting(true)
    try {
      await api.inviteTeamMember(email, role)
      setEmail('')
      setModalOpen(false)
      await loadMembers()
    } catch (err) {
      setError(err.message)
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (id) => {
    setRemovingId(id)
    try {
      await api.removeTeamMember(id)
      setMembers((prev) => prev.filter((m) => m.id !== id))
    } catch {
      // Leave the row in place — the user can retry.
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="card-base overflow-hidden">
      <div className="flex items-center justify-between p-6 pb-4">
        <h2 className="text-lg font-semibold">{t('settings.team.heading')}</h2>
        <Button size="sm" variant="primary" onClick={() => setModalOpen(true)}><UserPlus size={14} /> {t('settings.team.invite')}</Button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-10 text-on-muted"><Loader2 size={20} className="animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-y border-border bg-surface-3">
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-on-muted">{t('settings.team.columns.member')}</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-on-muted">{t('settings.team.columns.role')}</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-on-muted">{t('settings.team.columns.lastActive')}</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="px-6 py-4 flex items-center gap-3 whitespace-nowrap">
                    <div className="icon-tile text-primary w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{initialsFor(member.full_name, member.email)}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{member.full_name || member.email}</p>
                      <p className="text-[11px] text-on-muted truncate">{member.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-primary-dim text-primary border border-border">{t(`settings.team.roles.${member.role}`)}</span>
                    {member.status === 'invited' && <span className="ml-2 px-2 py-0.5 rounded-full bg-surface-6 text-on-muted">{t('settings.team.pending')}</span>}
                  </td>
                  <td className="px-6 py-4 text-xs text-on-muted whitespace-nowrap">{new Date(member.invited_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="focus-ring w-7 h-7 inline-flex items-center justify-center rounded-lg text-on-muted hover:bg-error-dim hover:text-error transition-colors disabled:opacity-50" onClick={() => handleRemove(member.id)} disabled={removingId === member.id} aria-label={t('common.close')}>
                      {removingId === member.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('settings.team.invite')}>
        <form onSubmit={handleInvite} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium">{t('settings.team.inviteEmail')}</label>
            <input type="email" required className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="collegue@exemple.com" autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium">{t('settings.team.columns.role')}</label>
            <select className="input-field" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="admin">{t('settings.team.roles.admin')}</option>
              <option value="collaborator">{t('settings.team.roles.collaborator')}</option>
              <option value="analyst">{t('settings.team.roles.analyst')}</option>
            </select>
          </div>
          {error && <p className="flex items-center gap-1.5 text-sm text-error"><AlertCircle size={14} className="flex-shrink-0" />{error}</p>}
          <Button type="submit" variant="primary" className="w-full" loading={inviting} disabled={!email.trim()}>{t('settings.team.sendInvite')}</Button>
        </form>
      </Modal>
    </div>
  )
}
