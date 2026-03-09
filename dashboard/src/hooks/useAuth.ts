import { useCallback, useSyncExternalStore } from 'react';
import { AUTH_KEY } from '../lib/constants';

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getSnapshot() {
  return localStorage.getItem(AUTH_KEY);
}

export function useAuth() {
  const apiKey = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const login = useCallback((key: string) => {
    localStorage.setItem(AUTH_KEY, key);
    window.dispatchEvent(new Event('storage'));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    window.dispatchEvent(new Event('storage'));
    window.location.href = '/login';
  }, []);

  return {
    apiKey,
    isAuthenticated: !!apiKey,
    login,
    logout,
  };
}
