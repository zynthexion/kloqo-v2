'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@kloqo/shared';

interface AuthContextType {
  user: User | null;
  userRole: string | null;
  loading: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<{ status: string; email?: string; resetToken?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setUserRole(data.user.role || null);
        } else {
          localStorage.removeItem('auth_token');
          setUser(null);
          setUserRole(null);
        }
      } catch (error) {
        console.error('Auth verification failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Handle Password Reset redirection status
      if (data.status === 'requires_reset') {
        return data; // Return to component for redirection
      }

      const userRole = String(data.user?.role || '').trim();
      const validRoles = ['superadmin', 'super-admin', 'superAdmin'];
      
      if (!validRoles.includes(userRole)) {
        throw new Error('Access denied. SuperAdmin access required.');
      }

      localStorage.setItem('auth_token', data.token); // Backend now returns 'token'
      setUser(data.user);
      setUserRole(userRole);
      
      console.log('Login completed successfully');
      return data;
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setUserRole(null);
  };

  const isSuperAdmin = userRole === 'superAdmin' || userRole === 'super-admin' || userRole === 'superadmin';

  return (
    <AuthContext.Provider value={{ user, userRole, loading, isSuperAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

