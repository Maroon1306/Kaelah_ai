const SLOTS = [
  { key: 'starter', label: 'Starter', color: '#3987e5' },
  { key: 'pro', label: 'Pro', color: '#d95926' },
  { key: 'business', label: 'Business', color: '#199e70' },
]

/**
 * Plan distribution — categorical (identity), 3 fixed slots, always in the
 * same order/color regardless of counts. Horizontal bars read better than a
 * pie for 3 categories and keep every value directly labeled.
 */
export default function PlanBreakdownChart({ breakdown }) {
  const total = Math.max(1, SLOTS.reduce((sum, s) => sum + (breakdown[s.key] || 0), 0))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {SLOTS.map((s) => {
          const count = breakdown[s.key] || 0
          const pct = Math.round((count / total) * 100)
          return (
            <div key={s.key} className="flex items-center gap-3">
              <span className="w-16 text-xs text-on-muted flex-shrink-0">{s.label}</span>
              <div className="flex-1 h-2.5 rounded-full bg-surface-6 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: s.color }} />
              </div>
              <span className="w-10 text-right text-xs font-semibold flex-shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>{count}</span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 pt-1 border-t border-border">
        {SLOTS.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-[11px] text-on-muted">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
