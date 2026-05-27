import { create } from 'zustand';
import type { AuthState, StudentProfile } from '../types';

function decodeJwtPayload(token: string): Record<string, unknown> {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64)) as Record<string, unknown>;
}

async function postRefresh(): Promise<{ accessToken: string }> {
  const baseURL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';
  const res = await fetch(`${baseURL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include', // sends HttpOnly refresh-token cookie
  });
  if (!res.ok) throw new Error('Refresh failed');
  return res.json() as Promise<{ accessToken: string }>;
}

// Deferred import of api to break the authStore <-> api circular reference.
// api.ts calls useAuthStore.getState() in its interceptor (side-effect only),
// so importing it here after module initialisation is safe.
async function getProfile(token: string): Promise<StudentProfile> {
  const { api } = await import('../services/api');
  const res = await api.get<StudentProfile>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  profile: null,
  isAdmin: false,
  isLoading: false,

  setAccessToken: (token: string) => {
    const decoded = decodeJwtPayload(token);
    const groups = (decoded['cognito:groups'] as string[] | undefined) ?? [];
    set({ accessToken: token, isAdmin: groups.includes('admin') });
  },

  setProfile: (profile: StudentProfile) => set({ profile }),

  refreshToken: async () => {
    set({ isLoading: true });
    try {
      const { accessToken } = await postRefresh();
      get().setAccessToken(accessToken);
    } catch (err) {
      get().logout();
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    set({ accessToken: null, profile: null, isAdmin: false });
  },

  initialize: async () => {
    set({ isLoading: true });
    try {
      await get().refreshToken();
      const token = get().accessToken;
      if (token) {
        const profile = await getProfile(token);
        set({ profile });
      }
    } catch {
      // Not authenticated — normal on first visit or expired cookie
      set({ accessToken: null, profile: null });
    } finally {
      set({ isLoading: false });
    }
  },
}));

// Selectors
export const selectIsAuthenticated = (state: AuthState): boolean => !!state.accessToken;
export const selectIsAdmin = (state: AuthState): boolean => state.isAdmin;
export const selectPlacementRequired = (state: AuthState): boolean =>
  state.profile?.placement_required ?? false;
