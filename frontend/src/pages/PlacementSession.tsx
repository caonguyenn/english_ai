import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { SessionWebSocket } from '../services/websocket';
import { useSessionStore } from '../store/sessionStore';
import { useTranscript } from '../hooks/useTranscript';
import { useAudioCapture } from '../hooks/useAudioCapture';
import { useAudioPlayback } from '../hooks/useAudioPlayback';
import { StatusIndicator } from '../components/StatusIndicator';
import { MicButton } from '../components/MicButton';
import type { Message } from '../types';

interface SessionCreateResponse {
  id: string;
}

interface PlacementResult {
  band: number;
  moduleId: string;
  moduleTitle: string;
}

function PlacementStepper({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        color: 'var(--text-secondary)',
        whiteSpace: 'nowrap',
      }}>
        Question {current} of 6
      </span>
      <div style={{ display: 'flex', gap: 5, marginLeft: 8 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: i < current ? 'var(--accent-gold)' : 'var(--border-default)',
              transition: 'background 300ms',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function PlacementSession() {
  const navigate = useNavigate();
  const sessionStore = useSessionStore();
  const { messages, startNewMessage, appendToCurrentMessage, finalizeCurrentMessage } = useTranscript();
  const { startCapture, stopCapture, isSpeaking } = useAudioCapture();
  const { enqueueBase64Audio, clearQueue } = useAudioPlayback();
  const transcriptRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<SessionWebSocket | null>(null);
  const [questionIndex, setQuestionIndex] = useState(1);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [micActive, setMicActive] = useState(false);
  // Half-duplex gate — suppress mic while AI is speaking
  const aiSpeakingRef = useRef(false);

  // Create placement session on mount then connect WebSocket
  useEffect(() => {
    let createdId: string | null = null;

    async function createSession() {
      try {
        const res = await api.post<SessionCreateResponse>('/sessions', {
          session_type: 'placement',
        });
        createdId = res.data.id;
        setSessionId(res.data.id);
        sessionStore.setSession(res.data.id, 'placement', null);

        const ws = new SessionWebSocket({
          sessionType: 'placement',
          refId: null,
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
          onLevelUp: (data) => {
            if (!data.to_module_id) return;
            setResult({
              band: data.band,
              moduleId: data.to_module_id,
              moduleTitle: data.to_module,
            });
          },
          onConnectionStatus: (status) => {
            if (status === 'authenticated') sessionStore.setWsConnected(true);
          },
          onError: (err) => console.error('[PlacementSession WS]', err),
        });
        ws.connect(res.data.id);
        wsRef.current = ws;
      } catch {
        // continue without session record
      }
    }

    void createSession();

    return () => {
      wsRef.current?.close();
      wsRef.current = null;
      stopCapture();
      clearQueue();
      if (createdId !== null) {
        void api.patch(`/sessions/${createdId}`, {
          ended_at: new Date().toISOString(),
        }).catch(() => { /* best-effort */ });
        sessionStore.endSession();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  // Advance stepper when AI sends a new completed message
  useEffect(() => {
    const aiMessages = messages.filter((m) => m.role === 'ASSISTANT' && !m.isStreaming);
    if (aiMessages.length > 0) {
      setQuestionIndex(Math.min(aiMessages.length + 1, 6));
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

  async function handleConfirmPlacement() {
    if (!result) return;
    setIsConfirming(true);
    try {
      await api.post('/auth/confirm-placement', {
        module_id: result.moduleId,
        placement_band: result.band,
      });
      if (sessionId) {
        await api.patch(`/sessions/${sessionId}`, { ended_at: new Date().toISOString() });
      }
      navigate('/dashboard', { replace: true });
    } catch {
      setIsConfirming(false);
    }
  }

  const wsReady = sessionStore.wsConnected;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-base)' }}>
      {/* Session bar */}
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
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          Placement Assessment
        </div>
        <PlacementStepper current={questionIndex} />
      </div>

      {/* Transcript pane */}
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
            gap: 16,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 48 }}>🎧</div>
            <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)' }}>
              Your assessment will begin shortly
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 340, lineHeight: 1.6 }}>
              Speak clearly and naturally. There are no wrong answers.
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <TranscriptBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Control bar */}
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
        <div style={{ width: 120 }} />
      </div>

      {/* Placement result overlay */}
      {result && (
        <PlacementResultScreen
          result={result}
          isConfirming={isConfirming}
          onConfirm={() => { void handleConfirmPlacement(); }}
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
      </div>
    </div>
  );
}

interface PlacementResultProps {
  result: PlacementResult;
  isConfirming: boolean;
  onConfirm: () => void;
}

function PlacementResultScreen({ result, isConfirming, onConfirm }: PlacementResultProps) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 500,
      background: 'rgba(10,13,20,0.96)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: 480,
        padding: '0 24px',
        animation: 'page-enter 400ms var(--ease-out-expo) both',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 72,
          fontWeight: 700,
          color: 'var(--accent-gold)',
          lineHeight: 1,
          marginBottom: 12,
        }}>
          {result.band.toFixed(1)}
        </div>
        <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
          Your IELTS Level: {result.band.toFixed(1)}
        </p>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.5 }}>
          You'll start with <strong style={{ color: 'var(--text-primary)' }}>{result.moduleTitle}</strong>
        </p>
        <button
          onClick={onConfirm}
          disabled={isConfirming}
          style={{
            padding: '13px 32px',
            background: isConfirming ? 'rgba(201,168,76,0.5)' : 'var(--accent-gold)',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            color: 'var(--text-inverse)',
            fontSize: 15,
            fontWeight: 500,
            fontFamily: 'var(--font-body)',
            cursor: isConfirming ? 'not-allowed' : 'pointer',
            opacity: isConfirming ? 0.7 : 1,
          }}
        >
          {isConfirming ? 'Starting…' : 'Begin Your Learning Journey →'}
        </button>
      </div>
    </div>
  );
}
