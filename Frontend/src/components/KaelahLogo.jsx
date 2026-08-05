import { useId } from 'react'

export default function KaelahLogo({ size = 24, className = '' }) {
  const gradientId = useId()

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="55%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <path fill={`url(#${gradientId})`} d="M20,14 H34 V44 L66,14 H84 L48,50 L84,86 H66 L34,56 V86 H20 Z" />
      <path fill="#f0f9ff" d="M27,43 C28,47 30,49 34,50 C30,51 28,53 27,57 C26,53 24,51 20,50 C24,49 26,47 27,43 Z" />
    </svg>
  )
}
