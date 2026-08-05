import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'

export default function AiPreferencesTab() {
  const { t, i18n } = useTranslation()
  const { company, setCompany } = useAuth()
  const [saving, setSaving] = useState(false)
  const aiPrefs = { tone: 'professional', autoActions: false, ...company?.aiPreferences }

  const persist = async (next) => {
    setSaving(true)
    setCompany((c) => ({ ...c, aiPreferences: next }))
    try {
      await api.updateProfile({ aiPreferences: next })
    } catch {
      setCompany((c) => ({ ...c, aiPreferences: aiPrefs }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card-base p-6 flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t('settings.ai.heading')}</h2>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium">{t('settings.ai.language')}</label>
        <div className="flex gap-2" role="radiogroup" aria-label={t('settings.ai.language')}>
          <button
            className={`focus-ring flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${i18n.language.startsWith('fr') ? 'bg-primary text-white' : 'border border-border-md text-on-surface hover:bg-surface-4'}`}
            onClick={() => i18n.changeLanguage('fr')}
            role="radio"
            aria-checked={i18n.language.startsWith('fr')}
          >
            {t('settings.ai.languageOptions.fr')}
          </button>
          <button
            className={`focus-ring flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${i18n.language.startsWith('en') ? 'bg-primary text-white' : 'border border-border-md text-on-surface hover:bg-surface-4'}`}
            onClick={() => i18n.changeLanguage('en')}
            role="radio"
            aria-checked={i18n.language.startsWith('en')}
          >
            {t('settings.ai.languageOptions.en')}
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5"><label className="text-[13px] font-medium">{t('settings.ai.tone')}</label>
        <select className="input-field" value={aiPrefs.tone} disabled={saving} onChange={(e) => persist({ ...aiPrefs, tone: e.target.value })}>
          <option value="professional">{t('settings.ai.toneOptions.professional')}</option>
          <option value="friendly">{t('settings.ai.toneOptions.friendly')}</option>
          <option value="concise">{t('settings.ai.toneOptions.concise')}</option>
        </select>
      </div>
      <div className="flex items-center justify-between gap-4 py-3">
        <div><span className="text-sm font-semibold">{t('settings.ai.autoActions')}</span><p className="text-sm text-on-muted">{t('settings.ai.autoActionsDesc')}</p></div>
        <button
          className={`focus-ring w-11 h-6 rounded-full transition-colors flex-shrink-0 relative disabled:opacity-60 ${aiPrefs.autoActions ? 'bg-primary' : 'bg-surface-6'}`}
          onClick={() => persist({ ...aiPrefs, autoActions: !aiPrefs.autoActions })}
          disabled={saving}
          role="switch"
          aria-checked={aiPrefs.autoActions}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${aiPrefs.autoActions ? 'translate-x-5' : ''}`} />
        </button>
      </div>
    </div>
  )
}
