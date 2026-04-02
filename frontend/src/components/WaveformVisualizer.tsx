import { useEffect, useRef } from 'react';

interface Props {
  amplitudeData: Float32Array;
  isActive: boolean;
  isSpeaking: boolean;
}

export function WaveformVisualizer({ amplitudeData, isActive, isSpeaking }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    if (!isActive) {
      // Flat line
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(75, 85, 99, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    const barCount = 48;
    const barWidth = Math.floor(width / barCount) - 1;
    const step = Math.floor(amplitudeData.length / barCount);
    const color = isSpeaking ? 'rgba(34, 197, 94, 0.85)' : 'rgba(59, 130, 246, 0.75)';

    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += Math.abs(amplitudeData[i * step + j] ?? 0);
      }
      const avg = sum / step;
      const barHeight = Math.max(3, avg * height * 5);
      const x = i * (barWidth + 1);
      const y = (height - barHeight) / 2;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    }
  }, [amplitudeData, isActive, isSpeaking]);

  return (
    <canvas
      ref={canvasRef}
      width={480}
      height={80}
      className="w-full max-w-lg h-20 rounded-xl"
    />
  );
}
