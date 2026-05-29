import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { generateGrammarExercise, answerGrammarExercise } from '../../services/api'
import { GrammarExerciseCard } from '../../components/practice/GrammarExerciseCard'
import AppShell from '../../components/layout/AppShell'
import type { GrammarExercise, GrammarAnswerResult } from '../../types'

export default function GrammarPractice() {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  const [exercise, setExercise] = useState<GrammarExercise | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!profile) return null

  const loadExercise = async () => {
    setLoading(true)
    setError(null)
    try {
      const ex = await generateGrammarExercise(profile.id) as GrammarExercise | null
      if (ex === null) {
        setError('No grammar weaknesses found yet. Complete a few sessions first.')
      } else {
        setExercise(ex)
      }
    } catch {
      setError('Failed to load exercise. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = async (selected: string): Promise<GrammarAnswerResult> => {
    return answerGrammarExercise(exercise!.id, selected) as Promise<GrammarAnswerResult>
  }

  const handleNext = () => {
    setExercise(null)
    void queryClient.invalidateQueries({ queryKey: ['grammar-weaknesses', profile.id] })
  }

  return (
    <AppShell pageTitle="Grammar Practice">
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.75rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 6,
          }}>
            Grammar Practice
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Personalised exercises based on your session mistakes.
          </p>
        </div>

        {!exercise && !loading && !error && (
          <button
            onClick={() => void loadExercise()}
            style={{
              padding: '12px 24px',
              background: 'var(--accent-gold)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              color: 'var(--text-inverse)',
              fontWeight: 500,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Start Practice
          </button>
        )}

        {loading && (
          <div style={{ color: 'var(--text-secondary)', padding: '24px 0' }}>
            Generating exercise...
          </div>
        )}

        {error && (
          <div style={{
            padding: 16,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
          }}>
            {error}
          </div>
        )}

        {exercise && !loading && (
          <GrammarExerciseCard
            exercise={exercise}
            onAnswer={handleAnswer}
            onNext={handleNext}
          />
        )}
      </div>
    </AppShell>
  )
}
