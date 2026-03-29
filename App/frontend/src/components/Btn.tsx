import { CSSProperties, ReactNode } from 'react'
import { T } from '../theme'

type Variant = 'ac' | 'ok' | 'ghost' | 'red' | 'warn'

const BG: Record<Variant, string> = {
  ac: T.ac,
  ok: T.gr,
  ghost: T.s3,
  red: T.rd,
  warn: T.amb,
}

interface BtnProps {
  children: ReactNode
  onClick?: () => void
  variant?: Variant
  style?: CSSProperties
  disabled?: boolean
}

export function Btn({ children, onClick, variant = 'ac', style, disabled }: BtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '7px 15px',
        border: 'none',
        borderRadius: 8,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: BG[variant],
        color: T.tx,
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  )
}
