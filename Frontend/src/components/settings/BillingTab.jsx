import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Download, Zap, Plug, AlertCircle } from 'lucide-react'
import Button from '../Button'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'

export default function BillingTab() {
  const { t } = useTranslation()
  const { company, refreshProfile } = useAuth()
  const [plans, setPlans] = useState([])
  const [invoices, setInvoices] = useState([])
  const [usage, setUsage] = useState(null)
  const [error, setError] = useState('')
  const [pendingPlan, setPendingPlan] = useState(null)

  useEffect(() => {
    api.getPlans().then(({ plans }) => setPlans(plans)).catch(() => {})
    api.getInvoices().then(({ invoices }) => setInvoices(invoices)).catch(() => {})
    api.getProfile().then((data) => setUsage(data.usage)).catch(() => {})
  }, [])

  const currentPlan = company?.plan || 'starter'

  // Limits come straight from the backend's real, enforced quota — never a
  // frontend-only guess, so this always matches what actually blocks the user.
  const usageStats = usage ? [
    { icon: Zap, label: t('billing.usage.messages'), used: usage.messagesUsed, limit: usage.messagesLimit ?? Infinity, accent: false },
    { icon: Plug, label: t('billing.usage.connectors'), used: usage.connectorsUsed, limit: usage.connectorsLimit ?? Infinity, accent: true },
  ] : []

  const handleChangePlan = async (planId) => {
    setPendingPlan(planId)
    setError('')
    try {
      const { url } = await api.createCheckoutSession(planId)
      window.location.href = url
    } catch (err) {
      setError(err.message || t('billing.notConfigured'))
      setPendingPlan(null)
    }
  }

  const handleManageSubscription = async () => {
    setError('')
    try {
      const { url } = await api.createPortalSession()
      window.location.href = url
    } catch (err) {
      setError(err.message || t('billing.notConfigured'))
    }
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Current plan */}
      <div className="card-base p-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">{t('billing.currentPlanLabel')}</span>
          <h2 className="text-xl font-semibold">{t(`billing.planNames.${currentPlan}`)}</h2>
          {company?.subscriptionStatus && <p className="text-sm text-on-muted">{company.subscriptionStatus}</p>}
        </div>
        <Button variant="secondary" onClick={handleManageSubscription}>{t('billing.manageSubscription')}</Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-error-dim text-error text-[13px] -mt-6">
          <AlertCircle size={15} className="flex-shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* Usage */}
      {usageStats.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-4">
          {usageStats.map((u) => {
            const percent = u.limit === Infinity ? 100 : Math.min(100, Math.round((u.used / u.limit) * 100))
            return (
              <div key={u.label} className="card-base p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-gradient-ai-soft text-primary"><u.icon size={18} /></div>
                  <span className="text-sm font-semibold">{u.label}</span>
                </div>
                <div className="h-1.5 bg-surface-6 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 bg-gradient-ai ${u.accent ? 'shadow-glow-accent' : 'shadow-glow-sm'}`} style={{ width: `${percent}%` }} />
                </div>
                <p className="text-sm text-on-muted">{u.used.toLocaleString()} / {u.limit === Infinity ? '∞' : u.limit.toLocaleString()}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Plans */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('billing.changePlanHeading')}</h2>
        <div className="grid md:grid-cols-3 gap-4 pt-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan
            const features = t(`mock.plans.${plan.id}.features`, { returnObjects: true })
            return (
              <div key={plan.id} className={`card-base p-6 pt-8 flex flex-col gap-3.5 relative ${isCurrent ? 'border-primary shadow-glow z-10' : ''}`}>
                {isCurrent && <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 rounded-full bg-gradient-ai text-white text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap shadow-glow-sm">{t('billing.yourPlan')}</div>}
                <h3 className="text-lg font-semibold">{t(`mock.plans.${plan.id}.name`)}</h3>
                <p className="text-sm text-on-muted">{t(`mock.plans.${plan.id}.description`)}</p>
                <div className="flex items-baseline gap-1"><span className="text-3xl font-bold tracking-tight">{plan.price}€</span><span className="text-on-muted text-sm">/mois</span></div>
                <ul className="flex flex-col gap-2">
                  {features.map((f, i) => <li key={i} className="flex items-center gap-2 text-sm"><Check size={14} className="text-accent" />{f}</li>)}
                </ul>
                <Button
                  variant={isCurrent ? 'secondary' : 'ai'}
                  className="w-full"
                  disabled={isCurrent}
                  loading={pendingPlan === plan.id}
                  onClick={() => handleChangePlan(plan.id)}
                >
                  {isCurrent ? t('billing.yourPlan') : t(`mock.plans.${plan.id}.cta`)}
                </Button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Invoices */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('billing.invoicesHeading')}</h2>
        <div className="card-base p-2">
          {invoices.length === 0 && <p className="px-4 py-3.5 text-sm text-on-muted">{t('billing.noInvoices')}</p>}
          {invoices.map((invoice) => (
            <div key={invoice.id} className="flex items-center justify-between px-4 py-3.5 rounded-lg hover:bg-surface-4 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-sm">{new Date(invoice.date).toLocaleDateString()}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${invoice.status === 'paid' ? 'bg-success-dim text-success' : 'bg-surface-6 text-on-muted'}`}>
                  {invoice.status === 'paid' ? t('billing.invoiceStatus.paid') : t('billing.invoiceStatus.open')}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sm">{invoice.amount} {invoice.currency?.toUpperCase()}</span>
                <a href={invoice.hostedUrl} target="_blank" rel="noreferrer" className="focus-ring w-8 h-8 flex items-center justify-center rounded-lg text-on-muted hover:bg-surface-6 hover:text-on-surface transition-colors" aria-label={t('common.download')}><Download size={16} /></a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
