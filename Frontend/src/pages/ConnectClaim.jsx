import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Loader2, ShieldCheck, Store } from 'lucide-react'
import Button from '../components/Button'
import KaelahLogo from '../components/KaelahLogo'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

const PROVIDER_META = {
  bigcommerce: { name: 'BigCommerce', color: '#34313F', claim: (claim) => api.bigcommerceClaim({ claim }) },
  wix: { name: 'Wix Stores', color: '#0C6EFC', claim: (claim) => api.wixClaim({ claim }) },
}

export default function ConnectClaim({ provider }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { company } = useAuth()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const claim = searchParams.get('claim')
  const store = searchParams.get('store')
  const meta = PROVIDER_META[provider]

  if (!meta || !claim) {
    return (
      <div className="h-screen flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-7 max-w-[420px] text-center">
          <AlertCircle size={28} className="mx-auto mb-3 text-error" />
          <p className="text-sm text-on-muted">{t('connectAuthorize.invalidLink')}</p>
          <Button variant="secondary" className="mt-5" onClick={() => navigate('/settings?tab=connectors')}>{t('connectAuthorize.backToSettings')}</Button>
        </div>
      </div>
    )
  }

  const handleClaim = async () => {
    setLoading(true)
    setError('')
    try {
      await meta.claim(claim)
      navigate(`/settings?tab=connectors&connected=${provider}`)
    } catch (err) {
      setError(err.message || t('connectAuthorize.genericError'))
      setLoading(false)
    }
  }

  return (
    <div className="h-screen overflow-hidden flex items-center justify-center p-4 relative">
      <div className="fixed -top-[10%] -left-[10%] w-[45%] h-[45%] bg-gradient-radial-primary rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-[10%] -right-[10%] w-[35%] h-[35%] bg-gradient-radial-accent rounded-full blur-3xl pointer-events-none" />

      <main className="w-full max-w-[440px] relative z-10">
        <div className="glass ai-glow rounded-2xl p-7">
          <div className="flex items-center gap-2 mb-6">
            <KaelahLogo size={26} />
            <span className="text-[15px] font-bold tracking-tight">{t('common.brand')}<span className="text-accent">{t('common.brandSuffix')}</span></span>
          </div>

          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="w-14 h-14 flex items-center justify-center rounded-xl icon-tile">
              <KaelahLogo size={26} />
            </div>
            <span className="text-2xl text-on-dim">+</span>
            <div className="w-14 h-14 flex items-center justify-center rounded-xl" style={{ background: `${meta.color}20` }}>
              <Store size={26} style={{ color: meta.color }} />
            </div>
          </div>

          <h1 className="text-lg font-semibold text-center mb-1.5">{t('connectAuthorize.title', { provider: meta.name })}</h1>
          <p className="text-sm text-on-muted text-center mb-5">
            {t('connectAuthorize.description', { site: store, company: company?.name || '' })}
          </p>

          {error && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-error-dim text-error text-[13px] mb-4">
              <AlertCircle size={15} className="flex-shrink-0" /><span>{error}</span>
            </div>
          )}

          <div className="flex items-start gap-2.5 p-3 bg-surface-3 rounded-lg text-[12px] text-on-muted mb-5">
            <ShieldCheck size={16} className="flex-shrink-0 mt-0.5 text-success" />
            <span>{t('connectAuthorize.permissions')}</span>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/settings?tab=connectors')} disabled={loading}>{t('common.cancel')}</Button>
            <Button variant="ai" className="flex-1" onClick={handleClaim} loading={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : t('connectAuthorize.authorize')}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
