import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building2, ShoppingBag, Briefcase, ArrowRight, ArrowLeft, Check, AlertCircle } from 'lucide-react'
import Button from '../components/Button'
import KaelahLogo from '../components/KaelahLogo'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { businessTypes } from '../data/mockData'

const iconMap = { ShoppingBag, Building2, Briefcase }
const REDIRECT_SECONDS = 3

export default function Onboarding() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const [step, setStep] = useState(0)
  const [companyName, setCompanyName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const steps = [t('onboarding.steps.welcome'), t('onboarding.steps.company'), t('onboarding.steps.activity'), t('onboarding.steps.done')]
  const canProceed = step === 0 || (step === 1 && companyName.trim()) || (step === 2 && businessType)

  const goToNext = () => {
    const pending = sessionStorage.getItem('kaelah_redirect_after_auth')
    if (pending) {
      sessionStorage.removeItem('kaelah_redirect_after_auth')
      navigate(pending)
    } else {
      navigate('/chat')
    }
  }

  const handleContinue = async () => {
    if (step !== 2) { setStep((s) => s + 1); return }
    setSaving(true)
    setError('')
    try {
      await api.updateProfile({ companyName, companyType: businessType })
      await refreshProfile()
      setStep(3)
    } catch (err) {
      setError(err.message || 'Une erreur est survenue.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (step !== 3) return
    setCountdown(REDIRECT_SECONDS)
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(interval); goToNext(); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [step, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bg relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-gradient-radial-primary rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-gradient-radial-accent rounded-full blur-3xl pointer-events-none" />
      <div className="w-full max-w-[560px] relative z-10">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((label, i) => (
            <div key={label} className={`h-1 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-primary' : 'w-4 bg-surface-6'}`} aria-label={label} />
          ))}
        </div>

        <div className="glass ai-glow rounded-2xl p-8 flex flex-col gap-6">
          {step === 0 && (
            <div className="flex flex-col items-center text-center animate-fade-in">
              <h1 className="text-2xl font-bold tracking-tight">{t('onboarding.step0.title')}</h1>
              <p className="text-sm text-on-muted mt-2 max-w-sm">{t('onboarding.step0.subtitle')}</p>
              <div className="relative w-full aspect-video rounded-xl overflow-hidden mt-6 mb-2 border border-border bg-surface-3">
                <div className="absolute inset-0 bg-gradient-radial-primary opacity-60" />
                <div className="absolute inset-0 bg-gradient-radial-accent opacity-40" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-surface-2 border border-border flex items-center justify-center ai-glow animate-pulse-glow">
                    <KaelahLogo size={44} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col items-center text-center animate-fade-in min-h-[200px] justify-center">
              <h1 className="text-2xl font-bold tracking-tight">{t('onboarding.step1.title')}</h1>
              <p className="text-sm text-on-muted mt-2">{t('onboarding.step1.subtitle')}</p>
              <input type="text" placeholder={t('onboarding.step1.placeholder')} value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoFocus className="input-field mt-4 text-center text-lg max-w-[400px]" />
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center text-center animate-fade-in min-h-[200px] justify-center">
              <h1 className="text-2xl font-bold tracking-tight">{t('onboarding.step2.title')}</h1>
              <p className="text-sm text-on-muted mt-2">{t('onboarding.step2.subtitle')}</p>
              <div className="flex flex-col gap-3 w-full max-w-[400px] mt-4">
                {businessTypes.map((type) => {
                  const Icon = iconMap[type.icon] || ShoppingBag
                  return (
                    <button key={type.id} className={`focus-ring flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${businessType === type.id ? 'border-primary bg-primary-dim shadow-glow-sm' : 'border-border bg-surface-4 hover:bg-surface-6 hover:border-border-md'}`} onClick={() => setBusinessType(type.id)}>
                      <div className="icon-tile text-primary w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0"><Icon size={22} /></div>
                      <div className="flex flex-col gap-0.5 flex-1">
                        <span className="text-base font-semibold">{t(`mock.businessTypes.${type.id}.label`)}</span>
                        <span className="text-sm text-on-muted">{t(`mock.businessTypes.${type.id}.desc`)}</span>
                      </div>
                      {businessType === type.id && <div className="w-6 h-6 rounded-md bg-primary text-white flex items-center justify-center"><Check size={16} /></div>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center text-center animate-fade-in min-h-[200px] justify-center">
              <div className="relative w-20 h-20 flex items-center justify-center rounded-full bg-success-dim text-success mb-4">
                <Check size={32} />
                <div className="absolute inset-0 rounded-full bg-success/20 animate-ping opacity-40" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{t('onboarding.step3.title')}</h1>
              <p className="text-lg text-on-muted mt-2">{companyName ? t('onboarding.step3.subtitleWithName', { name: companyName }) : t('onboarding.step3.subtitle')}</p>
              <Button variant="ai" size="lg" className="w-full mt-6" onClick={goToNext}>{t('onboarding.goToChat')} <ArrowRight size={16} /></Button>
              <p className="text-xs text-on-dim mt-3" role="status" aria-live="polite">{t('onboarding.redirecting', { seconds: countdown })}</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-error-dim text-error text-[13px]">
              <AlertCircle size={15} className="flex-shrink-0" /><span>{error}</span>
            </div>
          )}

          {step < 3 && (
            <div className="flex items-center gap-2">
              {step > 0 && <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={saving}><ArrowLeft size={16} /> {t('onboarding.back')}</Button>}
              <div className="flex-1" />
              <Button variant="ai" onClick={handleContinue} disabled={!canProceed} loading={saving}>{t('onboarding.continue')} <ArrowRight size={16} /></Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
