import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

export default function EmailVerifyBanner() {
  const { t } = useTranslation()
  const { user, refreshProfile } = useAuth()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  if (!user || user.emailVerified) return null

  const handleVerify = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.verifyEmail(code)
      await refreshProfile()
    } catch (err) {
      setError(err.message || t('emailVerify.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setError('')
    try {
      await api.resendOtp()
      setSent(true)
    } catch (err) {
      setError(err.message || t('emailVerify.error'))
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-warning-dim text-warning text-[13px] border-b border-border">
      <Mail size={16} className="flex-shrink-0" />
      <span className="flex-shrink-0">{t('emailVerify.prompt', { email: user.email })}</span>
      <form onSubmit={handleVerify} className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder={t('emailVerify.codePlaceholder')}
          className="focus-ring w-24 px-2 py-1 rounded-md bg-surface-3 border border-border text-on-surface text-center tracking-widest"
        />
        <button type="submit" disabled={loading || code.length !== 6} className="focus-ring px-3 py-1 rounded-md bg-warning text-black font-semibold disabled:opacity-50">
          {loading ? <Loader2 size={14} className="animate-spin" /> : t('emailVerify.confirm')}
        </button>
      </form>
      <button onClick={handleResend} disabled={resending} className="focus-ring underline disabled:opacity-50">
        {resending ? t('emailVerify.sending') : sent ? t('emailVerify.resent') : t('emailVerify.resend')}
      </button>
      {error && <span className="text-error">{error}</span>}
    </div>
  )
}
