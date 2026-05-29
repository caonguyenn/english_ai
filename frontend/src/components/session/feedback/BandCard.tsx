import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { BandEstimate } from '../../../types';

interface Props {
  band: BandEstimate;
}

const SKILLS: { key: keyof BandEstimate; label: string; color: string }[] = [
  { key: 'fluency', label: 'Fluency', color: 'var(--skill-speaking, #6ee7b7)' },
  { key: 'grammar', label: 'Grammar', color: 'var(--skill-grammar, #93c5fd)' },
  { key: 'vocabulary', label: 'Vocabulary', color: 'var(--skill-listening, #fcd34d)' },
];

function bandToPercent(value: number): number {
  // IELTS band 1–9 → 0–100%
  return Math.round(((value - 1) / 8) * 100);
}

export function BandCard({ band }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.band-bar-fill', {
        scaleX: 0,
        transformOrigin: 'left center',
        stagger: 0.1,
        duration: 0.6,
        ease: 'power3.out',
      });
    }, cardRef);
    return () => ctx.revert();
  }, [band]);

  const hasAny = SKILLS.some(({ key }) => band[key] != null);
  if (!hasAny && band.overall == null) return null;

  return (
    <div ref={cardRef}>
      <h3 style={{
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--text-secondary)',
        marginBottom: 12,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}>
        Band Estimate
      </h3>

      {band.overall != null && (
        <div style={{
          textAlign: 'center',
          marginBottom: 16,
          padding: '12px 0',
          background: 'var(--accent-gold-muted)',
          border: '1px solid var(--border-gold)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 36,
            fontWeight: 700,
            color: 'var(--accent-gold)',
            lineHeight: 1,
          }}>
            {band.overall.toFixed(1)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Overall
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SKILLS.map(({ key, label, color }) => {
          const value = band[key];
          if (value == null) return null;
          const pct = bandToPercent(value);
          return (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color }}>
                  {value.toFixed(1)}
                </span>
              </div>
              <div style={{
                height: 4,
                background: 'var(--border-subtle)',
                borderRadius: 'var(--radius-pill)',
                overflow: 'hidden',
              }}>
                <div
                  className="band-bar-fill"
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: color,
                    borderRadius: 'inherit',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
