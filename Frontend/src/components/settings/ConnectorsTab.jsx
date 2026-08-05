import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, Link2, Loader2, ShoppingBag, FileText, Layers, Store, Package, Globe, Search, AlertCircle } from 'lucide-react'
import Button from '../Button'
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
const PLUGIN_MARKETPLACE_URL = {
  wordpress: 'https://wordpress.org/plugins/kaelah-ai-connector/',
  drupal: 'https://www.drupal.org/project/kaelah_ai_connector',
  prestashop: 'https://addons.prestashop.com/en/', // Kaelah AI Connector — free module listing
}

export default function ConnectorsTab() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [connectors, setConnectors] = useState([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(null)

  const notice = searchParams.get('connected') ? { type: 'success', provider: searchParams.get('connected') } : searchParams.get('error') ? { type: 'error', provider: searchParams.get('error') } : null

  const loadConnectors = () => {
    setLoading(true)
    api.getConnectors().then(({ connectors }) => setConnectors(connectors)).finally(() => setLoading(false))
  }

  useEffect(() => { loadConnectors() }, [])

  // While a WordPress (or Drupal) plugin install is in progress in another tab,
  // poll so the card flips to "Connecté" automatically once the handshake completes.
  useEffect(() => {
    const hasPendingPluginConnect = connectors.some((c) => ['wordpress', 'drupal', 'prestashop'].includes(c.provider) && c.status !== 'connected')
    if (!hasPendingPluginConnect) return
    const interval = setInterval(loadConnectors, 5000)
    return () => clearInterval(interval)
  }, [connectors])

  const handleConnect = async (provider) => {
    if (provider === 'shopify') {
      const shop = window.prompt(t('connectors.shopifyPrompt'))
      if (!shop) return
      setConnecting(provider)
      try {
        const { url } = await api.getShopifyInstallUrl(shop.trim())
        window.location.href = url
      } catch (err) {
        window.alert(err.message)
        setConnecting(null)
      }
      return
    }
    if (PLUGIN_MARKETPLACE_URL[provider]) {
      window.open(PLUGIN_MARKETPLACE_URL[provider], '_blank', 'noopener,noreferrer')
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
        window.alert(err.message)
        setConnecting(null)
      }
    }
  }

  const handleDisconnect = async (provider) => {
    await api.disconnectConnector(provider)
    loadConnectors()
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
            return (
              <div key={connector.provider} className="card-base card-hover p-5 flex flex-col gap-3.5">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 flex items-center justify-center rounded-xl" style={{ background: `${meta.color}20` }}>
                    <Icon size={24} style={{ color: meta.color }} />
                  </div>
                  <div className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${isConnected ? 'bg-success-dim text-success' : 'bg-surface-6 text-on-muted'}`}>
                    {isConnected ? <><Check size={12} /> {t('connectors.connected')}</> : <><span className="w-1.5 h-1.5 rounded-full bg-on-muted" /> {t('connectors.notConnected')}</>}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-base font-semibold">{meta.name}</h3>
                  <p className="text-sm text-on-muted">{isConnected ? t('connectors.syncActive') : PLUGIN_MARKETPLACE_URL[connector.provider] ? t('connectors.viaPlugin') : t('connectors.notConnected')}</p>
                </div>
                {isConnected ? (
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
    </>
  )
}
