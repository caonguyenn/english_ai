import { useEffect, useRef, useState, useCallback } from 'react';
import type { AppPhase, Message } from '../types';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages: Message[];
  phase: AppPhase;
}

export function TranscriptPanel({ messages, phase }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  // Detect whether user has manually scrolled up
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsScrolledUp(distFromBottom > 80);
  }, []);

  // Auto-scroll to bottom when messages change — only if user hasn't scrolled up
  useEffect(() => {
    if (isScrolledUp) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isScrolledUp]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsScrolledUp(false);
  };

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Conversation transcript"
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 40px',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-base)',
          scrollBehavior: 'smooth',
        }}
      >
        {messages.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            color: 'var(--text-muted)',
          }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}>
              🎙
            </div>
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)' }}>
              Ready to practice
            </span>
            <span style={{
              fontSize: 13,
              textAlign: 'center',
              maxWidth: 240,
              lineHeight: 1.5,
              color: 'var(--text-muted)',
            }}>
              Select a topic and press the mic to start your session
            </span>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}

            {phase === 'thinking' && (
              <div className="msg-in" style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 10,
                marginBottom: 14,
              }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--accent-teal-muted)',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--accent-teal)',
                }}>
                  N
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 16px',
                  borderRadius: 18,
                  borderBottomLeftRadius: 4,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 13,
                  color: 'var(--text-muted)',
                }}>
                  <span style={{ fontSize: 11, marginRight: 2 }}>Thinking</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="thinking-dot"
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: 'var(--accent-teal)',
                          opacity: 0.6,
                          display: 'inline-block',
                          animationDelay: `${i * 0.2}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div ref={bottomRef} style={{ height: 0, flexShrink: 0 }} />
      </div>

      {/* "New message" chip — shown when user has scrolled up */}
      {isScrolledUp && messages.length > 0 && (
        <button
          onClick={scrollToBottom}
          aria-label="Scroll to latest message"
          style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            background: 'var(--accent-gold)',
            color: 'var(--text-inverse)',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-md)',
            zIndex: 10,
            animation: 'msg-in 0.2s ease forwards',
          }}
        >
          ↓ New message
        </button>
      )}
    </div>
  );
}
