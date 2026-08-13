import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Store, Check, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { PROVIDER_META } from '../data/providerMeta'

const ACTION_LABELS = {
  update_shopify_product_seo: 'chat.actions.updateShopifyProductSeo',
  update_shopify_shop_seo: 'chat.actions.updateShopifyShopSeo',
  update_wordpress_seo: 'chat.actions.updateWordpressSeo',
  update_wordpress_homepage_seo: 'chat.actions.updateWordpressHomepageSeo',
  update_wordpress_geo: 'chat.actions.updateWordpressGeo',
  update_wordpress_homepage_geo: 'chat.actions.updateWordpressHomepageGeo',
  update_wordpress_llms_txt: 'chat.actions.updateWordpressLlmsTxt',
  update_drupal_seo: 'chat.actions.updateDrupalSeo',
  update_drupal_homepage_seo: 'chat.actions.updateDrupalHomepageSeo',
  update_drupal_geo: 'chat.actions.updateDrupalGeo',
  update_drupal_homepage_geo: 'chat.actions.updateDrupalHomepageGeo',
  update_drupal_llms_txt: 'chat.actions.updateDrupalLlmsTxt',
  update_bigcommerce_product_seo: 'chat.actions.updateBigcommerceProductSeo',
  update_bigcommerce_shop_seo: 'chat.actions.updateBigcommerceShopSeo',
  update_prestashop_product_seo: 'chat.actions.updatePrestashopProductSeo',
  update_prestashop_homepage_seo: 'chat.actions.updatePrestashopHomepageSeo',
  update_prestashop_product_geo: 'chat.actions.updatePrestashopProductGeo',
  update_prestashop_homepage_geo: 'chat.actions.updatePrestashopHomepageGeo',
  update_prestashop_llms_txt: 'chat.actions.updatePrestashopLlmsTxt',
  update_wix_product_seo: 'chat.actions.updateWixProductSeo',
}

export default function ContextPanel() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { company } = useAuth()
  const [connectors, setConnectors] = useState([])
  const [recentActions, setRecentActions] = useState([])
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('kaelah_context_collapsed') === '1')

  useEffect(() => {
    api.getConnectors().then(({ connectors }) => setConnectors(connectors.slice(0, 3))).catch(() => {})
    api.getRecentActions().then(({ actions }) => setRecentActions(actions)).catch(() => {})
  }, [])

  useEffect(() => {
    localStorage.setItem('kaelah_context_collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  if (collapsed) {
    return (
      <aside className="hidden xl:flex w-12 flex-shrink-0 glass border-l border-border flex-col items-center min-h-0 h-screen py-5">
        <button
          className="focus-ring w-8 h-8 flex items-center justify-center rounded-lg text-on-muted hover:bg-surface-4 hover:text-on-surface transition-colors"
          onClick={() => setCollapsed(false)}
          aria-label={t('chat.contextPanel.expand')}
        >
          <PanelRightOpen size={18} />
        </button>
      </aside>
    )
  }

  return (
    <aside className="hidden xl:flex w-80 flex-shrink-0 glass border-l border-border flex-col min-h-0 h-screen p-5 gap-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-on-muted opacity-70">{t('chat.contextPanel.heading')}</h2>
        <button
          className="focus-ring w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg text-on-muted hover:bg-surface-4 hover:text-on-surface transition-colors"
          onClick={() => setCollapsed(true)}
          aria-label={t('chat.contextPanel.collapse')}
        >
          <PanelRightClose size={16} />
        </button>
      </div>

      {/* Business identity */}
      <div className="card-base p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="icon-tile text-primary w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"><Store size={20} /></div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold truncate">{company?.name || ''}</h4>
            {company?.type && <p className="text-xs text-on-muted truncate">{t(`mock.businessTypes.${company.type}.label`)}</p>}
          </div>
        </div>
      </div>

      {/* Connected platforms */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-on-muted mb-3">{t('chat.contextPanel.platforms')}</h3>
        <div className="flex flex-col gap-2">
          {connectors.map((c) => {
            const meta = PROVIDER_META[c.provider]
            if (!meta) return null
            const Icon = meta.icon
            return (
              <div key={c.provider} className="flex items-center justify-between p-2.5 bg-surface-3 rounded-lg border border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon size={16} style={{ color: meta.color }} className="flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{meta.name}</span>
                </div>
                {c.status === 'connected'
                  ? <Check size={16} className="text-success flex-shrink-0" />
                  : <button className="focus-ring text-[11px] font-semibold text-primary hover:underline flex-shrink-0" onClick={() => navigate('/settings?tab=connectors')}>{t('connectors.connect')}</button>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent actions — capped at 2 and dropped entirely once there are 3+
          connectors, so it never crowds out the upgrade banner below */}
      {recentActions.length > 0 && connectors.length < 3 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-on-muted mb-3">{t('chat.contextPanel.recentActions')}</h3>
          <div className="flex flex-col gap-3">
            {recentActions.slice(0, 2).map((action) => (
              <div key={action.id} className="flex gap-3">
                <div className={`w-0.5 rounded-full flex-shrink-0 ${action.status === 'executed' ? 'bg-success' : action.status === 'failed' ? 'bg-error' : 'bg-primary-dim'}`} />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold">{t(ACTION_LABELS[action.function_name] || 'chat.actions.generic', { name: action.function_name })}</span>
                  <span className="text-[10px] text-on-muted">{new Date(action.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upgrade banner — always targets the next tier up, never a stale
          "Pro" label for Pro users */}
      {company?.plan !== 'business' && (
        <div className="mt-auto relative overflow-hidden bg-gradient-ai rounded-2xl p-5 flex-shrink-0">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <h4 className="text-white font-bold mb-2 relative z-10">{t('chat.contextPanel.upgradeTitle')}</h4>
          <p className="text-white/80 text-[11px] mb-4 relative z-10">{t('chat.contextPanel.upgradeDesc')}</p>
          <button className="focus-ring w-full bg-white text-primary font-bold py-2 rounded-lg text-xs hover:scale-105 transition-transform relative z-10" onClick={() => navigate('/settings?tab=billing')}>
            {t('chat.contextPanel.upgradeButton', { plan: t(`billing.planNames.${company?.plan === 'pro' ? 'business' : 'pro'}`) })}
          </button>
        </div>
      )}
    </aside>
  )
}
