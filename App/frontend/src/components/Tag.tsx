import { CSSProperties, ReactNode } from 'react'

interface TagProps {
  color: string
  children: ReactNode
  style?: CSSProperties
}

export function Tag({ color, children, style }: TagProps) {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 600,
        background: color + '20',
        color,
        ...style,
      }}
    >
      {children}
    </span>
  )
}

export function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <div
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        animation: pulse ? 'pulse 1.4s infinite' : undefined,
      }}
    />
  )
}
