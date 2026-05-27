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
import LevelUpOverlay from '../../components/session/LevelUpOverlay';
import type { ClassResponse, Message } from '../../types';
import type { LevelUpData } from '../../services/websocket';

interface SessionCreateResponse {
  id: number;
}

export default function ClassRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sessionStore = useSessionStore();
  const { messages, startNewMessage, appendToCurrentMessage, finalizeCurrentMessage } = useTranscript();
  const { startCapture, stopCapture, isSpeaking } = useAudioCapture();
  const { enqueueBase64Audio, clearQueue } = useAudioPlayback();
  const transcriptRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<SessionWebSocket | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [sessionCreated, setSessionCreated] = useState(false);
  const [levelUpData, setLevelUpData] = useState<LevelUpData | null>(null);
  const [micActive, setMicActive] = useState(false);

  const { data: cls } = useQuery<ClassResponse>({
    queryKey: ['class', id],
    queryFn: async () => (await api.get<ClassResponse>(`/classes/${id}`)).data,
    enabled: !!id,
  });

  // Create session then connect WebSocket
  useEffect(() => {
    if (!id || sessionCreated) return;
    let sessionId: number | null = null;

    async function createSession() {
      try {
        const res = await api.post<SessionCreateResponse>('/sessions', {
          session_type: 'class',
          class_id: Number(id),
        });
        sessionId = res.data.id;
        sessionStore.setSession(res.data.id, 'class', Number(id));
        setSessionCreated(true);

        // Connect WebSocket now that we have a sessionId
        const ws = new SessionWebSocket({
          sessionType: 'class',
          refId: Number(id),
          onAudioOutput: (audio) => {
            // audio is already raw PCM ArrayBuffer from base64 decode
            const int16 = new Int16Array(audio);
            // Re-encode as base64 for enqueueBase64Audio — or use enqueueAudio directly
            // enqueueBase64Audio expects base64; convert back
            const bytes = new Uint8Array(int16.buffer);
            let bin = '';
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            enqueueBase64Audio(btoa(bin));
          },
          onTextOutput: (text, role) => {
            const msgRole = role === 'USER' ? 'USER' : 'ASSISTANT';
            startNewMessage(msgRole);
            appendToCurrentMessage(text);
            finalizeCurrentMessage();
          },
          onLevelUp: (data) => setLevelUpData(data),
          onConnectionStatus: (status) => {
            if (status === 'authenticated') {
              sessionStore.setWsConnected(true);
            }
          },
          onError: (err) => console.error('[ClassRoom WS]', err),
        });
        ws.connect(res.data.id);
        wsRef.current = ws;
      } catch {
        // Session creation failed — UI still renders with disconnected state
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
  }, [id]);

  // Auto-scroll transcript to bottom
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
        (pcm) => wsRef.current?.sendAudio(pcm),
        () => { /* VAD silence — no explicit stop needed */ },
      );
      setMicActive(true);
    }
  }

  function handleExit() {
    setShowSummary(true);
  }

  function handleSummaryClose() {
    setShowSummary(false);
    navigate(`/modules/${cls?.module_id ?? ''}`, { replace: true });
  }

  const wsReady = sessionStore.wsConnected;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-base)' }}>
      <SessionBar
        title={cls?.title ?? 'Loading…'}
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
            color: 'var(--text-muted)',
          }}>
            <div style={{ fontSize: 48 }}>🎧</div>
            <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)' }}>
              {wsReady ? 'Session active — start speaking' : 'Session starting…'}
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {cls?.description}
            </p>
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
        <div style={{ width: 120, color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-body)' }}>
          {!wsReady && 'Connecting…'}
          {wsReady && micActive && 'Listening…'}
        </div>
      </div>

      {showSummary && (
        <SessionSummary
          durationSeconds={0}
          xpEarned={sessionStore.xpEarned}
          ctaLabel="Back to Module"
          onClose={handleSummaryClose}
        />
      )}

      {levelUpData && (
        <LevelUpOverlay
          fromModule={levelUpData.from_module}
          toModuleId={levelUpData.to_module_id}
          toModuleTitle={levelUpData.to_module}
          sessionsCompleted={0}
          avgScore={0}
          onDismiss={() => setLevelUpData(null)}
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
