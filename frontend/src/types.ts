export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ── Auth & Domain Types ───────────────────────────────────────────────────────

export interface StudentProfile {
  id: number;
  cognito_sub: string;
  name: string | null;
  email: string;
  current_module_id: number | null;
  placement_band: number | null;
  xp_total: number;
  placement_completed_at: string | null;
  placement_required: boolean;
}

export interface AuthState {
  accessToken: string | null;
  profile: StudentProfile | null;
  isAdmin: boolean;
  isLoading: boolean;
  setAccessToken: (token: string) => void;
  setProfile: (profile: StudentProfile) => void;
  refreshToken: () => Promise<void>;
  logout: () => void;
  initialize: () => Promise<void>;
}

export interface SessionState {
  sessionId: number | null;
  sessionType: 'class' | 'playground' | 'placement' | null;
  refId: number | null;
  isActive: boolean;
  startedAt: string | null;
  xpEarned: number;
  wsConnected: boolean;
  setSession: (id: number, type: string, refId: number | null) => void;
  endSession: () => void;
  addXp: (amount: number) => void;
  setWsConnected: (connected: boolean) => void;
}

export interface ModuleResponse {
  id: number;
  band_min: number;
  band_max: number;
  title: string;
  description: string;
  xp_threshold: number;
  order_index: number;
}

export interface ClassResponse {
  id: number;
  module_id: number;
  title: string;
  skill_type: string;
  description: string;
  xp_reward: number;
  order_index: number;
  completed: boolean;
}

export interface SessionResponse {
  id: number;
  student_id: number;
  class_id: number | null;
  topic_id: number | null;
  session_type: string;
  started_at: string;
  ended_at: string | null;
  xp_awarded: number | null;
}

export interface PlaygroundTopic {
  id: number;
  slug: string;
  title: string;
  description: string;
  difficulty_band: number;
}

export type MessageRole = 'USER' | 'ASSISTANT';

export type AppPhase = 'idle' | 'listening' | 'thinking' | 'speaking';

export type TopicId = 'daily' | 'interview' | 'devops' | 'travel' | 'ielts' | 'small-talk' | 'business';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  isStreaming: boolean;
  timestamp: number;
}

export interface LevelUpEvent {
  from_module: string;
  to_module: string;
  to_module_id: number;
  band: number;
}

export type ServerMessage =
  | { event: { connectionStatus: { status: string; message: string } } }
  | { event: { textOutput: { content: string; role: MessageRole; additionalModelFields?: string } } }
  | { event: { audioOutput: { content: string } } }
  | { event: { contentStart: { role?: MessageRole; type?: 'TEXT' | 'AUDIO' | 'TOOL'; contentName?: string; promptName?: string; additionalModelFields?: string } } }
  | { event: { contentEnd: { contentName?: string; promptName?: string } } }
  | { event: { completionStart: Record<string, unknown> } }
  | { event: { completionEnd: Record<string, unknown> } }
  | { event: { toolUse: { toolName: string; toolUseId: string } } }
  | { event: { usageEvent: Record<string, unknown> } }
  | { event: { levelUp: LevelUpEvent } };
