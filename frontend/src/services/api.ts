import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = `${(import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'}/api/v1`;

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach Bearer token ──────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: redirect to login on 401 ───────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const axiosError = error as { response?: { status: number } };
    if (axiosError.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  },
);

// ── Feedback + Memory (Phase 2) ──────────────────────────────────────────────
export const getSessionAnalysis = (sessionId: string) =>
  api.get(`/sessions/${sessionId}/analysis`).then(r => r.data);

export const getStudentProfile = (studentId: string) =>
  api.get(`/students/${studentId}/profile`).then(r => r.data);

export const getStudentMemories = (studentId: string) =>
  api.get(`/students/${studentId}/memories`).then(r => r.data);

// ── Gamification (Phase 3) ────────────────────────────────────────────────────
export const getStreak = (studentId: string) =>
  api.get(`/students/${studentId}/streak`).then(r => r.data)

export const getAchievements = (studentId: string) =>
  api.get(`/students/${studentId}/achievements`).then(r => r.data)

// ── Adaptive Grammar (Phase 4) ────────────────────────────────────────────────
export const getGrammarWeaknesses = (studentId: string) =>
  api.get(`/students/${studentId}/grammar-weaknesses`).then(r => r.data)

export const generateGrammarExercise = (studentId: string) =>
  api.post(`/students/${studentId}/grammar-exercises`).then(r => r.data)

export const answerGrammarExercise = (exerciseId: string, selected: string) =>
  api.post(`/grammar-exercises/${exerciseId}/answer`, { selected }).then(r => r.data)

// ── Adaptive Vocab (Phase 5) ──────────────────────────────────────────────────
export const getVocabulary = (studentId: string) =>
  api.get(`/students/${studentId}/vocabulary`).then(r => r.data)

export const getWordUnlocks = (studentId: string) =>
  api.get(`/students/${studentId}/word-unlocks`).then(r => r.data)

// ── Mock Test (Phase 7) ───────────────────────────────────────────────────────
export const getMockTestResult = (sessionId: string) =>
  api.get(`/sessions/${sessionId}/mock-result`).then(r => r.data)

export const createMockTestSession = () =>
  api.post('/sessions', { session_type: 'mock_test' }).then(r => r.data)

// ── 4-Stage Lessons (Phase 6) ─────────────────────────────────────────────────
export const getClassStages = (classId: string) =>
  api.get(`/classes/${classId}/stages`).then(r => r.data)

export const patchSessionStage = (sessionId: string, stage: number) =>
  api.patch(`/sessions/${sessionId}/stage`, { stage }).then(r => r.data)
