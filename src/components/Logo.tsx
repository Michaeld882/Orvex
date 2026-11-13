import { useId } from 'react'

interface MarkProps {
  size?: number
  className?: string
}

/**
 * ORVEX mark: a hexagonal frame (the limit) broken through by a rising stroke (going beyond it).
 */
export function LogoMark({ size = 36, className }: MarkProps) {
  const uid = useId().replace(/:/g, '')
  const grad = `orvex-g-${uid}`
  const mask = `orvex-m-${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={grad} x1="6" y1="44" x2="44" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34E3C0" />
          <stop offset="1" stopColor="#C8F53C" />
        </linearGradient>
        <mask id={mask}>
          <rect width="48" height="48" fill="white" />
          <path d="M15 33 41 7" stroke="black" strokeWidth="9" strokeLinecap="round" />
        </mask>
      </defs>
      <path
        d="M24 4 41.3 14v20L24 44 6.7 34V14L24 4Z"
        stroke={`url(#${grad})`}
        strokeWidth="3.6"
        strokeLinejoin="round"
        mask={`url(#${mask})`}
      />
      <path d="M15 33 41 7" stroke={`url(#${grad})`} strokeWidth="4.4" strokeLinecap="round" />
    </svg>
  )
}

interface LogoProps {
  size?: number
  showTagline?: boolean
  className?: string
}

export function Logo({ size = 34, showTagline = false, className }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.35rem] font-bold tracking-[0.16em] text-mist-100">ORVEX</span>
        {showTagline && <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-mist-500">Build Beyond Limits</span>}
      </span>
    </span>
  )
}
