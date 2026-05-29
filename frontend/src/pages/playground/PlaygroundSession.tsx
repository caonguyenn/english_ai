import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { SessionWebSocket } from '../../services/websocket';
import { useSessionStore } from '../../store/sessionStore';
import { useTranscript } from '../../hooks/useTranscript';
import { useAudioCapture } from '../../hooks/useAudioCapture';
import { useAudioPlayback } from '../../hooks/useAudioPlayback';
import { StatusIndicator } from '../../components/StatusIndicator';
import { MicButton } from '../../components/MicButton';
import SessionBar from '../../components/session/SessionBar';
import SessionSummary from '../../components/session/SessionSummary';
import type { PlaygroundTopic, Message } from '../../types';

interface SessionCreateResponse {
  id: string;
}

const TOPIC_EMOJIS: Record<string, string> = {
  'nature-environment':   '🌿',
  'family-relationships': '👨‍👩‍👧',
  'travel-places':        '✈️',
  'technology-science':   '🔬',
  'food-culture':         '🍜',
  'current-events':       '📰',
  'health-wellbeing':     '💚',
  'sports-hobbies':       '🏄',
  'work-career':          '💼',
  'animals-wildlife':     '🦋',
};

export default function PlaygroundSession() {
  const { topic: slug } = useParams<{ topic: string }>();
  const navigate = useNavigate();
  const sessionStore = useSessionStore();
  const { messages, startNewMessage, appendToCurrentMessage, finalizeCurrentMessage } = useTranscript();
  const { startCapture, stopCapture, isSpeaking } = useAudioCapture();
  const { enqueueBase64Audio, clearQueue } = useAudioPlayback();
  const transcriptRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<SessionWebSocket | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [sessionCreated, setSessionCreated] = useState(false);
  const [micActive, setMicActive] = useState(false);
  // Half-duplex gate — suppress mic while AI is speaking
  const aiSpeakingRef = useRef(false);

  const { data: topics } = useQuery<PlaygroundTopic[]>({
    queryKey: ['topics'],
    queryFn: async () => (await api.get<PlaygroundTopic[]>('/playground/topics')).data,
    staleTime: 10 * 60 * 1000,
  });

  const topic = topics?.find((t) => t.slug === slug);

  // Create session then connect WebSocket once topic id is available
  useEffect(() => {
    if (!topic || sessionCreated) return;
    let sessionId: string | null = null;

    async function createSession() {
      if (!topic) return;
      try {
        const res = await api.post<SessionCreateResponse>('/sessions', {
          session_type: 'playground',
          topic_id: topic.id,
        });
        sessionId = res.data.id;
        sessionStore.setSession(res.data.id, 'playground', topic.id);
        setSessionCreated(true);

        const ws = new SessionWebSocket({
          sessionType: 'playground',
          refId: topic.id,
          onAudioOutput: (audio) => {
            const int16 = new Int16Array(audio);
            const bytes = new Uint8Array(int16.buffer);
            let bin = '';
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            enqueueBase64Audio(btoa(bin));
          },
          onAiSpeakingChange: (speaking) => {
            aiSpeakingRef.current = speaking;
          },
          onContentStart: (role) => {
            startNewMessage(role === 'USER' ? 'USER' : 'ASSISTANT');
          },
          onContentEnd: () => {
            finalizeCurrentMessage();
          },
          onTextOutput: (text) => {
            appendToCurrentMessage(text);
          },
          onLevelUp: () => { /* playground sessions do not trigger level-up */ },
          onConnectionStatus: (status) => {
            if (status === 'authenticated') sessionStore.setWsConnected(true);
          },
          onError: (err) => console.error('[PlaygroundSession WS]', err),
        });
        ws.connect(res.data.id);
        wsRef.current = ws;
      } catch {
        // best-effort
      }
    }

    void createSession();

    return () => {
      wsRef.current?.close();
      wsRef.current = null;
      stopCapture();
      clearQueue();
      if (sessionId !== null) {
        void api.patch(`/sessions/${sessionId}`, {
          ended_at: new Date().toISOString(),
        }).catch(() => { /* best-effort */ });
        sessionStore.endSession();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  function handleMicToggle() {
    if (!sessionStore.wsConnected) return;
    if (micActive) {
      stopCapture();
      setMicActive(false);
    } else {
      void startCapture(
        (pcm) => {
          // Half-duplex: drop frames while AI is speaking
          if (!aiSpeakingRef.current) {
            wsRef.current?.sendAudio(pcm);
          }
        },
        () => { /* VAD silence callback */ },
      );
      setMicActive(true);
    }
  }

  function handleExit() {
    setShowSummary(true);
  }

  function handleSummaryClose() {
    setShowSummary(false);
    navigate('/playground', { replace: true });
  }

  const wsReady = sessionStore.wsConnected;
  const emoji = slug ? (TOPIC_EMOJIS[slug] ?? '💬') : '💬';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-base)' }}>
      <SessionBar
        title={topic?.title ?? 'Speaking Playground'}
        xpEarned={sessionStore.xpEarned}
        onExit={handleExit}
      />

      <div
        ref={transcriptRef}
        aria-live="polite"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 40px',
          background: 'var(--bg-base)',
          scrollBehavior: 'smooth',
        }}
      >
        {messages.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 12,
          }}>
            <div style={{ fontSize: 56 }}>{emoji}</div>
            <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)' }}>
              {wsReady ? 'Ready — start speaking!' : 'Session starting…'}
            </p>
            {topic && (
              <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 400, textAlign: 'center', lineHeight: 1.5 }}>
                {topic.description}
              </p>
            )}
          </div>
        )}
        {messages.map((msg) => (
          <TranscriptBubble key={msg.id} message={msg} />
        ))}
      </div>

      <div style={{
        flexShrink: 0,
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
        padding: '20px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
      }}>
        <StatusIndicator
          status={wsReady ? 'connected' : 'connecting'}
          phase={isSpeaking ? 'listening' : 'idle'}
        />
        <MicButton
          phase={micActive ? 'listening' : 'idle'}
          isConnecting={!wsReady}
          onClick={handleMicToggle}
        />
        <div style={{ width: 120, color: 'var(--text-muted)', fontSize: 12 }}>
          {!wsReady && 'Connecting…'}
          {wsReady && micActive && 'Listening…'}
        </div>
      </div>

      {showSummary && (
        <SessionSummary
          durationSeconds={0}
          xpEarned={sessionStore.xpEarned}
          ctaLabel="Back to Playground"
          onClose={handleSummaryClose}
        />
      )}
    </div>
  );
}

function TranscriptBubble({ message }: { message: Message }) {
  const isAI = message.role === 'ASSISTANT';
  return (
    <div
      className="msg-in"
      style={{
        display: 'flex',
        justifyContent: isAI ? 'flex-start' : 'flex-end',
        marginBottom: 16,
      }}
    >
      <div style={{
        maxWidth: '65%',
        background: isAI ? 'var(--bg-surface)' : 'var(--accent-gold-muted)',
        border: `1px solid ${isAI ? 'var(--border-subtle)' : 'var(--border-gold)'}`,
        borderRadius: isAI ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
        padding: '12px 16px',
        fontFamily: isAI ? 'var(--font-body)' : 'var(--font-mono)',
        fontSize: 15,
        lineHeight: 1.6,
        color: 'var(--text-primary)',
      }}>
        {message.content}
        {message.isStreaming && <span className="blink" style={{ marginLeft: 2 }}>▍</span>}
        <div style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          marginTop: 4,
          textAlign: isAI ? 'left' : 'right',
        }}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
