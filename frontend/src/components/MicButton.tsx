import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { AppPhase } from '../types';

interface Props {
  phase: AppPhase;
  isConnecting: boolean;
  onClick: () => void;
}

const MicIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1.5 15.93A7.002 7.002 0 0 1 5 12H3a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12h-2a7 7 0 0 1-5.5 5.93z" />
  </svg>
);

const StopIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="3" />
  </svg>
);

export function MicButton({ phase, isConnecting, onClick }: Props) {
  const isActive = phase !== 'idle';
  const isListening = phase === 'listening';
  const containerRef = useRef<HTMLDivElement>(null);

  // Dynamic aria-label per FRONTEND.md accessibility spec
  const ariaLabel = isListening
    ? 'Stop speaking'
    : isActive || isConnecting
    ? 'AI is responding — please wait'
    : 'Start speaking';

  // Button visual state
  const buttonStyle: React.CSSProperties = (() => {
    if (isListening) {
      return {
        background: 'rgba(201, 168, 76, 0.15)',
        border: '2px solid var(--accent-gold)',
        boxShadow:
          '0 0 0 8px rgba(201, 168, 76, 0.08), 0 0 0 16px rgba(201, 168, 76, 0.04)',
        color: 'var(--accent-gold)',
      };
    }
    if (isActive || isConnecting) {
      return {
        background: 'var(--bg-elevated)',
        border: '2px solid var(--border-default)',
        boxShadow: 'none',
        color: 'var(--text-secondary)',
      };
    }
    return {
      background: 'var(--bg-elevated)',
      border: '2px solid var(--border-default)',
      boxShadow: 'none',
      color: 'var(--text-secondary)',
    };
  })();

  // GSAP pulsing rings when actively listening
  useEffect(() => {
    if (!isListening || !containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.mic-ring',
        { scale: 1, opacity: 0.3 },
        {
          scale: 1.5,
          opacity: 0,
          duration: 1.5,
          repeat: -1,
          ease: 'power1.out',
          stagger: {
            each: 0.5,
            repeat: -1,
          },
        }
      );
    }, containerRef);
    return () => ctx.revert();
  }, [isListening]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Pulsing rings (rendered only when listening) */}
      {isListening && (
        <>
          <div
            className="mic-ring"
            style={{
              position: 'absolute',
              width: 72,
              height: 72,
              borderRadius: '50%',
              border: '2px solid var(--accent-gold)',
              pointerEvents: 'none',
            }}
          />
          <div
            className="mic-ring"
            style={{
              position: 'absolute',
              width: 72,
              height: 72,
              borderRadius: '50%',
              border: '2px solid var(--accent-gold)',
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      <button
        onClick={onClick}
        disabled={isConnecting}
        aria-label={ariaLabel}
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          cursor: isConnecting ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color 150ms ease, box-shadow 200ms ease, background 150ms ease, color 150ms ease',
          flexShrink: 0,
          opacity: isConnecting ? 0.4 : 1,
          position: 'relative',
          zIndex: 1,
          ...buttonStyle,
        }}
      >
        {isActive ? <StopIcon /> : <MicIcon />}
      </button>
    </div>
  );
}
