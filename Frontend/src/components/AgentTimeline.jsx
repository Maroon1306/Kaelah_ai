import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, Circle } from 'lucide-react'

const STEP_KEYS = ['comprehension', 'connection', 'analysis', 'generation']
const MAX_STEP = 2

export default function AgentTimeline() {
  const { t } = useTranslation()
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    if (activeStep >= MAX_STEP) return
    const timeout = setTimeout(() => setActiveStep((s) => Math.min(s + 1, MAX_STEP)), 500)
    return () => clearTimeout(timeout)
  }, [activeStep])

  return (
    <div className="flex items-center gap-4" role="status" aria-live="polite">
      {STEP_KEYS.map((key, i) => (
        <div key={key} className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-1.5">
            {i < activeStep && <Check size={16} className="text-success" />}
            {i === activeStep && <Loader2 size={16} className="text-primary animate-spin" />}
            {i > activeStep && <Circle size={16} className="text-on-dim" />}
            <span className={`text-[10px] font-bold whitespace-nowrap ${i <= activeStep ? 'text-on-surface' : 'text-on-dim'}`}>{t(`chat.agentSteps.${key}`)}</span>
          </div>
          {i < STEP_KEYS.length - 1 && <div className="h-px w-8 bg-border flex-shrink-0" />}
        </div>
      ))}
    </div>
  )
}
