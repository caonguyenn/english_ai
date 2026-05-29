export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ── Auth & Domain Types ───────────────────────────────────────────────────────

export interface StudentProfile {
  id: string;
  cognito_sub: string;
  name: string | null;
  email: string;
  current_module_id: string | null;
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
  logout: () => void;
  initialize: () => Promise<void>;
}

export interface SessionState {
  sessionId: string | null;
  sessionType: 'class' | 'playground' | 'placement' | null;
  refId: string | null;
  isActive: boolean;
  startedAt: string | null;
  xpEarned: number;
  wsConnected: boolean;
  setSession: (id: string, type: string, refId: string | null) => void;
  endSession: () => void;
  addXp: (amount: number) => void;
  setWsConnected: (connected: boolean) => void;
}

export interface ModuleResponse {
  id: string;
  band_min: number;
  band_max: number;
  title: string;
  description: string;
  xp_threshold: number;
  order_index: number;
}

export interface ModuleWithProgress extends ModuleResponse {
  xp_earned: number;
  enrolled: boolean;
}

export interface ClassResponse {
  id: string;
  module_id: string;
  title: string;
  skill_type: string;
  description: string;
  xp_reward: number;
  order_index: number;
  completed: boolean;
}

export interface SessionResponse {
  id: string;
  student_id: string;
  class_id: string | null;
  topic_id: string | null;
  session_type: string;
  started_at: string;
  ended_at: string | null;
  xp_awarded: number | null;
}

export interface PlaygroundTopic {
  id: string;
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
  to_module_id: string | null;
  band: number;
}

// ── Feedback + Memory (Phase 2) ──────────────────────────────────────────────
export interface GrammarMistake {
  original: string;
  corrected: string;
  reason: string;
  category?: string;
  severity?: string;
}

export interface VocabItem {
  word: string;
  frequency?: number;
}

export interface FluencyMetrics {
  wpm?: number;
  avg_response_length_words?: number;
  filler_count?: number;
}

export interface BandEstimate {
  fluency?: number;
  grammar?: number;
  vocabulary?: number;
  overall?: number;
}

export interface AnalysisResult {
  session_id: string;
  status: 'ready' | 'pending';
  grammar_mistakes: GrammarMistake[];
  vocab_usage: VocabItem[];
  fluency_metrics: FluencyMetrics;
  band_estimate: BandEstimate;
  created_at?: string;
}

export interface LearningProfile {
  student_id: string;
  status: 'ready' | 'pending';
  overall_band?: number;
  fluency_band?: number;
  grammar_band?: number;
  vocabulary_band?: number;
  strengths: string[];
  weaknesses: string[];
  sessions_analyzed: number;
  updated_at?: string;
}

export interface Memory {
  id: string;
  memory_type: string;
  memory_value: string;
  confidence_score: number;
  updated_at: string;
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

// ── Gamification (Phase 3) ────────────────────────────────────────────────────
export interface Streak {
  student_id: string
  current_len: number
  longest_len: number
  last_active_date: string | null
}

export interface Achievement {
  id: string
  slug: string
  title: string
  description?: string
  criteria_json?: Record<string, unknown>
  earned: boolean
  earned_at?: string
}

// ── Adaptive Grammar (Phase 4) ────────────────────────────────────────────────
export interface GrammarWeakness {
  id: string
  student_id: string
  category: string
  frequency: number
  severity: number
  times_seen: number
  updated_at: string
}

export interface GrammarExercise {
  id: string
  student_id: string
  category: string
  prompt: string
  options: Record<string, string>
  answered_correctly?: boolean | null
  created_at: string
}

export interface GrammarAnswerResult {
  correct: boolean
  correct_option: string
  explanation: string
  xp_awarded: number
}

// ── Adaptive Vocab (Phase 5) ──────────────────────────────────────────────────
export interface VocabularyWord {
  id: string
  student_id: string
  word: string
  usage_count: number
  mastery_score: number
  first_seen_at: string
  last_used_at: string
}

export interface WordUnlock {
  id: string
  student_id: string
  session_id: string
  word: string
  introduced_at: string
  used_at: string | null
  xp_awarded: number
}

// ── Mock Test (Phase 7) ───────────────────────────────────────────────────────
export interface MockTestResult {
  session_id: string
  status: 'ready' | 'pending'
  band_overall?: number | null
  fluency_coherence?: number | null
  lexical_resource?: number | null
  grammatical_range_accuracy?: number | null
  pronunciation: null
  parts_completed?: Record<string, boolean> | null
  cue_card_topic?: string | null
  premium: boolean
}

export interface CueCardEvent {
  topic: string
  bullets: string[]
}

// ── 4-Stage Lessons (Phase 6) ─────────────────────────────────────────────────
export interface VocabStageWord {
  word: string
  meaning: string
}

export interface GrammarFocus {
  category: string
  note?: string
}

export interface LessonStages {
  vocab: VocabStageWord[]
  grammar_focus?: GrammarFocus
}
