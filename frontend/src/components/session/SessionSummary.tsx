import { useEffect, useRef, useState } from 'react';
import { X, Trophy } from 'lucide-react';

interface SkillScore {
  skill: string;
  score: number;
}

interface SessionSummaryProps {
  durationSeconds: number;
  xpEarned: number;
  skillScores?: SkillScore[];
  ctaLabel?: string;
  onClose: () => void;
}

const SKILL_COLORS: Record<string, string> = {
  speaking: 'var(--skill-speaking)',
  listening: 'var(--skill-listening)',
  grammar: 'var(--skill-grammar)',
  pronunciation: 'var(--skill-pronunciation)',
};

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  return `${m}m ${sec}s`;
}

function AnimatedCount({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const duration = 800;
    const startTime = performance.now();
    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [target]);
  return <>{count}</>;
}

export default function SessionSummary({
  durationSeconds,
  xpEarned,
  skillScores = [],
  ctaLabel = 'Back to Module',
  onClose,
}: SessionSummaryProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on overlay backdrop click
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,13,20,0.8)',
        backdropFilter: 'blur(12px)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{
        background: 'rgba(17,21,32,0.92)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-xl)',
        padding: '40px 36px',
        maxWidth: 420,
        width: '90%',
        backdropFilter: 'blur(24px)',
        boxShadow: 'var(--shadow-lg)',
        animation: 'page-enter 300ms var(--ease-out-expo) both',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--accent-gold-muted)',
              border: '1px solid var(--border-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Trophy size={22} strokeWidth={1.5} style={{ color: 'var(--accent-gold)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                Session Complete
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {formatDuration(durationSeconds)}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* XP earned */}
        <div style={{
          background: 'var(--accent-gold-muted)',
          border: '1px solid var(--border-gold)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          textAlign: 'center',
          marginBottom: 24,
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 48,
            fontWeight: 700,
            color: 'var(--accent-gold)',
            lineHeight: 1,
          }}>
            +<AnimatedCount target={xpEarned} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            XP Earned
          </div>
        </div>

        {/* Skill scores */}
        {skillScores.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Skill Scores
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {skillScores.map(({ skill, score }) => (
                <div key={skill}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{skill}</span>
                    <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: SKILL_COLORS[skill] ?? 'var(--text-primary)' }}>{score}/100</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${score}%`,
                      background: SKILL_COLORS[skill] ?? 'var(--accent-gold)',
                      borderRadius: 'inherit',
                      animation: 'bar-grow 0.6s var(--ease-out-expo) both',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px 0',
            background: 'var(--accent-gold)',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            color: 'var(--text-inverse)',
            fontSize: 14,
            fontWeight: 500,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            transition: 'background 200ms var(--ease-out-expo)',
          }}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
