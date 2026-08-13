import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)
const DURATION_MS = 3000

const VARIANTS = {
  success: { icon: CheckCircle2, className: 'text-success bg-success-dim' },
  error: { icon: AlertCircle, className: 'text-error bg-error-dim' },
  info: { icon: Info, className: 'text-primary bg-primary-dim' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => dismiss(id), DURATION_MS)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[2000] flex flex-col gap-2 max-w-[360px]">
        {toasts.map((t) => {
          const variant = VARIANTS[t.type] || VARIANTS.info
          const Icon = variant.icon
          return (
            <div key={t.id} className="glass rounded-xl shadow-modal px-4 py-3 flex items-start gap-2.5 animate-fade-up" role="status">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${variant.className}`}><Icon size={14} /></div>
              <p className="text-sm flex-1 pt-0.5">{t.message}</p>
              <button className="focus-ring text-on-muted hover:text-on-surface flex-shrink-0" onClick={() => dismiss(t.id)} aria-label="Fermer"><X size={14} /></button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.showToast
}
