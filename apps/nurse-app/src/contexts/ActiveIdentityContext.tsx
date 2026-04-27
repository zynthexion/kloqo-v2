'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Role, RBACUtils } from '@kloqo/shared';

interface ActiveIdentityContextType {
  activeRole: Role | null;
  switchRole: (newRole: Role) => void;
  availableRoles: Role[];
  isLoading: boolean;
  clinicalProfile: any | null;
  displayName: string;
  displayAvatar: string;
}

const ActiveIdentityContext = createContext<ActiveIdentityContextType | undefined>(undefined);

export function ActiveIdentityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [clinicalProfile, setClinicalProfile] = useState<any | null>(null);
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // 1. Computed available roles (Operational-Only Trio: Nurse, Pharmacist, Receptionist + Doctor)
  const availableRoles = useMemo((): Role[] => {
    if (!user) return [];
    
    const rawRoles = user.roles && user.roles.length > 0 ? user.roles : (user.role ? [user.role] : []);
    const operationalRoles: Role[] = ['doctor', 'nurse', 'pharmacist', 'receptionist', 'clinicAdmin'];
    return rawRoles.filter(r => operationalRoles.includes(r as Role)) as Role[];
  }, [user]);

  // 1.5 Clinical Identity Hydration (Read-Repair triggered via backend)
  useEffect(() => {
    async function hydrateClinicalProfile() {
      if (user?.id && RBACUtils.hasRole(user, 'doctor')) {
        try {
          const token = localStorage.getItem('token');
          // 🚀 This call triggers the "Read-Repair" on the backend if userId mapping is missing
          const res = await fetch(`${API_URL}/api/doctors/${user.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'ngrok-skip-browser-warning': 'true'
            }
          });
          if (res.ok) {
            const data = await res.json();
            setClinicalProfile(data.doctor);
          }
        } catch (error) {
          console.error('[Clinical Context] Failed to hydrate profile:', error);
        }
      } else {
        setClinicalProfile(null);
      }
    }
    hydrateClinicalProfile();
  }, [user?.id, user?.roles, API_URL]);

  // 2. Initialize and Sync from localStorage
  useEffect(() => {
    if (!user || activeRole) return;

    // 🚀 TACTICAL PRIORITY: In the Nurse App, if the user is a doctor, 
    // we ALWAYS prioritize the 'doctor' role over a saved 'clinicAdmin' role 
    // to ensure the clinical profile (name/photo) is correctly hydrated.
    const savedRole = localStorage.getItem('activeRole') as Role;
    
    // Default Fallback Logic
    let defaultRole: Role | null = null;
    
    // Priority: Saved Role > Nurse > Doctor > First Available
    if (savedRole && availableRoles.includes(savedRole)) {
      defaultRole = savedRole;
    } else if (availableRoles.includes('nurse')) {
      defaultRole = 'nurse';
    } else if (availableRoles.includes('doctor')) {
      defaultRole = 'doctor';
    } else if (availableRoles.length > 0) {
      defaultRole = availableRoles[0];
    }

    if (defaultRole) {
      setActiveRole(defaultRole);
      localStorage.setItem('activeRole', defaultRole);
      
      // 🚀 Auto-Correction on first mount if current path is restricted
      // If we land on /dashboard as a receptionist, move home instantly
      if (defaultRole === 'receptionist' && window.location.pathname === '/dashboard') {
        router.replace('/');
      }
    }
  }, [user, activeRole, availableRoles, router]);

  /**
   * Switches identity and triggers "Instant Teleportation"
   */
  const switchRole = (newRole: Role) => {
    if (!user) return;

    if (availableRoles.includes(newRole)) {
      // Synchronous Update Phase
      setActiveRole(newRole);
      localStorage.setItem('activeRole', newRole);
      
      // Instant Teleportation Phase
      const storedDoctorId = localStorage.getItem('selectedDoctorId');
      const doctorParam = storedDoctorId ? `?doctor=${storedDoctorId}` : '';

      if (newRole === 'pharmacist') {
        router.push(`/prescriptions${doctorParam}`);
      } else if (newRole === 'receptionist') {
        router.push(`/${doctorParam}`);
      } else {
        router.push(`/dashboard${doctorParam}`);
      }
    } else {
      console.warn(`[ActiveIdentity] Switch refused: User does not possess role ${newRole}`);
    }
  };

  /**
   * 🏗️ Display Name Resolver (Zero-Trust Override)
   * Prioritizes Clinical Profile Name > Auth User Name
   */
  const displayName = useMemo(() => {
    if (activeRole === 'doctor' && clinicalProfile?.name) {
      return clinicalProfile.name;
    }
    return user?.name || 'User';
  }, [activeRole, clinicalProfile, user]);

  const displayAvatar = useMemo(() => {
    return clinicalProfile?.avatar || user?.avatar || 'https://firebasestorage.googleapis.com/v0/b/kloqo-nurse-dup-43384903-8d386.firebasestorage.app/o/doctor_male.webp?alt=media&token=b19d8fb5-1812-4eb5-a879-d48739eaa87e';
  }, [clinicalProfile, user]);

  const value = {
    activeRole,
    switchRole,
    availableRoles,
    isLoading: !activeRole && !!user,
    clinicalProfile,
    displayName,
    displayAvatar
  };

  return (
    <ActiveIdentityContext.Provider value={value}>
      {children}
    </ActiveIdentityContext.Provider>
  );
}

export function useActiveIdentityInternal() {
  const context = useContext(ActiveIdentityContext);
  if (context === undefined) {
    throw new Error('useActiveIdentity must be used within an ActiveIdentityProvider');
  }
  return context;
}
