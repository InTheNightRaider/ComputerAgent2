import { DT, DTKey } from '../data/pipelines'

export function DTBadge({ type }: { type: string }) {
  const d = DT[type as DTKey] ?? DT.TEXT
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 5,
        fontSize: 10,
        fontWeight: 700,
        background: d.c + '20',
        color: d.c,
      }}
    >
      {d.i} {d.l}
    </span>
  )
}
