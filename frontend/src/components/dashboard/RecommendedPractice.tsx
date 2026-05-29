import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getGrammarWeaknesses } from '../../services/api'
import type { GrammarWeakness } from '../../types'

interface Props {
  studentId: string
}

export function RecommendedPractice({ studentId }: Props) {
  const navigate = useNavigate()
  const { data: weaknesses } = useQuery<GrammarWeakness[]>({
    queryKey: ['grammar-weaknesses', studentId],
    queryFn: () => getGrammarWeaknesses(studentId) as Promise<GrammarWeakness[]>,
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000,
  })

  const top = weaknesses?.[0]

  if (!top) {
    return (
      <div style={{
        padding: 16,
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
          Recommended Practice
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          Complete a few sessions to unlock recommended grammar practice.
        </p>
      </div>
    )
  }

  return (
    <div style={{
      padding: 16,
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-subtle)',
      background: 'var(--bg-surface)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
        Recommended Practice
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
        Focus area: <strong style={{ color: 'var(--text-primary)' }}>{top.category.replace(/_/g, ' ')}</strong>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
        Seen in {top.times_seen} session{top.times_seen !== 1 ? 's' : ''}
      </div>
      <button
        onClick={() => navigate('/practice/grammar')}
        style={{
          padding: '8px 16px',
          background: 'var(--accent-gold)',
          border: 'none',
          borderRadius: 'var(--radius-pill)',
          color: 'var(--text-inverse)',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          width: '100%',
        }}
      >
        Practice Now
      </button>
    </div>
  )
}
