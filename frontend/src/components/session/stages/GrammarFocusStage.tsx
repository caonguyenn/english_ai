import { useState, useEffect } from 'react'
import { GrammarExerciseCard } from '../../practice/GrammarExerciseCard'
import { generateGrammarExercise, answerGrammarExercise } from '../../../services/api'
import type { GrammarExercise, GrammarAnswerResult } from '../../../types'

interface Props {
  studentId: string
  grammarCategory: string
  onContinue: () => void
}

export function GrammarFocusStage({ studentId, grammarCategory, onContinue }: Props) {
  const [exercise, setExercise] = useState<GrammarExercise | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    setLoading(true)
    generateGrammarExercise(studentId)
      .then((ex: GrammarExercise) => setExercise(ex))
      .catch(() => setDone(true)) // if no exercise available, skip
      .finally(() => setLoading(false))
  }, [studentId])

  const handleAnswer = (selected: string): Promise<GrammarAnswerResult> => {
    if (!exercise) return Promise.reject(new Error('No exercise'))
    return answerGrammarExercise(exercise.id, selected) as Promise<GrammarAnswerResult>
  }

  if (loading) {
    return (
      <div>
        <p style={{ color: 'var(--text-secondary)' }}>Loading grammar exercise...</p>
        <button
          onClick={onContinue}
          style={{ marginTop: 16, padding: '8px 20px', borderRadius: 8, cursor: 'pointer' }}
        >
          Skip →
        </button>
      </div>
    )
  }

  if (!exercise || done) {
    return (
      <div>
        <h3 style={{ marginBottom: 8 }}>Grammar Focus</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
          No grammar exercise available yet. Keep practicing to unlock recommendations!
        </p>
        <button
          onClick={onContinue}
          style={{
            padding: '12px 32px',
            background: '#4f46e5',
            color: '#fff',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Continue to Speaking →
        </button>
      </div>
    )
  }

  return (
    <div>
      <h3 style={{ marginBottom: 4 }}>Grammar Focus</h3>
      <p style={{ opacity: 0.7, fontSize: 14, marginBottom: 16 }}>
        Warm up with a quick grammar exercise.{' '}
        <span style={{ fontSize: 12, opacity: 0.6 }}>Category: {grammarCategory.replace(/_/g, ' ')}</span>
      </p>
      <GrammarExerciseCard
        exercise={exercise}
        onAnswer={handleAnswer}
        onNext={onContinue}
      />
      <button
        onClick={onContinue}
        style={{
          marginTop: 16,
          opacity: 0.6,
          fontSize: 14,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
        }}
      >
        Skip exercise →
      </button>
    </div>
  )
}
