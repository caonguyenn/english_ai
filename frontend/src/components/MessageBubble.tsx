import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { Message } from '../types';

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'USER';
  const ts = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Entrance animation: fade + slide from the appropriate side
  useEffect(() => {
    if (!bubbleRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(bubbleRef.current, {
        opacity: 0,
        x: isUser ? 8 : -8,
        duration: 0.2,
        ease: 'power2.out',
        clearProps: 'all',
      });
    });
    return () => ctx.revert();
    // Run only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={bubbleRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 14,
        maxWidth: '65%',
        marginLeft: isUser ? 'auto' : undefined,
        marginRight: isUser ? undefined : 'auto',
      }}
    >
      {/* Bubble */}
      <div
        style={{
          padding: '12px 16px',
          borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          background: isUser ? 'var(--accent-gold-muted)' : 'var(--bg-surface)',
          border: isUser
            ? '1px solid var(--border-gold)'
            : '1px solid var(--border-subtle)',
          fontSize: 15,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          fontFamily: isUser ? 'var(--font-mono)' : 'var(--font-body)',
          color: 'var(--text-primary)',
          wordBreak: 'break-word',
        }}
      >
        {message.content || (message.isStreaming ? '' : '…')}
        {message.isStreaming && (
          <span
            className="blink"
            style={{
              display: 'inline-block',
              width: 2,
              height: 14,
              background: 'currentColor',
              marginLeft: 3,
              verticalAlign: 'middle',
              borderRadius: 1,
            }}
          />
        )}
      </div>

      {/* Timestamp */}
      <span
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          marginTop: 4,
          padding: '0 4px',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {ts}
      </span>
    </div>
  );
}
