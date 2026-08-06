import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertCircle, CheckCircle2, Loader2, Users } from 'lucide-react'
import Button from '../components/Button'
import KaelahLogo from '../components/KaelahLogo'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

export default function TeamAccept() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState('pending')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); setError(t('teamAccept.invalidLink')); return }
    let cancelled = false
    api.acceptTeamInvite(token)
      .then(async () => {
        await refreshProfile()
        if (!cancelled) setStatus('success')
      })
      .catch((err) => {
        if (!cancelled) { setStatus('error'); setError(err.message || t('teamAccept.genericError')) }
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <div className="h-screen overflow-hidden flex items-center justify-center p-4 relative">
      <div className="fixed -top-[10%] -left-[10%] w-[45%] h-[45%] bg-gradient-radial-primary rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-[10%] -right-[10%] w-[35%] h-[35%] bg-gradient-radial-accent rounded-full blur-3xl pointer-events-none" />

      <main className="w-full max-w-[440px] relative z-10">
        <div className="glass ai-glow rounded-2xl p-7 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <KaelahLogo size={26} />
            <span className="text-[15px] font-bold tracking-tight">{t('common.brand')}<span className="text-accent">{t('common.brandSuffix')}</span></span>
          </div>

          {status === 'pending' && (
            <>
              <Loader2 size={28} className="mx-auto mb-3 animate-spin text-primary" />
              <p className="text-sm text-on-muted">{t('teamAccept.loading')}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-success-dim"><CheckCircle2 size={28} className="text-success" /></div>
              <h1 className="text-lg font-semibold mb-1.5">{t('teamAccept.successTitle')}</h1>
              <p className="text-sm text-on-muted mb-5">{t('teamAccept.successDesc')}</p>
              <Button variant="ai" className="w-full" onClick={() => navigate('/chat')}><Users size={16} /> {t('teamAccept.goToChat')}</Button>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle size={28} className="mx-auto mb-3 text-error" />
              <p className="text-sm text-on-muted mb-5">{error}</p>
              <Button variant="secondary" className="w-full" onClick={() => navigate('/chat')}>{t('teamAccept.backToApp')}</Button>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
