import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { GrammarMistake } from '../../../types';

interface Props {
  mistakes: GrammarMistake[];
}

export function GrammarMistakes({ mistakes }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mistakes.length) return;
    const ctx = gsap.context(() => {
      gsap.from('.grammar-item', {
        opacity: 0,
        y: 16,
        stagger: 0.08,
        duration: 0.4,
        ease: 'power2.out',
      });
    }, listRef);
    return () => ctx.revert();
  }, [mistakes]);

  if (!mistakes.length) return null;

  return (
    <div ref={listRef}>
      <h3 style={{
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--text-secondary)',
        marginBottom: 12,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}>
        Grammar Corrections
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {mistakes.map((m, i) => (
          <div
            key={i}
            className="grammar-item"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--color-error, #f87171)', marginBottom: 4 }}>
              ✗ {m.original}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-success, #4ade80)', marginBottom: 4 }}>
              ✓ {m.corrected}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.reason}</div>
            {m.category && (
              <div style={{
                display: 'inline-block',
                marginTop: 6,
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                background: 'rgba(255,255,255,0.06)',
                fontSize: 11,
                color: 'var(--text-muted)',
              }}>
                {m.category}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
