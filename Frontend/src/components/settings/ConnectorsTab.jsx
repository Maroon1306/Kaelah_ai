import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, Link2, Lock, Loader2, ShoppingBag, FileText, Layers, Store, Package, Globe, Search, AlertCircle, ExternalLink } from 'lucide-react'
import Button from '../Button'
import Modal from '../Modal'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'

const PROVIDER_META = {
  shopify: { name: 'Shopify', icon: ShoppingBag, color: '#95BF47' },
  wordpress: { name: 'WordPress/WooCommerce', icon: FileText, color: '#21759B' },
  drupal: { name: 'Drupal', icon: Layers, color: '#0678BE' },
  bigcommerce: { name: 'BigCommerce', icon: Store, color: '#34313F' },
  prestashop: { name: 'PrestaShop', icon: Package, color: '#DF0067' },
  wix: { name: 'Wix Stores', icon: Globe, color: '#0C6EFC' },
  google_search_console: { name: 'Google Search Console', icon: Search, color: '#4285F4' },
}

// WordPress, Drupal and PrestaShop connect exclusively through the official
// "Kaelah AI Connector" plugin/module — no URL, API key or password is ever
// requested here. WooCommerce isn't its own connector: it's detected
// automatically through the WordPress connector once connected.
// PrestaShop's module isn't on Addons (their seller program requires a
// registered business/SIRET) — self-hosted directly from our own domain
// instead. Same manual upload-and-enable flow either way.
const PLUGIN_MARKETPLACE_URL = {
  wordpress: 'https://wordpress.org/plugins/kaelah-ai-connector/',
  drupal: 'https://www.drupal.org/project/kaelah_ai_connector/releases/1.0.x-dev',
  prestashop: '/downloads/kaelahaiconnector.zip',
}

