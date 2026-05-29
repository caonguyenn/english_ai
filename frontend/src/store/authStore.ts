import { create } from 'zustand';
import type { AuthState, StudentProfile } from '../types';

function decodeJwtPayload(token: string): Record<string, unknown> {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64)) as Record<string, unknown>;
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

  logout: () => {
    set({ accessToken: null, profile: null, isAdmin: false });
  },

  initialize: async () => {
    // Tokens are in-memory only — nothing to restore on page load.
    // If a token is already set (e.g., dev-login called before navigate), refresh profile.
    const token = get().accessToken;
    if (!token) return;
    set({ isLoading: true });
    try {
      const profile = await getProfile(token);
      set({ profile });
    } catch {
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
