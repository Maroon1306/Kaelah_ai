import { useTranslation } from 'react-i18next'
import { ChevronDown, BookOpen, MessageCircle } from 'lucide-react'
import { faqItems } from '../../data/mockData'

export default function HelpTab() {
  const { t } = useTranslation()

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
    </div>
  )
}