export default function ConnectorsTab() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const showToast = useToast()
  const { company } = useAuth()
  const [connectors, setConnectors] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(null)
  const [shopifyModalOpen, setShopifyModalOpen] = useState(false)
  const [shopDomain, setShopDomain] = useState('')
  // Unlike Shopify's one-click OAuth install, WordPress/Drupal/PrestaShop
  // connect through a real plugin/module the user has to install on their
  // own site (Composer, drush, or an upload) — this modal sets that
  // expectation before sending them to a plain module listing page that
  // otherwise gives no hint of what to do next.
  const [pluginGuideProvider, setPluginGuideProvider] = useState(null)
  // Only set right after the user actually opens a plugin marketplace tab —
  // NOT just "this provider happens to be disconnected", which used to be
  // true for almost every account and polled forever. Cleared once
  // connected or after a few minutes with no result.
  const [pendingPluginProvider, setPendingPluginProvider] = useState(null)

  const notice = searchParams.get('connected') ? { type: 'success', provider: searchParams.get('connected') } : searchParams.get('error') ? { type: 'error', provider: searchParams.get('error') } : null

  const loadConnectors = (silent = false) => {
    if (!silent) setLoading(true)
    return api.getConnectors().then(({ connectors }) => setConnectors(connectors)).finally(() => { if (!silent) setLoading(false) })
  }

  useEffect(() => { loadConnectors() }, [])
  useEffect(() => { api.getPlans().then(({ plans }) => setPlans(plans)).catch(() => {}) }, [])

  const currentPlanProviders = plans.find((p) => p.id === (company?.plan || 'starter'))?.providers || []
  // The lowest-tier plan (in catalog order) that unlocks a given provider —
  // shown on the lock badge so the user knows exactly what to upgrade to.
  const requiredPlanFor = (provider) => plans.find((p) => p.providers?.includes(provider))?.id

  // While a plugin install started in another tab, poll quietly (no loading
  // spinner) so the card flips to "Connecté" on its own — capped at 3
  // minutes so it never runs indefinitely.
  useEffect(() => {
    if (!pendingPluginProvider) return
    const isNowConnected = connectors.find((c) => c.provider === pendingPluginProvider)?.status === 'connected'
    if (isNowConnected) { setPendingPluginProvider(null); return }

    const interval = setInterval(() => loadConnectors(true), 5000)
    const timeout = setTimeout(() => setPendingPluginProvider(null), 3 * 60 * 1000)
    return () => { clearInterval(interval); clearTimeout(timeout) }
  }, [pendingPluginProvider, connectors])

  const handleConnect = async (provider) => {
    if (provider === 'shopify') {
      setShopifyModalOpen(true)
      return
    }
    if (PLUGIN_MARKETPLACE_URL[provider]) {
      setPluginGuideProvider(provider)
      return
    }
    if (provider === 'bigcommerce' || provider === 'wix' || provider === 'google_search_console') {
      setConnecting(provider)
      try {
        const { url } = provider === 'bigcommerce'
          ? await api.getBigcommerceInstallUrl()
          : provider === 'wix'
            ? await api.getWixInstallUrl()
            : await api.getGoogleSearchConsoleInstallUrl()
        window.location.href = url
      } catch (err) {
        showToast(err.message, 'error')
        setConnecting(null)
      }
    }
  }

  const handleGoToPluginPage = () => {
    window.open(PLUGIN_MARKETPLACE_URL[pluginGuideProvider], '_blank', 'noopener,noreferrer')
    setPendingPluginProvider(pluginGuideProvider)
    setPluginGuideProvider(null)
  }

  const handleShopifyConnect = async (e) => {
    e.preventDefault()
    if (!shopDomain.trim()) return
    setShopifyModalOpen(false)
    setConnecting('shopify')
    try {
      const { url } = await api.getShopifyInstallUrl(shopDomain.trim())
      window.location.href = url
    } catch (err) {
      showToast(err.message, 'error')
      setConnecting(null)
    } finally {
      setShopDomain('')
    }
  }

  const handleDisconnect = async (provider) => {
    try {
      await api.disconnectConnector(provider)
      loadConnectors()
      showToast(t('connectors.disconnectSuccess', { name: PROVIDER_META[provider]?.name || provider }), 'success')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  return (
    <>
      {notice && (
        <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-[13px] mb-4 ${notice.type === 'success' ? 'bg-success-dim text-success' : 'bg-error-dim text-error'}`}>
          <AlertCircle size={15} className="flex-shrink-0" />
          <span>{notice.type === 'success' ? t('connectors.connectSuccess', { name: PROVIDER_META[notice.provider]?.name || notice.provider }) : t('connectors.connectError', { name: PROVIDER_META[notice.provider]?.name || notice.provider })}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-on-muted"><Loader2 size={22} className="animate-spin" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {connectors.map((connector) => {
            const meta = PROVIDER_META[connector.provider]
            if (!meta) return null
            const Icon = meta.icon
            const isConnected = connector.status === 'connected'
            const isLocked = !isConnected && plans.length > 0 && !currentPlanProviders.includes(connector.provider)
            const requiredPlan = isLocked ? requiredPlanFor(connector.provider) : null
            return (
              <div key={connector.provider} className={`card-base p-5 flex flex-col gap-3.5 ${isLocked ? 'opacity-60' : 'card-hover'}`}>
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 flex items-center justify-center rounded-xl" style={{ background: `${meta.color}20` }}>
                    <Icon size={24} style={{ color: meta.color }} />
                  </div>
                  {isLocked ? (
                    <div className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-surface-6 text-on-muted">
                      <Lock size={11} /> {t(`billing.planNames.${requiredPlan}`)}
                    </div>
                  ) : (
                    <div className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${isConnected ? 'bg-success-dim text-success' : 'bg-surface-6 text-on-muted'}`}>
                      {isConnected ? <><Check size={12} /> {t('connectors.connected')}</> : <><span className="w-1.5 h-1.5 rounded-full bg-on-muted" /> {t('connectors.notConnected')}</>}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-base font-semibold">{meta.name}</h3>
                  <p className="text-sm text-on-muted">
                    {isLocked
                      ? t('connectors.requiresPlan', { plan: t(`billing.planNames.${requiredPlan}`) })
                      : isConnected ? t('connectors.syncActive') : PLUGIN_MARKETPLACE_URL[connector.provider] ? t('connectors.viaPlugin') : t('connectors.notConnected')}
                  </p>
                </div>
                {isLocked ? (
                  <Button variant="secondary" className="w-full" onClick={() => navigate('/settings?tab=billing')}>{t('connectors.upgradeToUnlock', { plan: t(`billing.planNames.${requiredPlan}`) })}</Button>
                ) : isConnected ? (
                  <Button variant="ghost" className="w-full" onClick={() => handleDisconnect(connector.provider)}>{t('connectors.disconnect')}</Button>
                ) : connecting === connector.provider ? (
                  <Button variant="secondary" className="w-full" disabled><Loader2 size={16} className="animate-spin" /> {t('connectors.connecting')}</Button>
                ) : (
                  <Button variant="primary" className="w-full" onClick={() => handleConnect(connector.provider)}><Link2 size={16} /> {t('connectors.connect')}</Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={shopifyModalOpen} onClose={() => setShopifyModalOpen(false)} title={t('connectors.shopifyPrompt')} size="sm">
        <form onSubmit={handleShopifyConnect} className="flex flex-col gap-4">
          <input type="text" required autoFocus className="input-field" placeholder="ma-boutique.myshopify.com" value={shopDomain} onChange={(e) => setShopDomain(e.target.value)} />
          <Button type="submit" variant="primary" className="w-full" disabled={!shopDomain.trim()}>{t('connectors.connect')}</Button>
        </form>
      </Modal>

      <Modal open={!!pluginGuideProvider} onClose={() => setPluginGuideProvider(null)} title={t('connectors.pluginGuide.title', { name: pluginGuideProvider ? PROVIDER_META[pluginGuideProvider]?.name : '' })} size="sm">
        {pluginGuideProvider && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-on-muted">{t('connectors.pluginGuide.intro', { name: PROVIDER_META[pluginGuideProvider]?.name })}</p>
            <ol className="flex flex-col gap-2.5">
              {t(`connectors.pluginGuide.steps.${pluginGuideProvider}`, { returnObjects: true }).map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <span className="w-5 h-5 rounded-full bg-primary-dim text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <Button variant="primary" className="w-full" onClick={handleGoToPluginPage}>
              <ExternalLink size={16} /> {t('connectors.pluginGuide.cta')}
            </Button>
          </div>
        )}
      </Modal>
    </>
  )
}
