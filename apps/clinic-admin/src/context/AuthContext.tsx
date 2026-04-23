"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { User, RBACUtils, Role } from '@kloqo/shared';
import { apiRequest } from '@/lib/api-client';

interface AuthContextType {
  currentUser: User | null;
  activeRole: Role | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  activeRole: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  updateProfile: async () => {},
  changePassword: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Active Identity Override: In this app, we ONLY care about the Admin identity.
  // We force the active role to 'clinicAdmin' if they have it, even if they are also a 'doctor'.
  const activeRole = useMemo(() => {
    if (!currentUser) return null;
    
    // Priority check for this specific app
    if (RBACUtils.hasAnyRole(currentUser, ['superAdmin'])) return 'superAdmin';
    if (RBACUtils.hasAnyRole(currentUser, ['clinicAdmin'])) return 'clinicAdmin';
    
    // Fallback to whatever they have (though layout.tsx should block them)
    return (currentUser.roles?.[0] as Role) || (currentUser.role as Role) || null;
  }, [currentUser]);

  const fetchUser = useCallback(async () => {
    // 1. Ghost Mode Check: Look for token in URL (passed from SuperAdmin)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    
    if (urlToken) {
      console.log('[GOD MODE] Detected impersonation token in URL. Ingesting...');
      localStorage.setItem('kloqo_token', urlToken);
      // Clean up URL without refreshing
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }

    const token = localStorage.getItem('kloqo_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const { user } = await apiRequest<{ user: User }>('/auth/me');
      setCurrentUser(user);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('kloqo_token');
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { user, token } = await apiRequest<{ user: User; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem('kloqo_token', token);
      setCurrentUser(user);
      router.push('/');
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
    }
  }, [router]);

  const logout = useCallback(() => {
    // 🧹 Comprehensive Session Cleanup
    const keysToRemove = [
      'kloqo_token', 
      'activeRole', 
      'app-theme',
      'last_daily_reminder_run_morning',
      'last_daily_reminder_run_evening',
      'last_daily_reminder_run_expiry'
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));

    setCurrentUser(null);
    router.push('/login');
  }, [router]);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    try {
      await apiRequest('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      setCurrentUser(prev => prev ? { ...prev, ...data } : null);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update profile');
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to change password');
    }
  }, []);

  const contextValue = useMemo(() => ({
    currentUser,
    activeRole,
    loading,
    login,
    logout,
    updateProfile,
    changePassword
  }), [currentUser, activeRole, loading, login, logout, updateProfile, changePassword]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
