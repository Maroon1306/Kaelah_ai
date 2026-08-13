import { useState } from 'react'

const BLUE = '#3987e5'

/**
 * Weekly signups bar histogram — single series (magnitude over time), so no
 * legend, one hue, thin bars with rounded data-ends anchored to the baseline,
 * hover tooltip instead of a label on every bar.
 */
export default function SignupsChart({ data }) {
  const [hover, setHover] = useState(null)
  const width = 640
  const height = 200
  const padding = { top: 12, right: 8, bottom: 24, left: 8 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom
  const max = Math.max(1, ...data.map((d) => d.count))
  const barGap = 8
  const barW = (plotW - barGap * (data.length - 1)) / data.length

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Inscriptions par semaine">
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="var(--color-border-md)" strokeWidth={1} />
        {data.map((d, i) => {
          const barH = Math.max(2, (d.count / max) * plotH)
          const x = padding.left + i * (barW + barGap)
          const y = height - padding.bottom - barH
          const isHover = hover === i
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-pointer">
              <rect x={x} y={height - padding.bottom} width={barW} height={padding.bottom} fill="transparent" />
              <rect x={x} y={y} width={barW} height={barH} rx={4} fill={BLUE} opacity={isHover ? 1 : 0.85} />
              <text x={x + barW / 2} y={height - padding.bottom + 15} textAnchor="middle" fontSize="9" fill="var(--color-on-dim)">
                {new Date(d.weekStart).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
              </text>
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <div
          className="absolute -translate-x-1/2 -translate-y-full pointer-events-none px-2.5 py-1.5 rounded-lg bg-surface-6 border border-border-md text-xs shadow-modal whitespace-nowrap"
          style={{
            left: `${((padding.left + hover * (barW + barGap) + barW / 2) / width) * 100}%`,
            top: `${(((height - padding.bottom - Math.max(2, (data[hover].count / max) * plotH))) / height) * 100}%`,
          }}
        >
          <span className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{data[hover].count}</span> inscription{data[hover].count !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
