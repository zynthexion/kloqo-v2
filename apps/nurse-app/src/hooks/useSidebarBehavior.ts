'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Role } from '@kloqo/shared';

/**
 * ─── ROLE-BASED SIDEBAR BEHAVIOR CONFIG ──────────────────────────────────
 * Centralized configuration for sidebar visibility and interaction rules.
 * This aligns with Rule 16 (Dumb Frontend) by extracting UI logic from 
 * the component.
 */
const ROLE_CONFIGS: Record<string, { hide: boolean; autoCollapse: boolean }> = {
  pharmacist: { hide: true, autoCollapse: false },
  nurse: { hide: false, autoCollapse: false },
  doctor: { hide: false, autoCollapse: true },
  receptionist: { hide: false, autoCollapse: true },
  clinicAdmin: { hide: false, autoCollapse: true },
};

export function useSidebarBehavior(activeRole: Role | null) {
  const pathname = usePathname();
  
  const config = ROLE_CONFIGS[activeRole || ''] || { hide: false, autoCollapse: true };
  const isDashboard = pathname.startsWith('/dashboard');

  // Interactive state
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (isDashboard && config.autoCollapse) return false;
    return true;
  });

  // ─── SYNCHRONIZATION ───
  // Automatically adjust sidebar state based on route and role config
  useEffect(() => {
    if (isDashboard && config.autoCollapse) {
      setIsSidebarOpen(false);
    } else {
      setIsSidebarOpen(true);
    }
  }, [isDashboard, config.autoCollapse]);

  return {
    isSidebarOpen,
    setIsSidebarOpen,
    hideSidebar: config.hide,
    isDashboard
  };
}
