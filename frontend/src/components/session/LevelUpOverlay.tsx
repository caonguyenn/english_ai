import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';

interface LevelUpOverlayProps {
  fromModule: string;
  toModuleId: number;
  toModuleTitle: string;
  sessionsCompleted: number;
  avgScore: number;
  onDismiss: () => void;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

const CONFETTI_COLORS = [
  '#C9A84C', '#F0C96A', '#2DD4BF', '#818CF8', '#F472B6',
  '#34D399', '#FBBF24', '#60A5FA',
];

function runConfetti(canvas: HTMLCanvasElement, duration = 3000) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles: Particle[] = [];
  const spawnEnd = performance.now() + 2000;
  let rafId: number;

  function spawn() {
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -10,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: Math.random() * 6 + 4,
        life: 0,
        maxLife: Math.random() * 120 + 80,
      });
    }
  }

  const spawnInterval = setInterval(spawn, 80);

  function draw(now: number) {
    // ctx is guaranteed non-null (checked above); cast to satisfy strict null checks
    const c = ctx as CanvasRenderingContext2D;
    c.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08; // gravity
      p.life++;
      const alpha = 1 - p.life / p.maxLife;
      c.globalAlpha = alpha;
      c.fillStyle = p.color;
      c.beginPath();
      c.rect(p.x, p.y, p.size, p.size * 0.5);
      c.fill();
      if (p.life >= p.maxLife) particles.splice(i, 1);
    }
    c.globalAlpha = 1;

    if (now < spawnEnd || particles.length > 0) {
      rafId = requestAnimationFrame(draw);
    }
  }

  rafId = requestAnimationFrame(draw);

  setTimeout(() => {
    clearInterval(spawnInterval);
    setTimeout(() => cancelAnimationFrame(rafId), duration);
  }, duration);

  return () => {
    clearInterval(spawnInterval);
    cancelAnimationFrame(rafId);
  };
}

const AUTO_DISMISS_SEC = 8;

export default function LevelUpOverlay({
  fromModule,
  toModuleId,
  toModuleTitle,
  sessionsCompleted,
  avgScore,
  onDismiss,
}: LevelUpOverlayProps) {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showCta, setShowCta] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_DISMISS_SEC);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    if (canvasRef.current) {
      cleanup = runConfetti(canvasRef.current, 3000) ?? undefined;
    }
    // Show CTAs after 900ms
    const showTimer = setTimeout(() => setShowCta(true), 900);
    // Auto-dismiss countdown
    const cdInterval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { onDismiss(); return 0; }
        return c - 1;
      });
    }, 1000);

    return () => {
      cleanup?.();
      clearTimeout(showTimer);
      clearInterval(cdInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleBegin() {
    onDismiss();
    navigate(`/modules/${toModuleId}`);
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(10,13,20,0.95)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Confetti canvas */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {/* Panel */}
      <div style={{
        position: 'relative',
        width: 480,
        maxWidth: '92vw',
        textAlign: 'center',
        animation: 'levelup-in 400ms var(--ease-spring) both',
      }}>
        <style>{`@keyframes levelup-in { from { opacity:0; transform:scale(0.8); } to { opacity:1; transform:scale(1); } }`}</style>

        {/* Icon */}
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'var(--accent-gold-muted)',
          border: '2px solid var(--accent-gold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          animation: 'orb-breathe 2s ease-in-out infinite',
        }}>
          <TrendingUp size={36} strokeWidth={1.5} style={{ color: 'var(--accent-gold)' }} />
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 52,
          fontWeight: 700,
          color: 'var(--accent-gold)',
          lineHeight: 1,
          marginBottom: 8,
        }}>
          Level Up!
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 28 }}>
          You've mastered <strong style={{ color: 'var(--text-primary)' }}>{fromModule}</strong>
        </p>

        {/* New module card */}
        <div style={{
          background: 'rgba(17,21,32,0.9)',
          border: '1px solid var(--border-gold)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          marginBottom: 16,
          boxShadow: 'var(--shadow-gold)',
          animation: 'page-enter 400ms 600ms var(--ease-out-expo) both',
        }}>
          <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
            Starting next
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-primary)', fontWeight: 600 }}>
            {toModuleTitle}
          </div>
        </div>

        {/* Stats */}
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--text-muted)',
          marginBottom: 28,
        }}>
          Sessions completed: {sessionsCompleted} &nbsp;•&nbsp; Avg score: {avgScore}/100
        </p>

        {/* CTAs */}
        {showCta && (
          <div style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            animation: 'page-enter 300ms var(--ease-out-expo) both',
          }}>
            <button
              onClick={handleBegin}
              style={{
                padding: '11px 24px',
                background: 'var(--accent-gold)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                color: 'var(--text-inverse)',
                fontSize: 14,
                fontWeight: 500,
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
              }}
            >
              Begin {toModuleTitle} →
            </button>
            <button
              onClick={() => { onDismiss(); navigate('/profile'); }}
              style={{
                padding: '11px 24px',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-pill)',
                color: 'var(--text-primary)',
                fontSize: 14,
                fontWeight: 500,
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
              }}
            >
              View my progress
            </button>
          </div>
        )}

        {/* Countdown dismiss */}
        <button
          onClick={onDismiss}
          style={{
            display: 'block',
            margin: '16px auto 0',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-body)',
          }}
        >
          Dismiss ({countdown}s)
        </button>
      </div>
    </div>
  );
}
