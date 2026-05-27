import { create } from 'zustand';
import type { SessionState } from '../types';

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  sessionType: null,
  refId: null,
  isActive: false,
  startedAt: null,
  xpEarned: 0,
  wsConnected: false,

  setSession: (id: number, type: string, refId: number | null) =>
    set({
      sessionId: id,
      sessionType: type as SessionState['sessionType'],
      refId,
      isActive: true,
      startedAt: new Date().toISOString(),
      xpEarned: 0,
      wsConnected: false,
    }),

  endSession: () => set({ isActive: false, wsConnected: false }),

  addXp: (amount: number) =>
    set((state) => ({ xpEarned: state.xpEarned + amount })),

  setWsConnected: (connected: boolean) => set({ wsConnected: connected }),
}));
