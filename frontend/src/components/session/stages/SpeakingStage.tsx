import { useEffect, useRef, useState } from 'react'
import { api } from '../../../services/api'
import { useSessionStore } from '../../../store/sessionStore'
import { useTranscript } from '../../../hooks/useTranscript'
import { useAudioCapture } from '../../../hooks/useAudioCapture'
import { useAudioPlayback } from '../../../hooks/useAudioPlayback'
import { StatusIndicator } from '../../StatusIndicator'
import { MicButton } from '../../MicButton'
import SessionBar from '../SessionBar'
import SessionSummary from '../SessionSummary'
import LevelUpOverlay from '../LevelUpOverlay'
import type { Message } from '../../../types'
import type { LevelUpData } from '../../../services/websocket'
import { SessionWebSocket } from '../../../services/websocket'

interface SessionCreateResponse {
  id: string
}

interface Props {
  classId: string
  studentId?: string
  className?: string
  classDescription?: string
  onComplete: (sessionId: string) => void
}

export function SpeakingStage({ classId, className, classDescription, onComplete }: Props) {
  const sessionStore = useSessionStore()
  const { messages, startNewMessage, appendToCurrentMessage, finalizeCurrentMessage } = useTranscript()
  const { startCapture, stopCapture, isSpeaking } = useAudioCapture()
  const { enqueueBase64Audio, clearQueue } = useAudioPlayback()
  const transcriptRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<SessionWebSocket | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [sessionCreated, setSessionCreated] = useState(false)
  const [levelUpData, setLevelUpData] = useState<LevelUpData | null>(null)
  const [micActive, setMicActive] = useState(false)
  // Half-duplex gate — suppress mic while AI is speaking
  const aiSpeakingRef = useRef(false)

  // Create session then connect WebSocket
  useEffect(() => {
    if (!classId || sessionCreated) return
    let sessionId: string | null = null

    async function createSession() {
      try {
        const res = await api.post<SessionCreateResponse>('/sessions', {
          session_type: 'class',
          class_id: classId,
        })
        sessionId = res.data.id
        sessionIdRef.current = sessionId
        sessionStore.setSession(res.data.id, 'class', classId)
        setSessionCreated(true)

        const ws = new SessionWebSocket({
          sessionType: 'class',
          refId: classId,
          onAudioOutput: (audio) => {
            const int16 = new Int16Array(audio)
            const bytes = new Uint8Array(int16.buffer)
            let bin = ''
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
            enqueueBase64Audio(btoa(bin))
          },
          onAiSpeakingChange: (speaking) => {
            aiSpeakingRef.current = speaking
          },
          onContentStart: (role) => {
            startNewMessage(role === 'USER' ? 'USER' : 'ASSISTANT')
          },
          onContentEnd: () => {
            finalizeCurrentMessage()
          },
          onTextOutput: (text) => {
            appendToCurrentMessage(text)
          },
          onLevelUp: (data) => {
            if (data.to_module_id) setLevelUpData(data)
          },
          onClassComplete: (data) => {
            sessionStore.addXp(data.xp_awarded)
            setShowSummary(true)
          },
          onConnectionStatus: (status) => {
            if (status === 'authenticated') {
              sessionStore.setWsConnected(true)
            }
          },
          onError: (err) => console.error('[SpeakingStage WS]', err),
        })
        ws.connect(res.data.id)
        wsRef.current = ws
      } catch {
        // Session creation failed — UI still renders with disconnected state
      }
    }

    void createSession()

    return () => {
      wsRef.current?.close()
      wsRef.current = null
      stopCapture()
      clearQueue()
      if (sessionId !== null) {
        void api.patch(`/sessions/${sessionId}`, {
          ended_at: new Date().toISOString(),
        }).catch(() => { /* best-effort */ })
        sessionStore.endSession()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId])

  // Auto-scroll transcript to bottom
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
          // Half-duplex: drop frames while AI is speaking
          if (!aiSpeakingRef.current) {
            wsRef.current?.sendAudio(pcm)
          }
        },
        () => { /* VAD silence — no explicit stop needed */ },
      )
      setMicActive(true)
    }
  }

  function handleExit() {
    setShowSummary(true)
  }

  function handleSummaryClose() {
    setShowSummary(false)
    const sid = sessionIdRef.current
    if (sid) {
      onComplete(sid)
    }
  }

  const wsReady = sessionStore.wsConnected

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '60vh', minHeight: 400, background: 'var(--bg-base)' }}>
      <SessionBar
        title={className ?? 'Speaking Session'}
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
            {classDescription && (
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                {classDescription}
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
        <div style={{ width: 120, color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-body)' }}>
          {!wsReady && 'Connecting…'}
          {wsReady && micActive && 'Listening…'}
        </div>
      </div>

      {showSummary && (
        <SessionSummary
          durationSeconds={0}
          xpEarned={sessionStore.xpEarned}
          ctaLabel="View Feedback"
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
  )
}

function TranscriptBubble({ message }: { message: Message }) {
  const isAI = message.role === 'ASSISTANT'
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
  )
}
