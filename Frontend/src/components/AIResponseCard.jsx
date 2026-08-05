import { useTranslation } from 'react-i18next'
import { TrendingUp, TrendingDown, Search, AlertCircle, Lightbulb, Package } from 'lucide-react'
import ProductCard from './ProductCard'

export default function AIResponseCard({ type, data }) {
  const { t } = useTranslation()

  if (type === 'analytics') {
    const stats = [
      { key: 'revenue', label: t('mock.aiResponseCard.stats.revenue'), value: data.revenue, trend: data.revenueTrend },
      { key: 'orders', label: t('mock.aiResponseCard.stats.orders'), value: data.orders, trend: data.ordersTrend },
      { key: 'products', label: t('mock.aiResponseCard.stats.products'), value: data.products, trend: data.productsTrend },
      { key: 'conversion', label: t('mock.aiResponseCard.stats.conversion'), value: data.conversion, trend: data.conversionTrend },
    ].filter((stat) => stat.value !== undefined && stat.value !== null)

    if (stats.length === 0) return null

    return (
      <div className="card-base p-4">
        <div className="flex items-center gap-2 mb-3.5">
          <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary-dim text-primary"><TrendingUp size={16} /></div>
          <span className="text-xs font-semibold uppercase tracking-wide text-on-muted">{t('mock.aiResponseCard.analyticsHeading')}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((stat) => (
            <div key={stat.key} className="flex flex-col gap-1 p-3 bg-surface-2 rounded-xl border border-border">
              <span className="text-[11px] uppercase tracking-wide text-on-muted">{stat.label}</span>
              <span className="text-xl font-bold text-on-surface tracking-tight">{stat.value}</span>
              {stat.trend && (
                <span className={`text-xs flex items-center gap-0.5 ${stat.trend.startsWith('+') ? 'text-success' : stat.trend.startsWith('-') ? 'text-error' : 'text-on-muted'}`}>
                  {stat.trend.startsWith('+') && <TrendingUp size={12} />}
                  {stat.trend.startsWith('-') && <TrendingDown size={12} />}
                  {stat.trend}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'seo') {
    const recommended = data.recommended || []
    const severityVar = data.score < 50 ? '--color-error' : data.score < 90 ? '--color-warning' : '--color-success'
    return (
      <div className="card-base p-4" style={{ borderLeftWidth: '4px', borderLeftColor: `var(${severityVar})` }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-accent-dim text-accent"><Search size={16} /></div>
          <span className="text-xs font-semibold uppercase tracking-wide text-on-muted">{t('mock.aiResponseCard.seoHeading')}</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="relative w-20 h-20">
              <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--color-surface-5)" strokeWidth="6" />
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--color-accent)" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray="213.6" strokeDashoffset={213.6 - (213.6 * data.score / 100)} className="transition-all duration-1000" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-on-surface">{data.score}</span>
            </div>
            <span className="text-xs text-on-muted">{t('mock.aiResponseCard.seoScoreLabel')}</span>
          </div>
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex items-center gap-1.5">
              <AlertCircle size={14} className="text-warning" />
              <span className="text-xs font-semibold uppercase tracking-wide text-on-muted">{t('mock.aiResponseCard.issuesDetected', { count: data.issues })}</span>
            </div>
            {recommended.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-on-surface"><Lightbulb size={14} className="text-accent" /> {t('mock.aiResponseCard.recommendedActions')}</div>
                <ul className="flex flex-col gap-1.5">
                  {recommended.map((rec, i) => (
                    <li key={i} className="flex items-center gap-2 text-[13px] text-on-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (type === 'products') {
    return (
      <div className="card-base p-4">
        <div className="flex items-center gap-2 mb-3.5">
          <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-ai-soft text-accent"><Package size={16} /></div>
          <span className="text-xs font-semibold uppercase tracking-wide text-on-muted">{t('mock.aiResponseCard.productsHeading')}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </div>
    )
  }

  return null
}
