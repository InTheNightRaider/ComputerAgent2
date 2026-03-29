import { CSSProperties, ReactNode } from 'react'
import { T } from '../theme'

interface FieldProps {
  label: string
  children: ReactNode
  style?: CSSProperties
}

export function Field({ label, children, style }: FieldProps) {
  return (
    <div style={{ marginBottom: 12, ...style }}>
      <div
        style={{
          fontSize: 11,
          color: T.mu,
          fontWeight: 600,
          marginBottom: 5,
          textTransform: 'uppercase',
          letterSpacing: '.5px',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}
