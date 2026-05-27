import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import type { StudentProfile } from '../types';

const USER_POOL_ID = (import.meta.env.VITE_COGNITO_USER_POOL_ID as string | undefined) ?? '';
const CLIENT_ID = (import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined) ?? '';

// Custom in-memory storage — prevents Cognito SDK from touching localStorage
class MemoryStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null { return this.store[key] ?? null; }
  setItem(key: string, value: string): void { this.store[key] = value; }
  removeItem(key: string): void { delete this.store[key]; }
  clear(): void { this.store = {}; }
}

const memoryStorage = new MemoryStorage();

const userPool = new CognitoUserPool({
  UserPoolId: USER_POOL_ID,
  ClientId: CLIENT_ID,
  Storage: memoryStorage,
});

export function useAuth() {
  const { setAccessToken, setProfile, logout } = useAuthStore();

  const signUp = (email: string, password: string, name: string): Promise<void> =>
    new Promise((resolve, reject) => {
      const attributes = [
        new CognitoUserAttribute({ Name: 'email', Value: email }),
        new CognitoUserAttribute({ Name: 'name', Value: name }),
      ];
      userPool.signUp(email, password, attributes, [], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

  const confirmSignUp = (email: string, code: string): Promise<void> =>
    new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
        Storage: memoryStorage,
      });
      cognitoUser.confirmRegistration(code, true, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

  const signIn = (email: string, password: string): Promise<void> =>
    new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
        Storage: memoryStorage,
      });
      const authDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: async (session) => {
          try {
            const accessToken = session.getAccessToken().getJwtToken();
            setAccessToken(accessToken);

            // Register/upsert student row (idempotent — backend handles duplicates)
            await api.post('/auth/register');

            const { data } = await api.get<StudentProfile>('/auth/me');
            setProfile(data);

            resolve();
          } catch (err) {
            reject(err);
          }
        },
        onFailure: (err) => reject(err),
      });
    });

  const signOut = (): void => {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.globalSignOut({
        onSuccess: () => { /* noop */ },
        onFailure: () => { /* noop — logout regardless */ },
      });
    }
    logout();
  };

  return { signUp, confirmSignUp, signIn, signOut };
}
