import { Link, useNavigate, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Plus, MessageSquare, Search, BarChart3,
  Settings, X, Languages, ChevronUp, LogOut, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { suggestedPrompts } from '../data/mockData'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import KaelahLogo from './KaelahLogo'

const iconMap = { ShoppingBag: MessageSquare, Search, MessageSquare, BarChart3 }

function formatTimestamp(isoString) {
  const date = new Date(isoString)
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return isToday ? time : `${date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} · ${time}`
}

export default function Sidebar({ open, onClose }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { conversationId: activeId } = useParams()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [conversations, setConversations] = useState([])
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('kaelah_sidebar_collapsed') === '1')
  const menuRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('kaelah_sidebar_collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    if (!location.pathname.startsWith('/chat')) return
    let cancelled = false
    api.getConversations().then(({ conversations }) => { if (!cancelled) setConversations(conversations) }).catch(() => {})
    return () => { cancelled = true }
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false)
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [menuOpen])

  const toggleLanguage = () => i18n.changeLanguage(i18n.language.startsWith('fr') ? 'en' : 'fr')

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    navigate('/login')
  }

  const initials = user?.fullName
    ? user.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <>
      {open && <div className="md:hidden fixed inset-0 bg-black/50 z-[199]" onClick={onClose} />}
      <aside id="app-sidebar" className={`
        w-[260px] ${collapsed ? 'md:w-20' : 'md:w-[260px]'} flex-shrink-0 glass border-r border-border flex flex-col min-h-0 h-screen md:h-screen
        fixed md:static z-[200] transition-[transform,width] duration-300
        ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header: mobile + expanded-desktop layout (logo/brand left, close/collapse toggle right) */}
        <div className={`flex items-center justify-between gap-2 px-5 py-4 ${collapsed ? 'md:hidden' : ''}`}>
          <Link to="/chat" className="focus-ring flex items-center gap-2 rounded-lg min-w-0">
            <KaelahLogo size={28} />
            <span className="text-base font-bold tracking-tight truncate">{t('common.brand')}<span className="text-accent">{t('common.brandSuffix')}</span></span>
          </Link>
          <button className="focus-ring md:hidden w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-on-muted" onClick={onClose} aria-label={t('common.closeMenu')}><X size={18} /></button>
          <button
            className="focus-ring hidden md:flex w-8 h-8 flex-shrink-0 items-center justify-center rounded-lg text-on-muted hover:bg-surface-4 hover:text-on-surface transition-colors"
            onClick={() => setCollapsed(true)}
            aria-label={t('sidebar.collapse')}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        {/* Header: collapsed-desktop layout — logo and toggle stacked, never side-by-side in a narrow rail */}
        {collapsed && (
          <div className="hidden md:flex flex-col items-center gap-2 pt-4 pb-2">
            <Link to="/chat" className="focus-ring w-11 h-11 flex items-center justify-center rounded-lg"><KaelahLogo size={26} /></Link>
            <button
              className="focus-ring w-9 h-9 flex items-center justify-center rounded-lg text-on-muted hover:bg-surface-4 hover:text-on-surface transition-colors"
              onClick={() => setCollapsed(false)}
              aria-label={t('sidebar.expand')}
            >
              <PanelLeftOpen size={17} />
            </button>
          </div>
        )}

        <button className={`focus-ring flex items-center gap-2 rounded-xl bg-gradient-ai text-white text-sm font-medium hover:shadow-glow hover:-translate-y-px transition-all ${collapsed ? 'md:w-11 md:h-11 md:p-0 md:justify-center md:mx-auto mx-4 mb-4 px-3.5 py-2.5' : 'mx-4 mb-4 px-3.5 py-2.5'}`} onClick={() => navigate('/chat')} aria-label={t('sidebar.newConversation')}>
          <Plus size={16} className="flex-shrink-0" /><span className={collapsed ? 'md:hidden' : ''}>{t('sidebar.newConversation')}</span>
        </button>

        <div className={`px-4 pb-4 ${collapsed ? 'md:hidden' : ''}`}>
          <span className="block px-1 mb-2 text-[11px] font-semibold uppercase tracking-wider text-on-muted">{t('sidebar.suggestions')}</span>
          {suggestedPrompts.map((prompt) => {
            const Icon = iconMap[prompt.icon] || MessageSquare
            return (
              <button key={prompt.id} className="focus-ring w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-on-muted hover:bg-surface-4 hover:text-on-surface transition-colors text-left" onClick={() => navigate('/chat')}>
                <Icon size={14} /><span>{t(`mock.suggestedPrompts.${prompt.id}`)}</span>
              </button>
            )
          })}
        </div>

        <div className={`flex-1 min-h-0 overflow-y-auto px-2 pb-2 ${collapsed ? 'md:hidden' : ''}`}>
          <span className="block px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-on-muted">{t('sidebar.history')}</span>
          <div className="flex flex-col gap-0.5">
            {conversations.length === 0 && (
              <p className="px-3 py-2 text-[12px] text-on-dim">{t('sidebar.noHistory')}</p>
            )}
            {conversations.map((conv) => (
              <button
                key={conv.id}
                className={`focus-ring flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors relative ${conv.id === activeId ? 'bg-surface-4 text-on-surface' : 'text-on-muted hover:bg-surface-4 hover:text-on-surface'}`}
                onClick={() => navigate(`/chat/${conv.id}`)}
              >
                {conv.id === activeId && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3/5 bg-primary rounded-r" />}
                <MessageSquare size={14} className="mt-0.5 flex-shrink-0" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[13px] font-medium truncate">{conv.title}</span>
                  <span className="text-[11px] opacity-70">{formatTimestamp(conv.updated_at)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
        {collapsed && <div className="hidden md:block flex-1" />}

        {/* Account menu */}
        <div className="relative border-t border-border p-2" ref={menuRef}>
          {menuOpen && (
            <div className={`glass absolute bottom-full mb-2 rounded-xl shadow-modal p-1.5 flex flex-col gap-0.5 animate-fade-up ${collapsed ? 'md:left-2 md:w-56 left-2 right-2' : 'left-2 right-2'}`} role="menu">
              <button className="focus-ring flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-on-muted hover:bg-surface-4 hover:text-on-surface transition-colors text-left" role="menuitem" onClick={() => { setMenuOpen(false); navigate('/settings') }}>
                <Settings size={16} /><span>{t('sidebar.settings')}</span>
              </button>
              <button className="focus-ring flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-on-muted hover:bg-surface-4 hover:text-on-surface transition-colors text-left" role="menuitem" onClick={toggleLanguage}>
                <Languages size={16} /><span>{i18n.language.startsWith('fr') ? 'English' : 'Français'}</span>
              </button>
              <div className="h-px bg-border my-1" />
              <button className="focus-ring flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-error hover:bg-error-dim transition-colors text-left" role="menuitem" onClick={handleLogout}>
                <LogOut size={16} /><span>{t('sidebar.logout')}</span>
              </button>
            </div>
          )}
          <button
            className={`focus-ring w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left hover:bg-surface-4 transition-colors ${collapsed ? 'md:justify-center md:px-0' : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={t('common.accountMenu')}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-ai text-white flex items-center justify-center text-[11px] font-semibold flex-shrink-0">{initials}</div>
            <span className={`text-sm font-medium text-on-surface truncate flex-1 ${collapsed ? 'md:hidden' : ''}`}>{user?.fullName || ''}</span>
            <ChevronUp size={15} className={`text-on-muted flex-shrink-0 transition-transform ${menuOpen ? '' : 'rotate-180'} ${collapsed ? 'md:hidden' : ''}`} />
          </button>
        </div>
      </aside>
    </>
  )
}
