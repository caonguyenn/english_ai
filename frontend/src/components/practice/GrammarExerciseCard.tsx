import { useState, useRef, useEffect } from 'react'
import gsap from 'gsap'
import type { GrammarAnswerResult } from '../../types'

interface Exercise {
  id: string
  category: string
  prompt: string
  options: Record<string, string>
  answered_correctly?: boolean | null
}

interface Props {
  exercise: Exercise
  onAnswer: (selected: string) => Promise<GrammarAnswerResult>
  onNext?: () => void
}

export function GrammarExerciseCard({ exercise, onAnswer, onNext }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [result, setResult] = useState<GrammarAnswerResult | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(cardRef.current, { opacity: 0, y: 20, duration: 0.4 })
    })
    return () => ctx.revert()
  }, [exercise.id])

  const handleSelect = async (option: string) => {
    if (result) return
    setSelected(option)
    try {
      const res = await onAnswer(option)
      setResult(res)
      const ctx = gsap.context(() => {
        if (res.correct) {
          gsap.to(cardRef.current, { scale: 1.02, duration: 0.15, yoyo: true, repeat: 1 })
        } else {
          gsap.to(cardRef.current, { x: -8, duration: 0.05, repeat: 5, yoyo: true, ease: 'none' })
        }
      })
      return () => ctx.revert()
    } catch (err) {
      console.error('Failed to submit answer', err)
    }
  }

  return (
    <div
      ref={cardRef}
      className="grammar-exercise-card"
      style={{
        padding: 24,
        borderRadius: 12,
        border: '1px solid var(--border-subtle, #e5e7eb)',
        background: 'var(--bg-surface)',
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 8 }}>
        Grammar: {exercise.category.replace(/_/g, ' ')}
      </div>
      <p style={{ fontSize: 18, marginBottom: 20, color: 'var(--text-primary)' }}>
        {exercise.prompt}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Object.entries(exercise.options).map(([key, val]) => {
          const isSelected = selected === key
          const isCorrect = result?.correct_option === key
          const isWrong = result !== null && isSelected && !result.correct
          return (
            <button
              key={key}
              onClick={() => void handleSelect(key)}
              disabled={result !== null}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                textAlign: 'left',
                cursor: result !== null ? 'default' : 'pointer',
                background:
                  isCorrect && result !== null
                    ? '#dcfce7'
                    : isWrong
                    ? '#fee2e2'
                    : isSelected
                    ? '#eff6ff'
                    : 'transparent',
                border: `1px solid ${
                  isCorrect && result !== null
                    ? '#86efac'
                    : isWrong
                    ? '#fca5a5'
                    : '#e5e7eb'
                }`,
                color: 'var(--text-primary)',
              }}
            >
              <strong>{key}.</strong> {val}
            </button>
          )
        })}
      </div>
      {result !== null && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: result.correct ? '#f0fdf4' : '#fef2f2',
            borderRadius: 8,
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {result.correct ? 'Correct!' : 'Incorrect'}
          </div>
          <div style={{ fontSize: 14, marginTop: 4, color: 'var(--text-secondary)' }}>
            {result.explanation}
          </div>
          {result.xp_awarded > 0 && (
            <div style={{ color: '#16a34a', marginTop: 4, fontWeight: 600 }}>
              +{result.xp_awarded} XP
            </div>
          )}
          {onNext && (
            <button
              onClick={onNext}
              style={{
                marginTop: 12,
                padding: '8px 16px',
                borderRadius: 8,
                background: 'var(--accent-gold)',
                border: 'none',
                color: 'var(--text-inverse)',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Next exercise
            </button>
          )}
        </div>
      )}
    </div>
  )
}
