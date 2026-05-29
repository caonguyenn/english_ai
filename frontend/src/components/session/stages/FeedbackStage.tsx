import { useQuery } from '@tanstack/react-query'
import { getSessionAnalysis } from '../../../services/api'
import type { AnalysisResult } from '../../../types'
import { GrammarMistakes } from '../feedback/GrammarMistakes'
import { VocabPanel } from '../feedback/VocabPanel'
import { BandCard } from '../feedback/BandCard'
import { PronunciationComingSoon } from '../feedback/PronunciationComingSoon'

interface Props {
  sessionId: string
  studentId: string
  onClose: () => void
}

export function FeedbackStage({ sessionId, onClose }: Props) {
  const { data: analysis, isLoading } = useQuery<AnalysisResult>({
    queryKey: ['session-analysis', sessionId],
    queryFn: () => getSessionAnalysis(sessionId) as Promise<AnalysisResult>,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 3000 : false),
  })

  const isPending = isLoading || !analysis || analysis.status === 'pending'

  return (
    <div style={{ padding: '8px 0' }}>
      <h3 style={{ marginBottom: 16 }}>Session Feedback</h3>

      {isPending ? (
        <div style={{
          padding: '32px 24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <p style={{ fontSize: 15 }}>Analysing your session…</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>This takes about 30 seconds.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <BandCard band={analysis.band_estimate} />
          <GrammarMistakes mistakes={analysis.grammar_mistakes ?? []} />
          <VocabPanel vocab={analysis.vocab_usage ?? []} />
          <PronunciationComingSoon />
        </div>
      )}

      <button
        onClick={onClose}
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
        Back to Module →
      </button>
    </div>
  )
}
