import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import Button from './Button'
import KaelahLogo from './KaelahLogo'

export default function Navbar() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const links = [
    { label: t('nav.links.features'), href: '#features' },
    { label: t('nav.links.solutions'), href: '#solutions' },
    { label: t('nav.links.pricing'), href: '#pricing' },
  ]

  const toggleLanguage = () => i18n.changeLanguage(i18n.language.startsWith('fr') ? 'en' : 'fr')

  return (
    <header className="fixed top-0 inset-x-0 z-[100] glass">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10 flex items-center justify-between h-16">
        <Link to="/" className="focus-ring flex items-center gap-2 rounded-lg">
          <KaelahLogo size={32} />
          <span className="text-lg font-bold tracking-tight">{t('common.brand')}<span className="text-accent">{t('common.brandSuffix')}</span></span>
        </Link>

        <nav className="hidden lg:flex gap-7">
          {links.map((link) => <a key={link.href} href={link.href} className="focus-ring rounded text-sm font-medium text-on-muted hover:text-on-surface transition-colors">{link.label}</a>)}
        </nav>

        <div className="flex items-center gap-1 sm:gap-3">
          <button onClick={toggleLanguage} className="focus-ring w-9 h-9 flex items-center justify-center rounded-lg text-on-muted hover:bg-surface-4 hover:text-on-surface transition-colors text-xs font-semibold uppercase" aria-label={t('common.languageToggle')}>
            {i18n.language.startsWith('fr') ? 'FR' : 'EN'}
          </button>
          <Link to="/login" className="focus-ring hidden sm:block text-sm font-medium text-on-muted hover:text-on-surface transition-colors rounded px-1">{t('nav.login')}</Link>
          <Button size="sm" onClick={() => navigate('/register')}>{t('nav.cta')}</Button>
          <button className="focus-ring lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-on-surface" onClick={() => setMobileOpen((v) => !v)} aria-label={mobileOpen ? t('common.closeMenu') : t('common.openMenu')} aria-expanded={mobileOpen} aria-controls="landing-mobile-nav">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div id="landing-mobile-nav" className="lg:hidden glass border-t border-border px-4 py-3 flex flex-col gap-1">
          {links.map((link) => <a key={link.href} href={link.href} className="focus-ring px-3 py-2.5 rounded-lg text-sm font-medium text-on-surface hover:bg-surface-4" onClick={() => setMobileOpen(false)}>{link.label}</a>)}
          <Link to="/login" className="focus-ring px-3 py-2.5 rounded-lg text-sm font-medium text-on-surface hover:bg-surface-4" onClick={() => setMobileOpen(false)}>{t('nav.login')}</Link>
        </div>
      )}
    </header>
  )
}
