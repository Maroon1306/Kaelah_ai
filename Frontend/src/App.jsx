import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import AppRouter from './router/AppRouter'
import { ToastProvider } from './context/ToastContext'
import { ConfirmProvider } from './context/ConfirmContext'

export default function App() {
  const { i18n } = useTranslation()

  useEffect(() => {
    document.documentElement.lang = i18n.language?.split('-')[0] || 'fr'
  }, [i18n.language])

  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppRouter />
      </ConfirmProvider>
    </ToastProvider>
  )
}
