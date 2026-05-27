/**
 * SessionWebSocket — plain class (not a hook) that manages a single NovaSonic session.
 *
 * Auth: first-message pattern — browser WebSocket API cannot set custom headers.
 * After onopen, sends {"type":"auth","token":"...","session_id":N} before any audio.
 */
import { useAuthStore } from '../store/authStore';

const WS_BASE_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:8080';

export interface LevelUpData {
  from_module: string;
  to_module: string;
  to_module_id: number;
  band: number;
}

export interface SessionWebSocketConfig {
  sessionType: 'class' | 'playground' | 'placement';
  refId: number | null;
  onAudioOutput: (audioBytes: ArrayBuffer) => void;
  onTextOutput: (text: string, role: string) => void;
  onLevelUp: (data: LevelUpData) => void;
  onConnectionStatus: (status: string) => void;
  onError: (error: string) => void;
}

export class SessionWebSocket {
  private ws: WebSocket | null = null;
  private readonly config: SessionWebSocketConfig;

  constructor(config: SessionWebSocketConfig) {
    this.config = config;
  }

  connect(sessionId: number): void {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      this.config.onError('Not authenticated');
      return;
    }

    const params = new URLSearchParams({ type: this.config.sessionType });
    if (this.config.refId !== null) {
      params.set('ref_id', String(this.config.refId));
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
    } else if (evt['audioOutput']) {
      const ao = evt['audioOutput'] as { content: string };
      // Base64-encoded PCM — decode to ArrayBuffer
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
    } else if (evt['textOutput']) {
      const to = evt['textOutput'] as { content: string; role: string };
      this.config.onTextOutput(to.content, to.role);
    } else if (evt['levelUp']) {
      const lu = evt['levelUp'] as LevelUpData;
      this.config.onLevelUp(lu);
    }
    // contentStart / contentEnd / completionStart / completionEnd / toolUse / usageEvent
    // are handled server-side; no frontend action needed for MVP
  }
}
