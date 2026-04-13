'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, RBACUtils, Role } from '@kloqo/shared';
import { registerFCMToken } from '@/lib/register-fcm-token';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  logout: () => Promise<void>;
  syncSession: (token: string, user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('token');
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ email, password: pass })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Login failed');
    }

    const result = await res.json();
    
    // Check if user is required to reset password
    if (result.status === 'requires_reset') {
       return result; // contains { status, email, resetToken }
    }

    const { token, user: userData } = result;
    
    if (!userData) {
      throw new Error('Invalid authentication response from server.');
    }

    // Check if user is allowed in the nurse app
    const allowedRoles = ['nurse', 'doctor', 'receptionist', 'pharmacist', 'clinicAdmin', 'superAdmin'];
    if (!RBACUtils.hasAnyRole(userData, allowedRoles as Role[])) {
      throw new Error('Access denied. Clinical or pharmacy staff access required.');
    }

    localStorage.setItem('token', token);
    setUser(userData);

    // Register FCM push token with backend — fire-and-forget, non-critical
    registerFCMToken(token);

    // 1. Clinical Priority (Nurse / Doctor / Admin)
    if (RBACUtils.hasAnyRole(userData, ['nurse', 'doctor', 'clinicAdmin', 'superAdmin'])) {
      router.push('/dashboard');
    } 
    // 2. Receptionist Landing (Bypasses queue to Home/Booking)
    else if (RBACUtils.hasRole(userData, 'receptionist')) {
      router.push('/');
    } 
    // 3. Pharmacy Fallback
    else if (RBACUtils.hasRole(userData, 'pharmacist')) {
      router.push('/prescriptions');
    } 
    else {
      router.push('/dashboard');
    }
  };

  const logout = async () => {
    localStorage.removeItem('token');
    setUser(null);
    router.push('/login');
  };

  const syncSession = (token: string, userData: User) => {
    localStorage.setItem('token', token);
    setUser(userData);
    if (userData.id) registerFCMToken(userData.id);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, syncSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
