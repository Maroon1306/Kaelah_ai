import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Send, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { api } from '../../services/api'
import { isPushSupported, getExistingPushSubscription, subscribeToPush, unsubscribeFromPush } from '../../utils/push'

const TOGGLE_KEYS = ['email', 'weekly']

export default function NotificationsTab() {
  const { t } = useTranslation()
  const { company, setCompany } = useAuth()
  const showToast = useToast()
  const [saving, setSaving] = useState(null)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')
  const [testing, setTesting] = useState(false)
  const prefs = { email: true, weekly: true, ...company?.notificationPrefs }

  useEffect(() => {
    if (!isPushSupported()) return
    getExistingPushSubscription().then((sub) => setPushEnabled(!!sub)).catch(() => {})
  }, [])

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

  const togglePush = async () => {
    setPushError('')
    setPushBusy(true)
    try {
      if (pushEnabled) {
        const sub = await unsubscribeFromPush()
        if (sub) await api.unsubscribePush(sub.endpoint)
        setPushEnabled(false)
      } else {
        const { publicKey } = await api.getPushPublicKey()
        if (!publicKey) throw new Error(t('settings.notifications.push.notConfigured'))
        const sub = await subscribeToPush(publicKey)
        await api.subscribePush(sub.toJSON())
        setPushEnabled(true)
      }
    } catch (err) {
      setPushError(err.message || t('settings.notifications.push.error'))
    } finally {
      setPushBusy(false)
    }
  }

  const sendTestPush = async () => {
    setTesting(true)
    try {
      const result = await api.testPush()
      showToast(result.sent ? t('settings.notifications.push.testSent') : t('settings.notifications.push.testFailed'), result.sent ? 'success' : 'error')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setTesting(false)
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
      <div className="flex items-center justify-between gap-4 py-3">
        <div>
          <span className="text-sm font-semibold">{t('settings.notifications.push.label')}</span>
          <p className="text-sm text-on-muted">{t('settings.notifications.push.desc')}</p>
        </div>
        {isPushSupported() ? (
          <button
            className={`focus-ring w-11 h-6 rounded-full transition-colors flex-shrink-0 relative disabled:opacity-60 ${pushEnabled ? 'bg-primary' : 'bg-surface-6'}`}
            onClick={togglePush}
            disabled={pushBusy}
            role="switch"
            aria-checked={pushEnabled}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${pushEnabled ? 'translate-x-5' : ''}`} />
          </button>
        ) : (
          <span className="px-2.5 py-1 rounded-full bg-surface-6 text-on-muted text-[11px] font-semibold flex-shrink-0">{t('settings.notifications.push.unsupported')}</span>
        )}
      </div>
      {pushEnabled && (
        <button
          className="focus-ring w-fit flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-60"
          onClick={sendTestPush}
          disabled={testing}
        >
          {testing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          {t('settings.notifications.push.test')}
        </button>
      )}
      {pushError && <p className="flex items-center gap-1.5 text-sm text-error"><AlertCircle size={14} className="flex-shrink-0" />{pushError}</p>}
    </div>
  )
}
