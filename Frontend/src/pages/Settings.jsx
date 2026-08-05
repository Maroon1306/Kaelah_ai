import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, User, Sparkles, Bell, Shield, Plug, CreditCard, Users, HelpCircle,
} from 'lucide-react'
import AccountTab from '../components/settings/AccountTab'
import AiPreferencesTab from '../components/settings/AiPreferencesTab'
import NotificationsTab from '../components/settings/NotificationsTab'
import SecurityTab from '../components/settings/SecurityTab'
import ConnectorsTab from '../components/settings/ConnectorsTab'
import BillingTab from '../components/settings/BillingTab'
import TeamTab from '../components/settings/TeamTab'
import HelpTab from '../components/settings/HelpTab'

const TAB_COMPONENTS = {
  account: AccountTab,
  ai: AiPreferencesTab,
  notifications: NotificationsTab,
  security: SecurityTab,
  connectors: ConnectorsTab,
  billing: BillingTab,
  team: TeamTab,
  help: HelpTab,
}

export default function Settings() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab')
  const [activeSection, setActiveSection] = useState(TAB_COMPONENTS[initialTab] ? initialTab : 'account')

  const toggleLanguage = () => i18n.changeLanguage(i18n.language.startsWith('fr') ? 'en' : 'fr')

  const sections = [
    { id: 'account', label: t('settings.sections.account'), icon: User },
    { id: 'ai', label: t('settings.sections.ai'), icon: Sparkles },
    { id: 'notifications', label: t('settings.sections.notifications'), icon: Bell },
    { id: 'security', label: t('settings.sections.security'), icon: Shield },
    { id: 'connectors', label: t('settings.sections.connectors'), icon: Plug },
    { id: 'billing', label: t('settings.sections.billing'), icon: CreditCard },
    { id: 'team', label: t('settings.sections.team'), icon: Users },
    { id: 'help', label: t('settings.sections.help'), icon: HelpCircle },
  ]

  const ActiveTab = TAB_COMPONENTS[activeSection]

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg">
      {/* Fixed top bar — never scrolls */}
      <header className="flex-shrink-0 glass border-b border-border">
        <div className="max-w-[1100px] mx-auto px-6 h-16 flex items-center justify-between">
          <button className="focus-ring flex items-center gap-2 rounded-lg text-sm font-medium text-on-muted hover:text-on-surface transition-colors" onClick={() => navigate('/chat')}>
            <ArrowLeft size={18} /><span className="hidden sm:inline">{t('common.backToChat')}</span>
          </button>
          <span className="text-sm font-bold tracking-tight">{t('common.brand')}<span className="text-accent">{t('common.brandSuffix')}</span></span>
          <button onClick={toggleLanguage} className="focus-ring w-9 h-9 flex items-center justify-center rounded-lg text-on-muted hover:bg-surface-4 hover:text-on-surface transition-colors text-xs font-semibold uppercase" aria-label={t('common.languageToggle')}>
            {i18n.language.startsWith('fr') ? 'FR' : 'EN'}
          </button>
        </div>
      </header>

      {/* Fixed page title — never scrolls */}
      <div className="flex-shrink-0 max-w-[1100px] w-full mx-auto px-6 pt-6 pb-4">
        <h1 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="text-on-muted mt-1">{t('settings.subtitle')}</p>
      </div>

      {/* Body: on desktop, the nav stays fixed and only the tab content scrolls.
          On mobile, nav + content scroll together as one column below the fixed header/title. */}
      <div className="flex-1 min-h-0 flex justify-center overflow-y-auto md:overflow-hidden">
        <div className="w-full max-w-[1100px] flex flex-col md:flex-row gap-6 md:gap-8 px-6 md:min-h-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible md:overflow-y-auto md:w-[220px] md:flex-shrink-0 py-2">
            {sections.map((section) => {
              const Icon = section.icon
              return (
                <button key={section.id} className={`focus-ring flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-left whitespace-nowrap relative ${activeSection === section.id ? 'bg-surface-4 text-on-surface' : 'text-on-muted hover:bg-surface-4 hover:text-on-surface'}`} onClick={() => setActiveSection(section.id)}>
                  {activeSection === section.id && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3/5 bg-primary rounded-r hidden md:block" />}
                  <Icon size={16} /><span>{section.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="flex-1 min-w-0 md:min-h-0 md:overflow-y-auto py-2 pb-10">
            <ActiveTab />
          </div>
        </div>
      </div>
    </div>
  )
}
