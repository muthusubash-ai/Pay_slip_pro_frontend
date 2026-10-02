import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import api, { initializeCsrf } from '../services/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, fullName: string, phone?: string) => Promise<User>;
  googleLogin: () => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  refetchUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialized = useRef(false);

  const refetchUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
      return res.data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    initializeCsrf()
      .then(() => api.get('/auth/me'))
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  // Sync user state on window focus (e.g. when admin changes plan in another tab)
  useEffect(() => {
    const handleFocus = () => {
      refetchUser();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchUser]);

  // Periodic background sync every 10 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      refetchUser();
    }, 10000);
    return () => clearInterval(interval);
  }, [user, refetchUser]);

  const login = useCallback(async (email: string, password: string) => {
    const form = new FormData();
    form.append('username', email);
    form.append('password', password);
    await api.post('/auth/login', form);

    // Fetch user profile with fresh token
    const userRes = await api.get('/auth/me');
    setUser(userRes.data);
    return userRes.data;
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string, phone?: string) => {
    await api.post('/auth/register', { email, password, full_name: fullName, phone });
    return login(email, password);
  }, [login]);

  const googleLogin = useCallback(async () => {
    await initializeCsrf();
    const userRes = await api.get('/auth/me');
    setUser(userRes.data);
    return userRes.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {});
    } finally {
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, googleLogin, logout, updateUser, refetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// The provider and its colocated hook intentionally share the same module.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
