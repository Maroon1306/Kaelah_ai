import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, BookOpen, MessageCircle, Send, CheckCircle2 } from 'lucide-react'
import { faqItems } from '../../data/mockData'
import { api } from '../../services/api'

export default function HelpTab() {
  const { t } = useTranslation()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!message.trim()) return
    setSending(true)
    try {
      await api.submitFeedback(message)
      setMessage('')
      setSent(true)
    } catch {
      // Swallow — the form stays filled so the user can retry.
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">{t('settings.help.heading')}</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card-base card-hover p-5 flex items-center gap-4 cursor-pointer">
          <div className="icon-tile text-primary w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"><BookOpen size={18} /></div>
          <div>
            <h4 className="text-sm font-semibold">{t('settings.help.knowledgeBase.title')}</h4>
            <p className="text-xs text-on-muted mt-0.5">{t('settings.help.knowledgeBase.desc')}</p>
          </div>
        </div>
        <div className="card-base card-hover p-5 flex items-center gap-4 cursor-pointer">
          <div className="icon-tile text-accent w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"><MessageCircle size={18} /></div>
          <div>
            <h4 className="text-sm font-semibold">{t('settings.help.liveChat.title')}</h4>
            <p className="text-xs text-on-muted mt-0.5">{t('settings.help.liveChat.desc')}</p>
          </div>
        </div>
      </div>
      <div className="card-base divide-y divide-border overflow-hidden">
        {faqItems.map((id, i) => (
          <details key={id} className="group p-4" open={i === 0}>
            <summary className="list-none cursor-pointer flex justify-between items-center gap-3 text-sm font-medium">
              {t(`mock.faq.${id}.question`)}
              <ChevronDown size={16} className="text-on-muted flex-shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-xs text-on-muted leading-relaxed">{t(`mock.faq.${id}.answer`)}</p>
          </details>
        ))}
      </div>

      <div className="card-base p-5 flex flex-col gap-3">
        <h4 className="text-sm font-semibold">{t('settings.help.feedback.title')}</h4>
        <p className="text-xs text-on-muted -mt-2">{t('settings.help.feedback.desc')}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <textarea
            className="input-field min-h-[90px] resize-none"
            placeholder={t('settings.help.feedback.placeholder')}
            value={message}
            onChange={(e) => { setMessage(e.target.value); setSent(false) }}
          />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={!message.trim() || sending} className="focus-ring inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-ai text-white text-sm font-medium disabled:opacity-50 hover:shadow-glow transition-all w-fit">
              <Send size={14} />{sending ? t('settings.help.feedback.sending') : t('settings.help.feedback.send')}
            </button>
            {sent && <span className="flex items-center gap-1.5 text-xs text-success"><CheckCircle2 size={14} />{t('settings.help.feedback.sent')}</span>}
          </div>
        </form>
      </div>
    </div>
  )
}
