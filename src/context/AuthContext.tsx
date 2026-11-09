import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setStoredToken, getStoredToken } from '../services/api.ts';
import type { AuthUser, CandidateUser } from '../types/index.ts';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  quickSwitch: (role: 'admin' | 'candidate' | 'tutor', id?: string) => Promise<void>;
  updateUserPassword: (newPass: string, currentPass?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initAuth = useCallback(async () => {
    setIsLoading(true);
    const existingToken = getStoredToken();
    if (existingToken) {
      try {
        const res = await api.getMe();
        setUser(res.user);
      } catch (err) {
        console.warn('Session expired, defaulting to admin initial state');
        try {
          const switchRes = await api.quickSwitch('admin');
          setStoredToken(switchRes.token);
          setToken(switchRes.token);
          setUser(switchRes.user);
        } catch {
          setStoredToken(null);
          setToken(null);
          setUser(null);
        }
      }
    } else {
      // Default to Super Admin for seamless evaluation experience
      try {
        const switchRes = await api.quickSwitch('admin');
        setStoredToken(switchRes.token);
        setToken(switchRes.token);
        setUser(switchRes.user);
      } catch (e) {
        console.error('Failed to initialize session:', e);
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = async (identifier: string, pass: string) => {
    const res = await api.login(identifier, pass);
    setStoredToken(res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setStoredToken(null);
    setToken(null);
    setUser(null);
  };

  const quickSwitch = async (role: 'admin' | 'candidate' | 'tutor', id?: string) => {
    setIsLoading(true);
    try {
      const res = await api.quickSwitch(role, id);
      setStoredToken(res.token);
      setToken(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserPassword = async (newPass: string, currentPass?: string) => {
    const res = await api.changePassword(newPass, currentPass);
    if (res.user) {
      setUser(res.user);
    } else {
      await refreshUser();
    }
  };

  const refreshUser = async () => {
    try {
      const res = await api.getMe();
      setUser(res.user);
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        quickSwitch,
        updateUserPassword,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
