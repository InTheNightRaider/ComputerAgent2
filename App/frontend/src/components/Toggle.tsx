import { T } from '../theme'

interface ToggleProps {
  value: boolean
  onChange: (v: boolean) => void
  label?: string
}

export function Toggle({ value, onChange, label }: ToggleProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: value ? T.gr : T.s4,
          cursor: 'pointer',
          position: 'relative',
          transition: 'background .2s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 3,
            left: value ? 17 : 3,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left .2s',
          }}
        />
      </div>
      {label && <span style={{ fontSize: 12, color: T.mu }}>{value ? 'On' : 'Off'}{label ? ` — ${label}` : ''}</span>}
    </div>
  )
}
