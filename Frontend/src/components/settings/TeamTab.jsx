import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserPlus, Loader2 } from 'lucide-react'
import Button from '../Button'
import { api } from '../../services/api'

function initialsFor(name, email) {
  const source = name || email || '?'
  return source.split(/[\s@.]/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export default function TeamTab() {
  const { t } = useTranslation()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getTeam().then(({ members }) => setMembers(members)).finally(() => setLoading(false))
  }, [])

  return (
    <div className="card-base overflow-hidden">
      <div className="flex items-center justify-between p-6 pb-4">
        <h2 className="text-lg font-semibold">{t('settings.team.heading')}</h2>
        <Button size="sm" variant="primary" disabled title={t('settings.team.comingSoon')}><UserPlus size={14} /> {t('settings.team.invite')}</Button>
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
                  </td>
                  <td className="px-6 py-4 text-xs text-on-muted whitespace-nowrap">{new Date(member.invited_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
