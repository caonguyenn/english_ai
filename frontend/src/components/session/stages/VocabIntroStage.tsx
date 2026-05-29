import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import type { VocabStageWord } from '../../../types'

interface Props {
  vocab: VocabStageWord[]
  onContinue: () => void
}

export function VocabIntroStage({ vocab, onContinue }: Props) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.vocab-word-card', { opacity: 0, y: 20, stagger: 0.1, duration: 0.4 })
    }, listRef)
    return () => ctx.revert()
  }, [])

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Key Vocabulary</h3>
      <p style={{ opacity: 0.7, fontSize: 14, marginBottom: 0 }}>
        These words may earn bonus XP if you use them while speaking today.
      </p>
      <div ref={listRef} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
        {vocab.map(w => (
          <div
            key={w.word}
            className="vocab-word-card"
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid var(--border-subtle, #e5e7eb)',
              minWidth: 160,
              background: 'var(--bg-surface)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{w.word}</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4, color: 'var(--text-secondary)' }}>{w.meaning}</div>
          </div>
        ))}
      </div>
      <button
        onClick={onContinue}
        style={{
          marginTop: 24,
          padding: '12px 32px',
          background: '#4f46e5',
          color: '#fff',
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 15,
        }}
      >
        Continue to Grammar →
      </button>
    </div>
  )
}
