import { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import gsap from 'gsap'
import { getMockTestResult } from '../../services/api'
import AppShell from '../../components/layout/AppShell'
import type { MockTestResult as MockTestResultType } from '../../types'

interface CriterionRowProps {
  label: string
  value: number | undefined
}

function CriterionRow({ label, value }: CriterionRowProps) {
  const pct = value != null ? ((value / 9) * 100).toFixed(1) : '0'
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: '#6366f1', fontWeight: 600 }}>
          {value != null ? value.toFixed(1) : '—'}
        </span>
      </div>
      <div style={{ height: 10, borderRadius: 5, background: 'var(--border-subtle)', overflow: 'hidden' }}>
        <div
          className="band-bar-fill"
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 5,
            background: 'linear-gradient(90deg, #6366f1, #818cf8)',
          }}
        />
      </div>
    </div>
  )
}

export default function MockTestResult() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const barsRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery<MockTestResultType>({
    queryKey: ['mock-result', sessionId],
    queryFn: () => getMockTestResult(sessionId!) as Promise<MockTestResultType>,
    refetchInterval: (query) =>
      (query.state.data as MockTestResultType | undefined)?.status === 'pending' ? 3000 : false,
    enabled: !!sessionId,
  })

  // Animate bars when results are ready
  useEffect(() => {
    if (data?.status !== 'ready') return
    const ctx = gsap.context(() => {
      gsap.from('.band-bar-fill', {
        width: 0,
        duration: 1.0,
        stagger: 0.2,
        ease: 'power2.out',
      })
    }, barsRef)
    return () => ctx.revert()
  }, [data?.status])

  if (isLoading || !data) {
    return (
      <AppShell pageTitle="Mock Test Results">
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading…
        </div>
      </AppShell>
    )
  }

  if (data.status === 'pending') {
    return (
      <AppShell pageTitle="Mock Test Results">
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
            Analysing your speaking…
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Please wait a few seconds while we process your exam.
          </p>
        </div>
      </AppShell>
    )
  }

  const criteria: CriterionRowProps[] = [
    { label: 'Fluency & Coherence', value: data.fluency_coherence ?? undefined },
    { label: 'Lexical Resource', value: data.lexical_resource ?? undefined },
    { label: 'Grammatical Range & Accuracy', value: data.grammatical_range_accuracy ?? undefined },
  ]

  return (
    <AppShell pageTitle="Mock Test Results">
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 0' }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Mock Test Results
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            IELTS Speaking — AI Estimated Band
          </p>
        </div>

        {/* Overall band */}
        <div style={{
          textAlign: 'center',
          padding: '32px 24px',
          background: 'linear-gradient(135deg, #f5f3ff, #eef2ff)',
          border: '2px solid #6366f1',
          borderRadius: 16,
          marginBottom: 32,
        }}>
          <div style={{ fontSize: 13, color: '#6366f1', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Overall Band Estimate
          </div>
          <div style={{ fontSize: 64, fontWeight: 800, color: '#4f46e5', lineHeight: 1 }}>
            {data.band_overall != null ? data.band_overall.toFixed(1) : '—'}
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>out of 9.0</div>
        </div>

        {/* Criterion bars */}
        <div
          ref={barsRef}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 16,
            padding: '24px 28px',
            marginBottom: 24,
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
            Criterion Breakdown
          </h3>
          {criteria.map(c => (
            <CriterionRow key={c.label} label={c.label} value={c.value} />
          ))}
        </div>

        {/* Pronunciation coming soon */}
        <div style={{
          padding: '16px 20px',
          borderRadius: 12,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>Pronunciation</strong>
            <span style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, color: '#6b7280', fontWeight: 600 }}>
              COMING SOON
            </span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Pronunciation scoring requires additional audio analysis.
          </p>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 24 }}>
          This is an AI-estimated band score. It is not an official IELTS result.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={() => navigate('/mock-test')}
            style={{
              padding: '10px 24px',
              background: '#6366f1',
              color: '#fff',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Take Another Test
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '10px 24px',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </AppShell>
  )
}
