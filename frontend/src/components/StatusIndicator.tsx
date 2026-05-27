import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { AppPhase, ConnectionStatus } from '../types';

interface Props {
  status: ConnectionStatus;
  phase: AppPhase;
}

const CONNECTION_LABELS: Record<ConnectionStatus, string> = {
  disconnected: 'Disconnected',
  connecting:   'Connecting…',
  connected:    'Connected',
  error:        'Error',
};

const PHASE_LABELS: Record<AppPhase, string> = {
  idle:      'Ready',
  listening: 'Listening',
  thinking:  'Thinking',
  speaking:  'Speaking',
};

// ── Listening indicator: pulsing teal dot ────────────────────────────────────
function ListeningDot() {
  const dotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!dotRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to(dotRef.current, {
        scale: 1.5,
        opacity: 0.4,
        duration: 0.75,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <span
      ref={dotRef}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'var(--accent-teal)',
        boxShadow: '0 0 6px var(--accent-teal)',
        flexShrink: 0,
      }}
    />
  );
}

// ── Speaking indicator: 4 animated equalizer bars ────────────────────────────
function SpeakingBars() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to('.status-bar', {
        scaleY: () => gsap.utils.random(0.3, 1),
        duration: 0.3,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
        stagger: 0.1,
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: 14,
        flexShrink: 0,
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="status-bar"
          style={{
            width: 3,
            height: 12,
            borderRadius: 2,
            background: 'var(--accent-teal)',
            transformOrigin: 'bottom',
          }}
        />
      ))}
    </div>
  );
}

// ── Thinking indicator: 3 bouncing dots ──────────────────────────────────────
function ThinkingDots() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to('.think-dot', {
        y: -4,
        duration: 0.4,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
        stagger: { each: 0.15, repeat: -1 },
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="think-dot"
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'var(--text-secondary)',
          }}
        />
      ))}
    </div>
  );
}

// ── Idle/ready indicator: static grey dot ────────────────────────────────────
function IdleDot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

export function StatusIndicator({ status, phase }: Props) {
  const isConnected = status === 'connected';
  const label = isConnected ? PHASE_LABELS[phase] : CONNECTION_LABELS[status];

  const indicator = (() => {
    if (status === 'error')      return <IdleDot color="var(--status-error)" />;
    if (status === 'connecting') return <IdleDot color="var(--status-warning)" />;
    if (!isConnected)            return <IdleDot color="var(--text-muted)" />;
    if (phase === 'listening')   return <ListeningDot />;
    if (phase === 'speaking')    return <SpeakingBars />;
    if (phase === 'thinking')    return <ThinkingDots />;
    // idle / ready
    return <IdleDot color="var(--status-success)" />;
  })();

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 20px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-pill)',
        minWidth: 120,
        justifyContent: 'center',
        font: '500 13px/1 var(--font-body)',
        color: 'var(--text-secondary)',
        userSelect: 'none',
      }}
      role="status"
      aria-live="polite"
      aria-label={`Session status: ${label}`}
    >
      {indicator}
      <span style={{ color: 'var(--text-primary)' }}>{label}</span>
    </div>
  );
}
