import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { User, Sparkles, Copy, ThumbsUp, ThumbsDown, RotateCw, Check, X, Loader2, FileText } from 'lucide-react'
import AIResponseCard from './AIResponseCard'
import KaelahLogo from './KaelahLogo'
import { api } from '../services/api'

export default function ChatMessage({ message }) {
  const { t } = useTranslation()
  const isUser = message.role === 'user'
  const images = message.attachments?.filter((a) => a.type?.startsWith('image')) || []
  const files = message.attachments?.filter((a) => !a.type?.startsWith('image')) || []

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 max-w-[800px] mx-auto w-full animate-fade-up">
        <div className="flex flex-col items-end gap-2 max-w-[75%]">
          {images.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {images.map((img) => (
                <a key={img.id} href={img.url} target="_blank" rel="noreferrer" className="block w-40 h-40 rounded-2xl overflow-hidden border border-border">
                  <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          )}
          {files.length > 0 && (
            <div className="flex flex-col gap-1.5 items-end">
              {files.map((f) => (
                <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-4 border border-border text-[13px] hover:bg-surface-6 transition-colors">
                  <FileText size={14} className="text-on-muted flex-shrink-0" />
                  <span className="truncate max-w-[200px]">{f.name}</span>
                </a>
              ))}
            </div>
          )}
          {message.text && (
            <div className="bg-surface-4 px-4 py-3 rounded-2xl rounded-br-md">
              <p className="text-sm text-on-surface">{message.text}</p>
            </div>
          )}
        </div>
        <div className="w-8 h-8 rounded-lg bg-surface-6 text-on-muted flex items-center justify-center flex-shrink-0">
          <User size={16} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 max-w-[800px] mx-auto w-full animate-fade-up group">
      <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border flex items-center justify-center flex-shrink-0 ai-glow">
        <KaelahLogo size={20} />
      </div>
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {message.text && (
          <div className="glass rounded-2xl rounded-tl-none p-4 inline-block w-fit max-w-full">
            <p className="text-[15px] leading-relaxed text-on-surface">{message.text}</p>
          </div>
        )}

        {message.cards?.length > 0 && (
          <div className="flex flex-col gap-3">
            {message.cards.map((card, i) => <AIResponseCard key={i} type={card.type} data={card.data} />)}
          </div>
        )}

        {message.actions?.length > 0 && (
          <div className="flex flex-col gap-3">
            {message.actions.map((action) => <ActionCard key={action.id} action={action} />)}
          </div>
        )}

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button className="focus-ring w-7 h-7 flex items-center justify-center rounded-md text-on-muted hover:bg-surface-4 hover:text-on-surface transition-colors" aria-label={t('chat.copy')}><Copy size={14} /></button>
          <button className="focus-ring w-7 h-7 flex items-center justify-center rounded-md text-on-muted hover:bg-surface-4 hover:text-on-surface transition-colors" aria-label={t('chat.like')}><ThumbsUp size={14} /></button>
          <button className="focus-ring w-7 h-7 flex items-center justify-center rounded-md text-on-muted hover:bg-surface-4 hover:text-on-surface transition-colors" aria-label={t('chat.dislike')}><ThumbsDown size={14} /></button>
          <button className="focus-ring w-7 h-7 flex items-center justify-center rounded-md text-on-muted hover:bg-surface-4 hover:text-on-surface transition-colors" aria-label={t('chat.regenerate')}><RotateCw size={14} /></button>
        </div>
      </div>
    </div>
  )
}

const ACTION_LABELS = {
  update_shopify_product_seo: 'chat.actions.updateShopifyProductSeo',
  update_shopify_product_image: 'chat.actions.updateShopifyProductImage',
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

function ActionCard({ action }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState(action.status || 'proposed')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const title = t(ACTION_LABELS[action.function_name] || 'chat.actions.generic', { name: action.function_name })
  const entries = Object.entries(action.arguments || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')

  const handleConfirm = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await api.confirmAction(action.id)
      if (res.status === 'failed') {
        setError(res.result?.message || t('chat.actions.failed'))
        setStatus('failed')
      } else {
        setStatus('executed')
      }
    } catch (err) {
      setError(err.message || t('chat.actions.failed'))
      setStatus('failed')
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async () => {
    setBusy(true)
    try {
      await api.rejectAction(action.id)
      setStatus('rejected')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card-base p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-ai-soft text-primary"><Sparkles size={16} /></div>
        <span className="text-base font-semibold text-on-surface">{title}</span>
      </div>
      {entries.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-start gap-2">
              <span className="w-[18px] h-[18px] flex items-center justify-center rounded bg-success-dim text-success text-[11px] font-bold flex-shrink-0 mt-0.5"><Check size={11} /></span>
              <span className="text-sm text-on-muted"><span className="font-medium text-on-surface">{key}:</span> {String(value)}</span>
            </div>
          ))}
        </div>
      )}

      {status === 'proposed' && (
        <div className="flex gap-2 items-center">
          <button className="focus-ring px-3 py-1.5 text-[13px] font-medium rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50" onClick={handleConfirm} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : t('chat.confirmAction')}
          </button>
          <button className="focus-ring px-3 py-1.5 text-[13px] font-medium rounded-lg border border-border-strong text-on-surface hover:bg-surface-4 transition-colors disabled:opacity-50" onClick={handleReject} disabled={busy}>
            {t('chat.rejectAction')}
          </button>
        </div>
      )}
      {status === 'executed' && (
        <div className="flex items-center gap-1.5 text-success text-[13px] font-medium"><Check size={14} /> {t('chat.actions.executed')}</div>
      )}
      {status === 'rejected' && (
        <div className="flex items-center gap-1.5 text-on-muted text-[13px] font-medium"><X size={14} /> {t('chat.actions.rejectedLabel')}</div>
      )}
      {status === 'failed' && (
        <div className="text-error text-[13px] font-medium">{error || t('chat.actions.failed')}</div>
      )}
    </div>
  )
}
