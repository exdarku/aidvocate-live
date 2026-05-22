import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import toast from 'react-hot-toast';
import {
  authApi,
  getToken,
  getStoredUser,
  setStoredUser,
  type User,
} from '@/services/api';

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload extends Partial<User> {
  email: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginPayload) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const fresh = await authApi.me();
      setUser(fresh);
      setStoredUser(fresh);
    } catch {
      authApi.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async ({ email, password }: LoginPayload) => {
    setIsLoading(true);
    try {
      const res = await authApi.login(email, password);
      setUser(res.user);
      toast.success('Welcome back!');
      navigate({ to: '/dashboard' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      toast.error(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterPayload) => {
    setIsLoading(true);
    try {
      const res = await authApi.register(data);
      setUser(res.user);
      toast.success('Account created!');
      navigate({ to: '/dashboard' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      toast.error(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    authApi.logout();
    setUser(null);
    toast.success('Logged out');
    navigate({ to: '/' });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: '/login' });
    }
  }, [isLoading, isAuthenticated, navigate]);
  return { isAuthenticated, isLoading };
}
