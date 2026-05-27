import { useState, useEffect } from 'react';
import { ArrowLeft, X } from 'lucide-react';

interface SessionBarProps {
  title: string;
  xpEarned: number;
  onExit?: () => void;
  /** If true, show only a minimize button (no exit) */
  noExit?: boolean;
  /** Custom right element (e.g. progress stepper) */
  rightSlot?: React.ReactNode;
}

function useElapsedTimer(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const display = h > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return display;
}

export default function SessionBar({ title, xpEarned, onExit, noExit = false, rightSlot }: SessionBarProps) {
  const elapsed = useElapsedTimer(true);
  const [confirmExit, setConfirmExit] = useState(false);

  function handleExitClick() {
    setConfirmExit(true);
  }

  function handleConfirm() {
    setConfirmExit(false);
    onExit?.();
  }

  return (
    <>
      <div style={{
        height: 64,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        {/* Left */}
        <div style={{ width: 160 }}>
          {!noExit && (
            <button
              onClick={handleExitClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontSize: 13,
                fontFamily: 'var(--font-body)',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <ArrowLeft size={16} strokeWidth={1.5} />
              Exit Session
            </button>
          )}
        </div>

        {/* Center */}
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 320,
          textAlign: 'center',
        }}>
          {title}
        </div>

        {/* Right */}
        <div style={{ width: 160, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          {rightSlot ?? (
            <>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                color: 'var(--text-secondary)',
              }}>
                {elapsed}
              </span>
              <span style={{
                background: 'var(--accent-gold-muted)',
                border: '1px solid rgba(201,168,76,0.3)',
                borderRadius: 'var(--radius-pill)',
                padding: '3px 10px',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent-gold)',
              }}>
                +{xpEarned} XP
              </span>
            </>
          )}
        </div>
      </div>

      {/* Exit confirm dialog */}
      {confirmExit && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10,13,20,0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: 32,
            maxWidth: 360,
            width: '90%',
            boxShadow: 'var(--shadow-lg)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>End session?</h3>
              <button onClick={() => setConfirmExit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
              Your progress will be saved, but the session will end. Are you sure?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmExit(false)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: 'var(--bg-glass)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-pill)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Keep going
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: 'rgba(248,113,113,0.12)',
                  border: '1px solid rgba(248,113,113,0.3)',
                  borderRadius: 'var(--radius-pill)',
                  color: 'var(--status-error)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                End session
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
