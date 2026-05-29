import { useRef, useEffect } from 'react'
import gsap from 'gsap'

interface Props {
  topic: string
  bullets: string[]
}

export function CueCard({ topic, bullets }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(cardRef.current, { opacity: 0, scale: 0.95, duration: 0.4, ease: 'power2.out' })
    })
    return () => ctx.revert()
  }, [topic])

  return (
    <div
      ref={cardRef}
      style={{
        padding: 24,
        borderRadius: 12,
        background: '#fffbeb',
        border: '2px solid #fbbf24',
        maxWidth: 420,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#92400e' }}>
        Cue Card
      </div>
      <div style={{ fontStyle: 'italic', marginBottom: 16, fontSize: 16, color: '#1f2937', lineHeight: 1.5 }}>
        {topic}
      </div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>You should say:</div>
      <ul style={{ margin: '0', paddingLeft: 20, lineHeight: 1.9 }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ fontSize: 14, color: '#374151' }}>{b}</li>
        ))}
      </ul>
    </div>
  )
}
