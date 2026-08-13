import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Modal from '../components/Modal'
import Button from '../components/Button'

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const resolver = useRef(null)

  const confirm = useCallback(({ title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', danger = false } = {}) => {
    setState({ title, message, confirmLabel, cancelLabel, danger })
    return new Promise((resolve) => { resolver.current = resolve })
  }, [])

  const close = (result) => {
    resolver.current?.(result)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} title={state?.title} size="sm">
        {state && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3">
              {state.danger && <div className="w-9 h-9 rounded-full bg-error-dim text-error flex items-center justify-center flex-shrink-0"><AlertTriangle size={18} /></div>}
              <p className="text-sm text-on-muted pt-1.5">{state.message}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => close(false)}>{state.cancelLabel}</Button>
              <Button variant={state.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{state.confirmLabel}</Button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  )
}

/** await useConfirm()({ title, message, danger }) -> boolean, replaces window.confirm. */
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
