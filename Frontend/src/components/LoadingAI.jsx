import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import AgentTimeline from './AgentTimeline'

export default function LoadingAI({ variant = 'thinking', label }) {
  const { t } = useTranslation()
  const resolvedLabel = label ?? t('chat.thinking')

  if (variant === 'analyzing') {
    return (
      <div className="glass rounded-2xl rounded-tl-none p-4 inline-block" role="status" aria-live="polite">
        <div className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent px-2.5 py-1 bg-accent-dim rounded-full w-fit mb-4">
          <Sparkles size={14} />
          <span>{t('chat.analyzing')}</span>
        </div>
        <AgentTimeline />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5" role="status" aria-live="polite">
      <div className="flex gap-1.5">
        <span className="w-2 h-2 rounded-full bg-primary animate-bounce-dot" style={{ animationDelay: '-0.32s' }} />
        <span className="w-2 h-2 rounded-full bg-primary animate-bounce-dot" style={{ animationDelay: '-0.16s' }} />
        <span className="w-2 h-2 rounded-full bg-primary animate-bounce-dot" />
      </div>
      <span className="text-sm text-on-muted">{resolvedLabel}</span>
    </div>
  )
}
