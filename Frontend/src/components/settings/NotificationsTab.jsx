import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'

const TOGGLE_KEYS = ['email', 'weekly']

export default function NotificationsTab() {
  const { t } = useTranslation()
  const { company, setCompany } = useAuth()
  const [saving, setSaving] = useState(null)
  const prefs = { email: true, weekly: true, ...company?.notificationPrefs }

  const toggle = async (key) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setSaving(key)
    setCompany((c) => ({ ...c, notificationPrefs: next }))
    try {
      await api.updateProfile({ notificationPrefs: next })
    } catch {
      setCompany((c) => ({ ...c, notificationPrefs: prefs }))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="card-base p-6 flex flex-col gap-2">
      <h2 className="text-lg font-semibold mb-2">{t('settings.notifications.heading')}</h2>
      {TOGGLE_KEYS.map((key) => (
        <div key={key} className="flex items-center justify-between gap-4 py-3">
          <div><span className="text-sm font-semibold">{t(`settings.notifications.${key}.label`)}</span><p className="text-sm text-on-muted">{t(`settings.notifications.${key}.desc`)}</p></div>
          <button
            className={`focus-ring w-11 h-6 rounded-full transition-colors flex-shrink-0 relative disabled:opacity-60 ${prefs[key] ? 'bg-primary' : 'bg-surface-6'}`}
            onClick={() => toggle(key)}
            disabled={saving === key}
            role="switch"
            aria-checked={prefs[key]}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${prefs[key] ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 py-3 opacity-60">
        <div>
          <span className="text-sm font-semibold">{t('settings.notifications.push.label')}</span>
          <p className="text-sm text-on-muted">{t('settings.notifications.push.desc')}</p>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-surface-6 text-on-muted text-[11px] font-semibold flex-shrink-0">{t('settings.comingSoon')}</span>
      </div>
    </div>
  )
}
