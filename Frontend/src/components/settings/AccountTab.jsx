import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sparkles, Mail, Building, Zap, TrendingUp, Plug, AlertCircle, CheckCircle2 } from 'lucide-react'
import Button from '../Button'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'

export default function AccountTab() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, company, refreshProfile, logout } = useAuth()

  const [usage, setUsage] = useState(null)
  const [fullName, setFullName] = useState(user?.fullName || '')
  const [companyName, setCompanyName] = useState(company?.name || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [status, setStatus] = useState(null) // { type: 'success'|'error', message }

  useEffect(() => {
    api.getProfile().then((data) => setUsage(data.usage)).catch(() => {})
  }, [])

  useEffect(() => {
    setFullName(user?.fullName || '')
    setCompanyName(company?.name || '')
  }, [user, company])

  const infoItems = [
    { icon: Mail, label: t('profile.info.email'), value: user?.email || '' },
    { icon: Building, label: t('profile.info.company'), value: company?.name || '' },
    { icon: Zap, label: t('profile.info.type'), value: company?.type || t('profile.info.typeValue') },
  ]

  const stats = [
    { icon: Zap, value: (usage?.messagesUsed ?? 0).toLocaleString(), label: t('profile.stats.messages') },
    { icon: TrendingUp, value: usage?.automations ?? 0, label: t('profile.stats.automations') },
    { icon: Plug, value: usage?.connectorsUsed ?? 0, label: t('profile.stats.connectors') },
  ]

  const handleSave = async () => {
    setSaving(true)
    setStatus(null)
    try {
      await api.updateProfile({ fullName, companyName })
      await refreshProfile()
      setStatus({ type: 'success', message: t('common.save') })
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(t('profile.dangerZone.confirm'))) return
    setDeleting(true)
    try {
      await api.deleteAccount()
      await logout()
      navigate('/')
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
      setDeleting(false)
    }
  }

  const initials = user?.fullName ? user.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() : '?'

  return (
    <div className="flex flex-col gap-6">
      {/* Identity header */}
      <div className="card-base p-7 flex items-center gap-6 flex-wrap">
        <div className="w-20 h-20 rounded-2xl bg-gradient-ai text-white flex items-center justify-center text-2xl font-bold ai-glow flex-shrink-0">{initials}</div>
        <div className="flex-1 flex flex-col gap-2">
          <h2 className="text-xl font-semibold">{user?.fullName}</h2>
          <p className="text-on-muted">{t('profile.companyLine', { company: company?.name || '' })}</p>
          <div className="flex gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-4 border border-border text-xs font-medium text-on-muted"><Sparkles size={12} /> {t(`billing.planNames.${company?.plan || 'starter'}`)}</span>
          </div>
        </div>
      </div>

      {/* Editable account form */}
      <div className="card-base p-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t('settings.account.heading')}</h2>
        {status && (
          <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-[13px] ${status.type === 'error' ? 'bg-error-dim text-error' : 'bg-success-dim text-success'}`}>
            {status.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}<span>{status.message}</span>
          </div>
        )}
        <div className="flex flex-col gap-1.5"><label className="text-[13px] font-medium">{t('settings.account.fullName')}</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field" /></div>
        <div className="flex flex-col gap-1.5"><label className="text-[13px] font-medium">{t('settings.account.email')}</label><input type="email" value={user?.email || ''} disabled className="input-field opacity-60 cursor-not-allowed" /></div>
        <div className="flex flex-col gap-1.5"><label className="text-[13px] font-medium">{t('settings.account.companyName')}</label><input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input-field" /></div>
        <Button variant="primary" className="w-fit" onClick={handleSave} loading={saving}>{t('settings.account.save')}</Button>
      </div>

      {/* Info grid */}
      <div className="grid sm:grid-cols-3 gap-4">
        {infoItems.map((item) => (
          <div key={item.label} className="card-base flex items-center gap-3 px-5 py-4">
            <div className="icon-tile text-primary w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0"><item.icon size={18} /></div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-semibold uppercase tracking-wide text-on-muted">{item.label}</span>
              <p className="text-sm truncate">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('profile.statsHeading')}</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="card-base p-6 flex flex-col items-center gap-1.5 text-center">
              <div className="icon-tile text-primary w-11 h-11 flex items-center justify-center rounded-xl mb-1"><stat.icon size={20} /></div>
              <span className="text-2xl font-bold tracking-tight">{stat.value}</span>
              <span className="text-sm text-on-muted">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="card-base p-6 flex flex-col gap-3" style={{ borderColor: 'color-mix(in srgb, var(--color-error) 30%, transparent)' }}>
        <h3 className="text-base font-semibold text-error">{t('profile.dangerZone.heading')}</h3>
        <p className="text-sm text-on-muted">{t('profile.dangerZone.desc')}</p>
        <Button variant="danger" className="w-fit" onClick={handleDelete} loading={deleting}>{t('profile.dangerZone.delete')}</Button>
      </div>
    </div>
  )
}
