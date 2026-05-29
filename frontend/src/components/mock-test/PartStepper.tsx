interface Props {
  currentPart: 1 | 2 | 3
}

const PARTS = [
  { num: 1, label: 'Part 1\nIntroduction' },
  { num: 2, label: 'Part 2\nCue Card' },
  { num: 3, label: 'Part 3\nDiscussion' },
]

export function PartStepper({ currentPart }: Props) {
  return (
    <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
      {PARTS.map(({ num, label }) => {
        const isActive = currentPart === num
        const isDone = currentPart > num
        return (
          <div
            key={num}
            style={{
              flex: 1,
              padding: '12px 8px',
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 600,
              background: isActive ? '#6366f1' : isDone ? '#e0e7ff' : '#f3f4f6',
              color: isActive ? '#fff' : '#374151',
              whiteSpace: 'pre-line',
              borderRight: num < 3 ? '1px solid rgba(0,0,0,0.08)' : undefined,
            }}
          >
            {label}
          </div>
        )
      })}
    </div>
  )
}
