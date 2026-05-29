import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { SessionWebSocket } from '../../services/websocket'
import { useSessionStore } from '../../store/sessionStore'
import { useTranscript } from '../../hooks/useTranscript'
import { useAudioCapture } from '../../hooks/useAudioCapture'
import { useAudioPlayback } from '../../hooks/useAudioPlayback'
import { StatusIndicator } from '../../components/StatusIndicator'
import { MicButton } from '../../components/MicButton'
import SessionBar from '../../components/session/SessionBar'
import SessionSummary from '../../components/session/SessionSummary'
import { PartStepper } from '../../components/mock-test/PartStepper'
import { CueCard } from '../../components/mock-test/CueCard'
import { PrepTimer } from '../../components/mock-test/PrepTimer'
import type { Message, CueCardEvent } from '../../types'

interface SessionCreateResponse {
  id: string
}

// Detect part transitions from transcript text (best-effort heuristics)
function detectPart(text: string): 1 | 2 | 3 | null {
  if (/I'm going to give you a topic/i.test(text)) return 2
  if (/more abstract ideas/i.test(text) || /Two-Way Discussion/i.test(text)) return 3
  return null
}

type PrepPhase = 'prep' | 'speaking' | null

export default function MockTestSession() {
  const navigate = useNavigate()
  const sessionStore = useSessionStore()
  const { messages, startNewMessage, appendToCurrentMessage, finalizeCurrentMessage } = useTranscript()
  const { startCapture, stopCapture, isSpeaking } = useAudioCapture()
  const { enqueueBase64Audio, clearQueue } = useAudioPlayback()
  const transcriptRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<SessionWebSocket | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const aiSpeakingRef = useRef(false)

  const [sessionCreated, setSessionCreated] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [micActive, setMicActive] = useState(false)
  const [currentPart, setCurrentPart] = useState<1 | 2 | 3>(1)
  const [cueCard, setCueCard] = useState<CueCardEvent | null>(null)
  const [prepPhase, setPrepPhase] = useState<PrepPhase>(null)

  // Create mock_test session and connect WS
  useEffect(() => {
    if (sessionCreated) return
    let sessionId: string | null = null

    async function start() {
      try {
        const res = await api.post<SessionCreateResponse>('/sessions', {
          session_type: 'mock_test',
          // no class_id or topic_id
        })
        sessionId = res.data.id
        sessionIdRef.current = sessionId
        sessionStore.setSession(sessionId, 'mock_test', null)
        setSessionCreated(true)

        const ws = new SessionWebSocket({
          sessionType: 'mock_test',
          refId: null,
          onAudioOutput: (audio) => {
            const int16 = new Int16Array(audio)
            const bytes = new Uint8Array(int16.buffer)
            let bin = ''
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
            enqueueBase64Audio(btoa(bin))
          },
          onAiSpeakingChange: (speaking) => { aiSpeakingRef.current = speaking },
          onContentStart: (role) => {
            startNewMessage(role === 'USER' ? 'USER' : 'ASSISTANT')
          },
          onContentEnd: finalizeCurrentMessage,
          onTextOutput: (text) => {
            appendToCurrentMessage(text)
            // Detect part transitions from AI speech
            const detected = detectPart(text)
            if (detected) setCurrentPart(detected)
          },
          onLevelUp: () => { /* mock_test does not trigger level-up */ },
          onConnectionStatus: (status) => {
            if (status === 'authenticated') sessionStore.setWsConnected(true)
          },
          onError: (err) => console.error('[MockTestSession WS]', err),
        })
        ws.connect(sessionId)
        wsRef.current = ws
      } catch (err) {
        console.error('[MockTestSession] session creation failed', err)
      }
    }

    void start()

    return () => {
      wsRef.current?.close()
      wsRef.current = null
      stopCapture()
      clearQueue()
      if (sessionId) {
        void api.patch(`/sessions/${sessionId}`, { ended_at: new Date().toISOString() }).catch(() => {})
        sessionStore.endSession()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [messages])

  function handleMicToggle() {
    if (!sessionStore.wsConnected) return
    if (micActive) {
      stopCapture()
      setMicActive(false)
    } else {
      void startCapture(
        (pcm) => {
          if (!aiSpeakingRef.current) wsRef.current?.sendAudio(pcm)
        },
        () => {},
      )
      setMicActive(true)
    }
  }

  function handleExit() {
    setShowSummary(true)
  }

  function handleSummaryClose() {
    const sid = sessionIdRef.current
    setShowSummary(false)
    if (sid) navigate(`/mock-test/result/${sid}`, { replace: true })
    else navigate('/mock-test', { replace: true })
  }

  const wsReady = sessionStore.wsConnected

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-base)' }}>
      <SessionBar title="IELTS Mock Test" xpEarned={0} onExit={handleExit} />

      {/* Part stepper */}
      <div style={{ padding: '12px 40px 0' }}>
        <PartStepper currentPart={currentPart} />
      </div>

      {/* Cue card + prep timer overlay (Part 2) */}
      {cueCard && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 24, padding: 24,
        }}>
          <CueCard topic={cueCard.topic} bullets={cueCard.bullets} />
          {prepPhase === 'prep' && (
            <PrepTimer
              seconds={60}
              label="Preparation time"
              onComplete={() => setPrepPhase('speaking')}
            />
          )}
          {prepPhase === 'speaking' && (
            <PrepTimer
              seconds={120}
              label="Speaking time"
              onComplete={() => { setCueCard(null); setPrepPhase(null) }}
            />
          )}
          {prepPhase === null && (
            <button
              onClick={() => setPrepPhase('prep')}
              style={{
                padding: '10px 28px', background: '#6366f1', color: '#fff',
                borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
              }}
            >
              Start preparation timer
            </button>
          )}
        </div>
      )}

      {/* Transcript */}
      <div
        ref={transcriptRef}
        aria-live="polite"
        style={{
          flex: 1, overflowY: 'auto',
          padding: '16px 40px 24px',
          background: 'var(--bg-base)',
          scrollBehavior: 'smooth',
        }}
      >
        {messages.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 12,
          }}>
            <div style={{ fontSize: 48 }}>🎓</div>
            <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)' }}>
              {wsReady ? 'Exam active — the examiner will begin shortly' : 'Connecting to examiner…'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Speak clearly. The examiner will guide you through all three parts.
            </p>
          </div>
        )}
        {messages.map((msg) => <TranscriptBubble key={msg.id} message={msg} />)}
      </div>

      {/* Controls */}
      <div style={{
        flexShrink: 0,
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
        padding: '20px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32,
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
          xpEarned={0}
          ctaLabel="View Results"
          onClose={handleSummaryClose}
        />
      )}
    </div>
  )
}

function TranscriptBubble({ message }: { message: Message }) {
  const isAI = message.role === 'ASSISTANT'
  return (
    <div
      className="msg-in"
      style={{ display: 'flex', justifyContent: isAI ? 'flex-start' : 'flex-end', marginBottom: 16 }}
    >
      <div style={{
        maxWidth: '65%',
        background: isAI ? 'var(--bg-surface)' : 'var(--accent-gold-muted)',
        border: `1px solid ${isAI ? 'var(--border-subtle)' : 'var(--border-gold)'}`,
        borderRadius: isAI ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
        padding: '12px 16px',
        fontSize: 15,
        lineHeight: 1.6,
        color: 'var(--text-primary)',
      }}>
        {message.content}
        {message.isStreaming && <span className="blink" style={{ marginLeft: 2 }}>▍</span>}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: isAI ? 'left' : 'right' }}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
