import { T } from '../theme'

interface StubProps {
  icon: string
  title: string
  msg: string
}

export function Stub({ icon, title, msg }: StubProps) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: T.mu,
        gap: 12,
        padding: 40,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 52, marginBottom: 4 }}>{icon}</div>
      <div
        style={{
          fontFamily: "'Syne', sans-serif",
          fontWeight: 700,
          fontSize: 20,
          color: T.tx,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 13, color: T.mu, maxWidth: 400, lineHeight: 1.7 }}>{msg}</div>
    </div>
  )
}
