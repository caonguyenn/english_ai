export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type MessageRole = 'USER' | 'ASSISTANT';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  isStreaming: boolean;
  timestamp: number;
}

export type ServerMessage =
  | { event: { connectionStatus: { status: string; message: string } } }
  | { event: { textOutput: { content: string; role: MessageRole; additionalModelFields?: string } } }
  | { event: { audioOutput: { content: string } } }
  | { event: { contentStart: { role?: MessageRole; type?: string; contentName?: string; promptName?: string } } }
  | { event: { contentEnd: { contentName?: string; promptName?: string } } }
  | { event: { completionStart: Record<string, unknown> } }
  | { event: { completionEnd: Record<string, unknown> } }
  | { event: { toolUse: { toolName: string; toolUseId: string } } }
  | { event: { usageEvent: Record<string, unknown> } };
