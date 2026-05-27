interface PronunciationIssue {
  word: string;
  hint: string;
}

interface Props {
  score: number;
  issues: PronunciationIssue[];
  suggestions: string[];
  accuracy: number;
}

function ScoreRing({ score }: { score: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color =
    score >= 80
      ? 'var(--status-success)'
      : score >= 60
      ? 'var(--accent-gold)'
      : 'var(--status-error)';

  return (
    <div style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
      <svg width="88" height="88" style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx="44" cy="44" r={r}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth="5"
        />
        <circle
          cx="44" cy="44" r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 1s ease',
            filter: `drop-shadow(0 0 4px ${color})`,
          }}
        />
      </svg>
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{
          fontSize: 20,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '-1px',
          color,
        }}>
          {score}
        </span>
        <span style={{
          fontSize: 9,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          score
        </span>
      </div>
    </div>
  );
}

function AccuracyBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color }}>{value}%</span>
      </div>
      <div style={{
        height: 4,
        borderRadius: 2,
        background: 'var(--border-subtle)',
        overflow: 'hidden',
      }}>
        <div
          className="score-bar-fill"
          style={{
            height: '100%',
            width: `${value}%`,
            borderRadius: 2,
            background: color,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
      </div>
    </div>
  );
}

export function PronunciationPanel({ score, issues, suggestions, accuracy }: Props) {
  return (
    <aside style={{
      width: 260,
      borderLeft: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'var(--bg-surface)',
      flexShrink: 0,
    }}>
      <div style={{
        overflowY: 'auto',
        padding: '16px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>

        {/* Score header */}
        <div>
          <p style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 12,
          }}>
            Pronunciation
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <ScoreRing score={score} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                {score >= 80 ? 'Great job!' : score >= 60 ? 'Keep going' : 'Needs work'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.4 }}>
                {score >= 80
                  ? 'Your pronunciation is clear and natural.'
                  : 'Focus on the flagged words below.'}
              </div>
            </div>
          </div>
        </div>

        {/* Accuracy bars */}
        <div style={{
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
        }}>
          <AccuracyBar label="Speaking accuracy" value={accuracy}                  color="var(--status-success)" />
          <AccuracyBar label="Pronunciation"     value={score}                      color="var(--accent-teal)" />
          <AccuracyBar label="Fluency"           value={Math.min(100, score + 5)}  color="var(--skill-listening)" />
        </div>

        {/* Flagged words */}
        {issues.length > 0 && (
          <div>
            <p style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: 8,
            }}>
              Flagged Words
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {issues.map((issue) => (
                <div
                  key={issue.word}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(248, 113, 113, 0.08)',
                    border: '1px solid rgba(248, 113, 113, 0.22)',
                  }}
                >
                  <span style={{ fontSize: 14, lineHeight: 1 }}>❌</span>
                  <div>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-primary)',
                    }}>
                      {issue.word}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {issue.hint}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div>
            <p style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: 8,
            }}>
              Suggestions
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {suggestions.map((s) => (
                <div
                  key={s}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '7px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent-teal-muted)',
                    border: '1px solid rgba(45, 212, 191, 0.2)',
                  }}
                >
                  <span style={{ fontSize: 13, lineHeight: 1.2, color: 'var(--accent-teal)' }}>✓</span>
                  <span style={{ fontSize: 12, color: 'var(--accent-teal)', lineHeight: 1.4 }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Coach note */}
        <div style={{
          padding: '11px 13px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--accent-teal-muted)',
          border: '1px solid rgba(45, 212, 191, 0.2)',
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--accent-teal)',
            marginBottom: 4,
          }}>
            AI Coach
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            You're improving steadily. Try slowing down on multi-syllable technical terms — clarity beats speed.
          </div>
        </div>

      </div>
    </aside>
  );
}
