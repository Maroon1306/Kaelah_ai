import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import { Mail, Lock, Eye, EyeOff, User, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Button from './Button'
import KaelahLogo from './KaelahLogo'

export default function AuthCard({ initialMode = 'login' }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { login, register } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const switchMode = (next) => {
    setMode(next)
    setError('')
    navigate(next === 'login' ? '/login' : '/register', { replace: true })
  }

  const toggleLanguage = () => i18n.changeLanguage(i18n.language.startsWith('fr') ? 'en' : 'fr')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const from = location.state?.from
    try {
      if (mode === 'login') {
        await login(email, password)
        navigate(from ? `${from.pathname}${from.search || ''}` : '/chat')
      } else {
        await register(fullName, email, password)
        if (from) sessionStorage.setItem('kaelah_redirect_after_auth', `${from.pathname}${from.search || ''}`)
        navigate('/onboarding')
      }
    } catch (err) {
      setError(err.message || 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen overflow-hidden flex items-center justify-center p-4 relative">
      <div className="fixed -top-[10%] -left-[10%] w-[45%] h-[45%] bg-gradient-radial-primary rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-[10%] -right-[10%] w-[35%] h-[35%] bg-gradient-radial-accent rounded-full blur-3xl pointer-events-none" />

      <button
        onClick={toggleLanguage}
        className="focus-ring fixed top-6 right-6 z-10 w-10 h-10 flex items-center justify-center rounded-xl text-on-muted hover:bg-surface-4 hover:text-on-surface transition-colors text-xs font-semibold uppercase"
        aria-label={t('common.languageToggle')}
      >
        {i18n.language.startsWith('fr') ? 'FR' : 'EN'}
      </button>

      <main className="w-full max-w-[400px] relative z-10">
        <div className="glass ai-glow rounded-2xl p-7 overflow-hidden relative">
          <div className="flex items-center gap-2 mb-6">
            <KaelahLogo size={26} />
            <span className="text-[15px] font-bold tracking-tight">{t('common.brand')}<span className="text-accent">{t('common.brandSuffix')}</span></span>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-error-dim text-error text-[13px] mb-4">
              <AlertCircle size={15} className="flex-shrink-0" /><span>{error}</span>
            </div>
          )}

          {mode === 'login' && (
          <div className="animate-fade-in">
            <header className="mb-5">
              <h2 className="text-xl font-semibold">{t('auth.login.title')}</h2>
              <p className="text-sm text-on-muted mt-1">{t('auth.login.subtitle')}</p>
            </header>
            <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium">{t('auth.fields.email')}</label>
                <div className="relative flex items-center">
                  <Mail size={16} className="absolute left-3 text-on-dim pointer-events-none" />
                  <input type="email" placeholder={t('auth.fields.emailPlaceholder')} required className="input-field pl-10" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[13px] font-medium">{t('auth.fields.password')}</label>
                  <a href="#" className="focus-ring rounded text-[13px] text-primary hover:opacity-80 transition-opacity">{t('auth.fields.forgotPassword')}</a>
                </div>
                <div className="relative flex items-center">
                  <Lock size={16} className="absolute left-3 text-on-dim pointer-events-none" />
                  <input type={showPassword ? 'text' : 'password'} placeholder={t('auth.fields.passwordPlaceholder')} required className="input-field pl-10 pr-10" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" className="focus-ring absolute right-2.5 w-7 h-7 flex items-center justify-center rounded-md text-on-muted hover:text-on-surface transition-colors" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <Button type="submit" variant="ai" size="lg" className="w-full mt-1" loading={loading}>{t('auth.login.submit')}</Button>
            </form>
            <p className="text-center text-sm text-on-muted mt-5">{t('auth.login.noAccount')} <button type="button" className="focus-ring rounded text-primary font-medium" onClick={() => switchMode('register')}>{t('auth.login.createAccount')}</button></p>
          </div>
          )}

          {mode === 'register' && (
          <div className="animate-fade-in">
            <header className="mb-5">
              <h2 className="text-xl font-semibold">{t('auth.register.title')}</h2>
              <p className="text-sm text-on-muted mt-1">{t('auth.register.subtitle')}</p>
            </header>
            <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium">{t('auth.fields.fullName')}</label>
                <div className="relative flex items-center">
                  <User size={16} className="absolute left-3 text-on-dim pointer-events-none" />
                  <input type="text" placeholder={t('auth.fields.fullNamePlaceholder')} required className="input-field pl-10" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium">{t('auth.fields.email')}</label>
                <div className="relative flex items-center">
                  <Mail size={16} className="absolute left-3 text-on-dim pointer-events-none" />
                  <input type="email" placeholder={t('auth.fields.emailPlaceholder')} required className="input-field pl-10" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium">{t('auth.fields.password')}</label>
                <div className="relative flex items-center">
                  <Lock size={16} className="absolute left-3 text-on-dim pointer-events-none" />
                  <input type={showPassword ? 'text' : 'password'} placeholder={t('auth.fields.passwordPlaceholder')} required minLength={8} className="input-field pl-10 pr-10" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" className="focus-ring absolute right-2.5 w-7 h-7 flex items-center justify-center rounded-md text-on-muted hover:text-on-surface transition-colors" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-on-muted cursor-pointer">
                <input type="checkbox" required className="accent-primary w-4 h-4" />
                <span><Trans i18nKey="auth.register.terms" components={{ 1: <a href="#" className="text-primary" /> }} /></span>
              </label>
              <Button type="submit" variant="ai" size="lg" className="w-full" loading={loading}>{t('auth.register.submit')}</Button>
            </form>
            <p className="text-center text-sm text-on-muted mt-5">{t('auth.register.hasAccount')} <button type="button" className="focus-ring rounded text-primary font-medium" onClick={() => switchMode('login')}>{t('auth.register.signIn')}</button></p>
          </div>
          )}
        </div>

        <footer className="mt-4 flex justify-center gap-6 opacity-60 hover:opacity-100 transition-opacity">
          <a className="focus-ring rounded text-xs text-on-muted hover:text-on-surface transition-colors" href="#">{t('auth.privacyPolicy')}</a>
          <a className="focus-ring rounded text-xs text-on-muted hover:text-on-surface transition-colors" href="#">{t('auth.termsOfService')}</a>
          <a className="focus-ring rounded text-xs text-on-muted hover:text-on-surface transition-colors" href="#">{t('auth.contactSupport')}</a>
        </footer>
      </main>
    </div>
  )
}
