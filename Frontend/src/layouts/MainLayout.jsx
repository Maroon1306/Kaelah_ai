import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Menu } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import EmailVerifyBanner from '../components/EmailVerifyBanner'

export default function MainLayout({ children }) {
  const { t } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-screen relative">
        <EmailVerifyBanner />
        <button
          className="focus-ring md:hidden absolute top-4 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-lg bg-surface-4 border border-border text-on-surface"
          onClick={() => setSidebarOpen(true)}
          aria-label={t('common.openMenu')}
          aria-expanded={sidebarOpen}
          aria-controls="app-sidebar"
        >
          <Menu size={20} />
        </button>
        {children}
      </div>
    </div>
  )
}
