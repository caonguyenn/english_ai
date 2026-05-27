import { useEffect, useRef } from 'react';
import type { AppPhase } from '../types';

interface Props {
  amplitudeData: Float32Array;
  phase: AppPhase;
  size?: number;
}

function rms(data: Float32Array): number {
  if (data.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / data.length);
}

export function AIOrb({ amplitudeData, phase, size = 96 }: Props) {
  const coreRef  = useRef<HTMLDivElement>(null);
  const ring1Ref = useRef<HTMLDivElement>(null);
  const ring2Ref = useRef<HTMLDivElement>(null);
  const rafRef   = useRef<number>(0);
  const smoothRef = useRef(0);

  useEffect(() => {
    if (phase !== 'listening' && phase !== 'speaking') {
      cancelAnimationFrame(rafRef.current);
      smoothRef.current = 0;
      if (coreRef.current) {
        coreRef.current.style.transform = '';
        coreRef.current.style.boxShadow = '';
      }
      if (ring1Ref.current) {
        ring1Ref.current.style.transform = '';
        ring1Ref.current.style.opacity = '';
      }
      if (ring2Ref.current) {
        ring2Ref.current.style.transform = '';
        ring2Ref.current.style.opacity = '';
      }
      return;
    }

    const frame = () => {
      const level  = rms(amplitudeData);
      const target = Math.min(level * 8, 1);
      smoothRef.current += (target - smoothRef.current) * (target > smoothRef.current ? 0.4 : 0.08);
      const s = smoothRef.current;

      if (coreRef.current) {
        coreRef.current.style.transform  = `scale(${1 + s * 0.22})`;
        const a  = 0.35 + s * 0.45;
        const sz = 20 + s * 40;
        // Use teal glow when listening, gold glow when speaking
        const glowColor = phase === 'listening'
          ? `rgba(45, 212, 191, ${a})`
          : `rgba(201, 168, 76, ${a})`;
        coreRef.current.style.boxShadow = `0 0 ${sz}px ${sz / 2}px ${glowColor}`;
      }
      if (ring1Ref.current) {
        ring1Ref.current.style.transform = `translate(-50%,-50%) scale(${1 + s * 0.35})`;
        ring1Ref.current.style.opacity   = String(0.3 + s * 0.4);
      }
      if (ring2Ref.current) {
        ring2Ref.current.style.transform = `translate(-50%,-50%) scale(${1 + s * 0.55})`;
        ring2Ref.current.style.opacity   = String(0.15 + s * 0.3);
      }
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [amplitudeData, phase]);

  const stateClass = {
    idle:      'orb-state-idle',
    listening: 'orb-state-listening',
    thinking:  'orb-state-thinking',
    speaking:  'orb-state-waiting',
  }[phase] ?? 'orb-state-idle';

  const ringSize1 = size * 1.1;
  const ringSize2 = size * 1.4;

  // Ring border color reflects phase
  const ringBorderColor = phase === 'listening'
    ? 'var(--border-gold)'
    : 'rgba(45, 212, 191, 0.35)';

  return (
    <div
      className={`orb-wrap ${stateClass}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`AI status: ${phase}`}
    >
      <div
        ref={ring2Ref}
        className="orb-ring orb-ring-2"
        style={{
          width: ringSize2,
          height: ringSize2,
          borderColor: ringBorderColor,
        }}
      />
      <div
        ref={ring1Ref}
        className="orb-ring orb-ring-1"
        style={{
          width: ringSize1,
          height: ringSize1,
          borderColor: ringBorderColor,
        }}
      />
      <div
        ref={coreRef}
        className="orb-core"
        style={{ width: size, height: size }}
      />
      <div
        className="orb-highlight"
        style={{
          width: size * 0.16,
          height: size * 0.10,
          top: `calc(50% - ${size * 0.27}px)`,
          left: `calc(50% - ${size * 0.19}px)`,
        }}
      />
    </div>
  );
}
