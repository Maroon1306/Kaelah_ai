import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  const { t } = useTranslation()
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])

  if (!open) return null

  const sizes = { sm: 'max-w-[400px]', md: 'max-w-[520px]', lg: 'max-w-[720px]' }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} role="presentation">
      <div className={`w-full glass rounded-2xl shadow-modal animate-scale-in max-h-[90vh] overflow-hidden flex flex-col ${sizes[size]}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        {title && (
          <div className="flex items-center justify-between px-6 py-5 border-b border-border">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button onClick={onClose} className="focus-ring w-8 h-8 flex items-center justify-center rounded-lg text-on-muted hover:bg-surface-4 hover:text-on-surface transition-colors" aria-label={t('common.close')}>
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
