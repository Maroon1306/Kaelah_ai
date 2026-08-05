import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import Button from '../Button'
import { api } from '../../services/api'

export default function SecurityTab() {
  const { t } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleUpdate = async () => {
    setError('')
    setSuccess(false)
    if (newPassword.length < 8) { setError(t('settings.security.passwordTooShort')); return }
    setSaving(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="card-base p-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t('settings.security.heading')}</h2>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium">{t('settings.security.currentPassword')}</label>
          <input type="password" placeholder="••••••••" className="input-field" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium">{t('settings.security.newPassword')}</label>
          <input type="password" placeholder="••••••••" className="input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
        </div>
        {error && <p className="flex items-center gap-1.5 text-sm text-error"><AlertCircle size={14} className="flex-shrink-0" />{error}</p>}
        {success && <p className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 size={14} className="flex-shrink-0" />{t('settings.security.updateSuccess')}</p>}
        <Button variant="primary" className="w-fit" onClick={handleUpdate} loading={saving} disabled={!currentPassword || !newPassword}>
          {saving ? t('settings.security.updating') : t('settings.security.update')}
        </Button>
      </div>
      <div className="card-base p-6 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">{t('settings.security.twoFactorHeading')}</h3>
          <span className="px-2.5 py-1 rounded-full bg-surface-6 text-on-muted text-[11px] font-semibold flex-shrink-0">{t('settings.comingSoon')}</span>
        </div>
        <p className="text-sm text-on-muted">{t('settings.security.twoFactorDesc')}</p>
        <Button variant="secondary" className="w-fit" disabled>{t('settings.security.enable2fa')}</Button>
      </div>
    </>
  )
}
