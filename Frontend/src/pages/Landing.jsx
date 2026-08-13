import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import {
  Sparkles, ArrowRight, BarChart3, Search, MessageSquare,
  Zap, Package, Check, ShoppingBag, FileText, Layers,
  ShoppingCart, Droplet, TrendingUp, Store, Globe,
} from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Button from '../components/Button'
import Reveal from '../components/Reveal'
import KaelahLogo from '../components/KaelahLogo'
import { useInView } from '../hooks/useInView'
import { aiCapabilities, platforms, plans } from '../data/mockData'
import { PROVIDER_META } from '../data/providerMeta'

const iconMap = { BarChart3, Search, MessageSquare, Zap, Package, Sparkles }
const platformIcons = { ShoppingBag, FileText, Layers, ShoppingCart, Droplet, Search, Store, Package, Globe }
const barHeights = [55, 80, 45, 95, 65, 100, 70]

export default function Landing() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [chartRef, chartInView] = useInView()

  useEffect(() => {
    if (!location.hash) return
    const el = document.querySelector(location.hash)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash])

  const demoStats = [
    { label: t('landing.demo.revenue'), value: '48 250 €', trend: '+12.4%' },
    { label: t('landing.demo.orders'), value: '312', trend: '+8.1%' },
    { label: t('landing.demo.conversion'), value: '3.2%', trend: '-0.3%' },
  ]

  const howSteps = t('landing.how.steps', { returnObjects: true })

  return (
    <div className="overflow-x-hidden">
      <Navbar />

      {/* HERO */}
      <section className="relative pt-32 pb-24 text-center overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-gradient-radial-primary rounded-full blur-3xl pointer-events-none animate-blob-move" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gradient-radial-accent rounded-full blur-3xl pointer-events-none animate-blob-move" style={{ animationDelay: '-7s' }} />
        <div className="relative z-10 max-w-[1280px] mx-auto px-6">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-4 border border-border text-[13px] font-medium text-accent mb-6 animate-fade-up">
            <Sparkles size={14} /><span>{t('landing.hero.badge')}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-bold leading-[1.1] tracking-tight max-w-[800px] mx-auto animate-fade-up" style={{ animationDelay: '80ms' }}>
            <Trans i18nKey="landing.hero.title" components={{ 1: <span className="text-gradient" /> }} />
          </h1>
          <p className="text-lg text-on-muted mt-5 max-w-[560px] mx-auto animate-fade-up" style={{ animationDelay: '160ms' }}>{t('landing.hero.subtitle')}</p>
          <div className="flex gap-3 justify-center mt-8 flex-wrap animate-fade-up" style={{ animationDelay: '240ms' }}>
            <Button variant="ai" size="lg" onClick={() => navigate('/register')}>{t('landing.hero.ctaPrimary')} <ArrowRight size={18} /></Button>
            <Button variant="secondary" size="lg" onClick={() => navigate('/chat')}>{t('landing.hero.ctaSecondary')}</Button>
          </div>

          {/* Hero mock dashboard (CSS-built, no external imagery) */}
          <div className="mt-16 max-w-4xl mx-auto relative animate-fade-up" style={{ animationDelay: '320ms' }} ref={chartRef}>
            <div className="glass p-2 rounded-[2rem] ai-glow">
              <div className="rounded-[1.6rem] overflow-hidden border border-border bg-surface-2 text-left">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface-3">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-surface-6" />
                    <span className="w-2.5 h-2.5 rounded-full bg-surface-6" />
                    <span className="w-2.5 h-2.5 rounded-full bg-surface-6" />
                  </div>
                  <div className="flex items-center gap-1.5 text-[13px] font-medium text-on-muted"><KaelahLogo size={16} /><span>Kaelah AI</span></div>
                </div>
                <div className="p-6 flex flex-col gap-5">
                  <div className="flex gap-2.5 max-w-[85%]">
                    <div className="w-6 h-6 rounded-md bg-surface-2 border border-border flex items-center justify-center flex-shrink-0"><KaelahLogo size={16} /></div>
                    <p className="text-sm text-on-surface pt-1">{t('landing.demo.aiMessage')}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {demoStats.map((s) => (
                      <div key={s.label} className="flex flex-col gap-1 px-3.5 py-3 bg-surface-3 border border-border rounded-xl">
                        <span className="text-[10px] uppercase tracking-wide text-on-muted truncate">{s.label}</span>
                        <span className="text-lg font-bold text-on-surface">{s.value}</span>
                        <span className="text-xs text-success">{s.trend}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-end gap-2 h-24 px-1">
                    {barHeights.map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-md bg-gradient-to-t from-primary to-accent opacity-80 transition-all duration-700 ease-out"
                        style={{ height: chartInView ? `${h}%` : '4%', transitionDelay: `${i * 60}ms` }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-surface-4 px-3.5 py-2.5 rounded-2xl rounded-br-md text-sm text-on-surface">{t('landing.demo.userMessage')}</div>
                  </div>
                </div>
              </div>
            </div>
            {/* Floating stat card */}
            <div className="hidden md:flex absolute -top-6 -right-6 glass p-4 rounded-2xl items-center gap-3 shadow-card animate-float">
              <div className="w-10 h-10 rounded-full bg-primary-dim flex items-center justify-center text-primary flex-shrink-0"><TrendingUp size={20} /></div>
              <div className="text-left">
                <p className="text-sm font-bold text-on-surface">{t('landing.hero.statValue')}</p>
                <p className="text-[10px] text-on-muted">{t('landing.hero.statLabel')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLATEFORMES (marquee) */}
      <section className="py-14 border-y border-border bg-surface-2/50 overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-on-muted opacity-60 mb-8">{t('landing.solutions.eyebrow')}</p>
        </div>
        <div className="overflow-hidden">
          <div className="flex w-max items-center gap-16 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 hover:[animation-play-state:paused] transition-[filter,opacity] duration-500 animate-marquee">
            {[...platforms, ...platforms].map((p, i) => {
              const Icon = platformIcons[p.icon] || Search
              return (
                <div key={i} className="flex items-center gap-2 text-on-surface flex-shrink-0">
                  <Icon size={22} /><span className="font-bold text-xl whitespace-nowrap">{p.name}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* FONCTIONNEMENT */}
      <section className="py-20" id="how">
        <div className="max-w-[1280px] mx-auto px-6">
          <Reveal className="text-center max-w-[600px] mx-auto mb-12">
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">{t('landing.how.eyebrow')}</span>
            <h2 className="text-3xl font-bold tracking-tight mt-2">{t('landing.how.title')}</h2>
            <p className="text-on-muted mt-2">{t('landing.how.subtitle')}</p>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {howSteps.map((item, i) => (
              <Reveal key={item.title} delay={i * 100}>
                <div className="card-base card-hover p-8 flex flex-col items-center text-center group h-full">
                  <div className="icon-tile text-primary w-16 h-16 flex items-center justify-center rounded-2xl mb-5 group-hover:scale-110 transition-transform">
                    <span className="text-2xl font-bold font-mono">{i + 1}</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-on-muted">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CAPACITÉS (bento grid) */}
      <section className="py-20 bg-surface-2" id="features">
        <div className="max-w-[1280px] mx-auto px-6">
          <Reveal className="max-w-[600px] mb-12">
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">{t('landing.features.eyebrow')}</span>
            <h2 className="text-3xl font-bold tracking-tight mt-2">{t('landing.features.title')}</h2>
            <p className="text-on-muted mt-2">{t('landing.features.subtitle')}</p>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
            {aiCapabilities.map((cap, i) => {
              const Icon = iconMap[cap.icon] || Sparkles
              const isLarge = i % 2 === 0
              return (
                <Reveal key={cap.id} delay={i * 80} className={isLarge ? 'md:col-span-4' : 'md:col-span-2'}>
                  <div className="card-base card-hover p-8 relative overflow-hidden group h-full">
                    {isLarge && (
                      <div className="absolute -bottom-8 -right-8 w-40 h-40 rounded-full bg-gradient-radial-primary blur-2xl opacity-60 group-hover:scale-110 transition-transform duration-700 pointer-events-none" />
                    )}
                    <div className="relative z-10">
                      <div className="icon-tile text-primary w-12 h-12 flex items-center justify-center rounded-xl mb-4"><Icon size={22} /></div>
                      <h3 className="text-base font-semibold mb-2">{t(`mock.aiCapabilities.${cap.id}.title`)}</h3>
                      <p className="text-sm text-on-muted max-w-md">{t(`mock.aiCapabilities.${cap.id}.desc`)}</p>
                    </div>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* TARIFS */}
      <section className="py-24" id="pricing">
        <div className="max-w-[1280px] mx-auto px-6">
          <Reveal className="text-center max-w-[600px] mx-auto mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">{t('landing.pricing.eyebrow')}</span>
            <h2 className="text-3xl font-bold tracking-tight mt-2">{t('landing.pricing.title')}</h2>
            <p className="text-on-muted mt-2">{t('landing.pricing.subtitle')}</p>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6 md:gap-4 max-w-[1000px] mx-auto items-center">
            {plans.map((plan, i) => {
              const features = t(`mock.plans.${plan.id}.features`, { returnObjects: true })
              return (
                <Reveal key={plan.id} delay={i * 100}>
                  <div className={`card-base p-7 pt-9 flex flex-col gap-4 relative ${plan.popular ? 'border-primary shadow-glow z-10' : ''}`}>
                    {plan.popular && <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 rounded-full bg-gradient-ai text-white text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap shadow-glow-sm">{t('landing.pricing.popular')}</div>}
                    <h3 className="text-xl font-semibold">{t(`mock.plans.${plan.id}.name`)}</h3>
                    <p className="text-sm text-on-muted">{t(`mock.plans.${plan.id}.description`)}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold tracking-tight">{plan.price}€</span>
                      <span className="text-on-muted">{plan.period}</span>
                    </div>
                    <ul className="flex flex-col gap-2.5">
                      {features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm"><Check size={14} className="text-accent" />{f}</li>
                      ))}
                    </ul>
                    {plan.providers?.length > 0 && (
                      <div className="flex flex-col gap-2 pt-1 border-t border-border">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-on-muted">{t('billing.connectorsIncluded')}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {plan.providers.map((p) => {
                            const meta = PROVIDER_META[p]
                            if (!meta) return null
                            const Icon = meta.icon
                            return (
                              <span key={p} title={meta.name} className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface-3 border border-border flex-shrink-0">
                                <Icon size={14} style={{ color: meta.color }} />
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    <Button variant={plan.popular ? 'ai' : 'secondary'} className="w-full" onClick={() => navigate('/register')}>
                      {t(`mock.plans.${plan.id}.cta`)}
                    </Button>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-[1280px] mx-auto px-6">
          <Reveal>
            <div className="glass ai-glow text-center py-16 px-10 rounded-[3rem] relative overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-radial-primary pointer-events-none" />
              <div className="relative z-10">
                <h2 className="text-3xl font-bold tracking-tight">{t('landing.cta.title')}</h2>
                <p className="text-lg text-on-muted mt-2">{t('landing.cta.subtitle')}</p>
                <Button variant="ai" size="lg" className="mt-8" onClick={() => navigate('/register')}>{t('landing.cta.button')} <ArrowRight size={18} /></Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  )
}
