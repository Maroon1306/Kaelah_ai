import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'

export default function ProductCard({ product }) {
  const { t } = useTranslation()

  return (
    <div className="card-base card-hover p-3 flex flex-col gap-2.5">
      <div className="aspect-square rounded-xl overflow-hidden bg-surface-3 flex items-center justify-center bg-gradient-ai-soft">
        {product.image ? (
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <Sparkles size={22} className="text-primary" />
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-on-surface truncate">{product.name}</span>
        {product.price && <span className="text-sm font-medium text-accent">{product.price}</span>}
      </div>
      {product.suggestion && (
        <div className="flex flex-col gap-0.5 px-2.5 py-2 bg-surface-2 rounded-lg border border-border">
          <span className="text-[10px] uppercase tracking-wide text-accent font-semibold">{t('mock.aiResponseCard.aiSuggestion')}</span>
          <span className="text-xs text-on-muted">{product.suggestion}</span>
        </div>
      )}
    </div>
  )
}
