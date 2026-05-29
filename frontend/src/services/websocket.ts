/**
 * SessionWebSocket — plain class (not a hook) that manages a single NovaSonic session.
 *
 * Auth: first-message pattern — browser WebSocket API cannot set custom headers.
 * After onopen, sends {"type":"auth","token":"...","session_id":"<uuid>"} before any audio.
 */
import { useAuthStore } from '../store/authStore';

const WS_BASE_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:8080';

export interface LevelUpData {
  from_module: string;
  to_module: string;
  to_module_id: string | null;
  band: number;
}

export interface ClassCompleteData {
  xp_awarded: number;
  class_title: string;
  reason: string;
}

export interface SessionWebSocketConfig {
  sessionType: 'class' | 'playground' | 'placement';
  refId: string | null;
  onAudioOutput: (audioBytes: ArrayBuffer) => void;
  onTextOutput: (text: string, role: string) => void;
  onContentStart: (role: string) => void;
  onContentEnd: () => void;
  onLevelUp: (data: LevelUpData) => void;
  onClassComplete?: (data: ClassCompleteData) => void;
  onConnectionStatus: (status: string) => void;
  onError: (error: string) => void;
  /** Called with true when AI audio starts, false when it fully ends (completionEnd). */
  onAiSpeakingChange?: (speaking: boolean) => void;
}

export class SessionWebSocket {
  private ws: WebSocket | null = null;
  private readonly config: SessionWebSocketConfig;
  // NovaSonic sends text twice per ASSISTANT turn: SPECULATIVE then FINAL.
  // Track contentStart metadata so we only forward the speculative pass to the UI.
  private currentRole: string = '';
  private isSpeculative: boolean = false;

  constructor(config: SessionWebSocketConfig) {
    this.config = config;
  }

  connect(sessionId: string): void {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      this.config.onError('Not authenticated');
      return;
    }

    const params = new URLSearchParams({ type: this.config.sessionType });
    if (this.config.refId !== null) {
      params.set('ref_id', this.config.refId);
    }

    const url = `${WS_BASE_URL}/ws/session?${params.toString()}`;
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      // First-message auth — must happen before any audio frames
      this.ws!.send(
        JSON.stringify({ type: 'auth', token, session_id: sessionId }),
      );
    };

    this.ws.onmessage = (event: MessageEvent) => this.handleMessage(event);

    this.ws.onerror = () => {
      this.config.onError('WebSocket connection error');
    };

    this.ws.onclose = () => {
      this.ws = null;
    };
  }

  sendAudio(pcmData: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(pcmData);
    }
  }

  close(): void {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send('close');
        } catch {
          // ignore send errors on close
        }
      }
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private handleMessage(event: MessageEvent): void {
    // Binary frame — raw PCM audio from Bedrock (if server sends binary)
    if (event.data instanceof ArrayBuffer) {
      this.config.onAudioOutput(event.data);
      return;
    }

    let data: { event?: Record<string, unknown> };
    try {
      data = JSON.parse(event.data as string) as typeof data;
    } catch {
      return; // ignore malformed frames
    }

    const evt = data.event;
    if (!evt) return;

    if (evt['connectionStatus']) {
      const cs = evt['connectionStatus'] as { status: string };
      this.config.onConnectionStatus(cs.status);
    } else if (evt['contentStart']) {
      const cs = evt['contentStart'] as { role?: string; type?: string; additionalModelFields?: string };
      this.currentRole = cs.role ?? '';
      // Detect SPECULATIVE generation stage — only that pass contains the display text
      try {
        const extra = cs.additionalModelFields ? JSON.parse(cs.additionalModelFields) as Record<string, unknown> : {};
        this.isSpeculative = extra['generationStage'] === 'SPECULATIVE';
      } catch {
        this.isSpeculative = false;
      }
      // Open a new transcript bubble for TEXT content on the SPECULATIVE pass (ASSISTANT) or USER turn
      if (cs.type === 'TEXT' && (this.currentRole === 'USER' || this.isSpeculative)) {
        this.config.onContentStart(this.currentRole);
      }
    } else if (evt['contentEnd']) {
      // Close the current bubble
      this.config.onContentEnd();
    } else if (evt['audioOutput']) {
      // AI audio arrived — signal half-duplex gate
      this.config.onAiSpeakingChange?.(true);
      const ao = evt['audioOutput'] as { content: string };
      try {
        const binary = atob(ao.content);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        this.config.onAudioOutput(bytes.buffer as ArrayBuffer);
      } catch {
        // ignore malformed audio frames
      }
    } else if (evt['completionEnd']) {
      // AI turn fully finished — release half-duplex gate
      this.config.onAiSpeakingChange?.(false);
    } else if (evt['textOutput']) {
      const to = evt['textOutput'] as { content: string; role: string };
      // Skip interrupted barge-in markers
      if (to.content.includes('"interrupted"')) return;
      // ASSISTANT text: only forward the SPECULATIVE pass; ignore FINAL (raw transcript duplicate)
      // USER text: always forward
      if (this.currentRole === 'ASSISTANT' && !this.isSpeculative) return;
      this.config.onTextOutput(to.content, to.role ?? this.currentRole);
    } else if (evt['levelUp']) {
      const lu = evt['levelUp'] as LevelUpData;
      this.config.onLevelUp(lu);
    } else if (evt['classComplete']) {
      const cc = evt['classComplete'] as ClassCompleteData;
      this.config.onClassComplete?.(cc);
    }
    // contentStart / contentEnd / completionStart / completionEnd / toolUse / usageEvent
    // are handled server-side; no frontend action needed for MVP
  }
}
