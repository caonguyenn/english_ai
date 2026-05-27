import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface Props {
  amplitudeData: Float32Array;
  barCount?: number;
  height?: number;
  /** Controls bar color: 'ai' = teal, 'student' = gold, omit = teal */
  speakerType?: 'ai' | 'student';
}

const BAR_COUNT = 32;
const BAR_WIDTH = 3;
const BAR_GAP = 4;

export function WaveformVisualizer({
  amplitudeData,
  barCount = BAR_COUNT,
  height = 48,
  speakerType = 'ai',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const barRefs = useRef<HTMLDivElement[]>([]);

  // Compute bar heights from amplitude data
  const step = Math.max(1, Math.floor(amplitudeData.length / barCount));
  const bars: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const idx = i * step;
    let sum = 0;
    const end = Math.min(idx + step, amplitudeData.length);
    for (let j = idx; j < end; j++) sum += Math.abs(amplitudeData[j]);
    bars.push(sum / step);
  }
  const peak = Math.max(...bars, 0.01);
  const isIdle = peak < 0.005;

  const barColor = isIdle
    ? 'var(--text-muted)'
    : speakerType === 'student'
    ? 'var(--accent-gold)'
    : 'var(--accent-teal)';

  // GSAP animate bar heights on amplitude changes
  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      barRefs.current.forEach((bar, i) => {
        if (!bar) return;
        const normalised = bars[i] / peak;
        const targetH = isIdle ? 3 : Math.max(3, normalised * height * 0.85);
        gsap.to(bar, {
          height: targetH,
          duration: 0.07,
          ease: 'power1.out',
          overwrite: 'auto',
        });
      });
    }, containerRef);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amplitudeData, speakerType, height]);

  const totalWidth = barCount * BAR_WIDTH + (barCount - 1) * BAR_GAP;

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: BAR_GAP,
        height,
        width: totalWidth,
        flexShrink: 0,
      }}
    >
      {bars.map((_, i) => (
        <div
          key={i}
          ref={(el) => { barRefs.current[i] = el!; }}
          style={{
            width: BAR_WIDTH,
            height: isIdle ? 3 : Math.max(3, (bars[i] / peak) * height * 0.85),
            borderRadius: '2px 2px 0 0',
            background: barColor,
            flexShrink: 0,
            transition: 'background 0.2s ease',
          }}
        />
      ))}
    </div>
  );
}
