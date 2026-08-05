import { Loader2 } from 'lucide-react'

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-hover hover:shadow-glow',
  secondary: 'bg-transparent border border-border-strong text-on-surface hover:bg-surface-4',
  ghost: 'bg-transparent text-on-muted hover:bg-surface-4 hover:text-on-surface',
  ai: 'bg-gradient-ai text-white hover:shadow-glow hover:-translate-y-px',
  danger: 'bg-error-dim text-error border border-transparent hover:bg-error hover:text-white',
}

const sizes = {
  sm: 'px-3 py-1.5 text-[13px]',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-[15px]',
  icon: 'p-2.5 w-10 h-10',
}

export default function Button({ children, variant = 'primary', size = 'md', loading = false, disabled = false, className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`focus-ring inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}
