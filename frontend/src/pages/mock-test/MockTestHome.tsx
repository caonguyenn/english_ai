import { useNavigate } from 'react-router-dom'
import AppShell from '../../components/layout/AppShell'

export default function MockTestHome() {
  const navigate = useNavigate()

  return (
    <AppShell pageTitle="IELTS Mock Test">
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 0' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            IELTS Mock Test
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6 }}>
            Simulate a real IELTS Speaking exam with an AI examiner. Receive a detailed band estimate after the session.
          </p>
        </div>

        <div style={{
          padding: 28,
          borderRadius: 16,
          border: '2px solid #6366f1',
          background: 'linear-gradient(135deg, #f5f3ff, #eef2ff)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{
              background: '#6366f1',
              color: '#fff',
              padding: '2px 10px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>
              PREMIUM
            </span>
            <span style={{ fontWeight: 700, fontSize: 18, color: '#111827' }}>
              Full IELTS Speaking Simulation
            </span>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { part: 'Part 1', desc: 'Introduction & interview questions (~5 min)' },
                { part: 'Part 2', desc: 'Cue card — 1 min prep + 2 min talk' },
                { part: 'Part 3', desc: 'In-depth discussion (~5 min)' },
              ].map(({ part, desc }) => (
                <div key={part} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    width: 64,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#6366f1',
                    flexShrink: 0,
                  }}>
                    {part}
                  </span>
                  <span style={{ fontSize: 14, color: '#374151' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: 'rgba(99,102,241,0.08)',
            marginBottom: 20,
            fontSize: 13,
            color: '#4b5563',
            lineHeight: 1.6,
          }}>
            Your speaking will be scored on <strong>Fluency &amp; Coherence</strong>, <strong>Lexical Resource</strong>,
            and <strong>Grammatical Range &amp; Accuracy</strong>. Results appear a few seconds after the session ends.
          </div>

          <button
            onClick={() => navigate('/mock-test/session')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '14px 32px',
              background: '#6366f1',
              color: '#fff',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 15,
              transition: 'background 200ms',
            }}
            onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = '#4f46e5' }}
            onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = '#6366f1' }}
          >
            Start Mock Test
          </button>
        </div>

        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          AI-estimated band. Not an official IELTS score.
        </p>
      </div>
    </AppShell>
  )
}
