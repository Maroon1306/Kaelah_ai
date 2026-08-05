import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import AppRouter from './router/AppRouter'

export default function App() {
  const { i18n } = useTranslation()

  useEffect(() => {
    document.documentElement.lang = i18n.language?.split('-')[0] || 'fr'
  }, [i18n.language])

  return <AppRouter />
}
