interface Props {
  stage: 1 | 2 | 3 | 4
}

const STAGES = ['Vocabulary', 'Grammar', 'Speaking', 'Feedback']

export function StageStepper({ stage }: Props) {
  return (
    <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
      {STAGES.map((label, i) => {
        const stageNum = i + 1
        const isActive = stageNum === stage
        const isDone = stageNum < stage
        return (
          <div
            key={label}
            style={{
              flex: 1,
              padding: '10px 4px',
              textAlign: 'center',
              fontSize: 13,
              fontWeight: isActive ? 700 : 400,
              background: isActive ? '#4f46e5' : isDone ? '#e0e7ff' : '#f3f4f6',
              color: isActive ? '#fff' : isDone ? '#4338ca' : '#6b7280',
            }}
          >
            {isDone ? '✓ ' : ''}{label}
          </div>
        )
      })}
    </div>
  )
}
