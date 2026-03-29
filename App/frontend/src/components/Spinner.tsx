import { T } from '../theme'

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: `2px solid ${T.ac}44`,
        borderTopColor: T.ac,
        borderRadius: '50%',
        animation: 'spin .6s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}
