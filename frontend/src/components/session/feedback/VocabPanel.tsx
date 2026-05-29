import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { VocabItem } from '../../../types';

interface Props {
  vocab: VocabItem[];
}

export function VocabPanel({ vocab }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!vocab.length) return;
    const ctx = gsap.context(() => {
      gsap.from('.vocab-chip', {
        opacity: 0,
        scale: 0.85,
        stagger: 0.05,
        duration: 0.35,
        ease: 'back.out(1.4)',
      });
    }, containerRef);
    return () => ctx.revert();
  }, [vocab]);

  if (!vocab.length) return null;

  return (
    <div ref={containerRef}>
      <h3 style={{
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--text-secondary)',
        marginBottom: 12,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}>
        Vocabulary Used
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {vocab.map((item, i) => (
          <span
            key={i}
            className="vocab-chip"
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-pill)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-subtle)',
              fontSize: 13,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {item.word}
            {item.frequency != null && item.frequency > 1 && (
              <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                ×{item.frequency}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
