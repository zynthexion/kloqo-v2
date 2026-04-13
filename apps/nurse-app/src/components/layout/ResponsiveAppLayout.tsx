import React, { useState, useEffect, useMemo } from 'react';
import { DeviceRestrictionBlocker } from './DeviceRestrictionBlocker';

import { useAuth } from '@/contexts/AuthContext';
import { useNurseDashboardContext } from '@/contexts/NurseDashboardContext';
import { PremiumUpgradeModal } from './PremiumUpgradeModal';
import { RBACUtils, Role } from '@kloqo/shared';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';

interface ResponsiveAppLayoutProps {
  mobile: React.ReactNode;
  tablet: React.ReactNode;
}

export function ResponsiveAppLayout({ mobile, tablet }: ResponsiveAppLayoutProps) {
  const { user } = useAuth();
  const { data } = useNurseDashboardContext();
  const { activeRole: switchedRole, availableRoles, switchRole } = useActiveIdentity();
  const [windowWidth, setWindowWidth] = useState<number>(0);
  const [isMounted, setIsMounted] = useState(false);
  const [forceMobile, setForceMobile] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setWindowWidth(window.innerWidth);

    // 🚀 Debounced Resize Handler (150ms)
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWindowWidth(window.innerWidth);
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  const activeRole = useMemo(() => switchedRole || user?.role || 'nurse', [switchedRole, user]);

  // 🛡️ Hardware-Bound RBAC Evaluator
  const isAllowed = useMemo(() => {
    if (!isMounted) return true; // SSR Safety: Default to allowed during hydration
    return RBACUtils.isViewportAllowed(activeRole, windowWidth);
  }, [activeRole, windowWidth, isMounted]);

  if (!isMounted) return <div className="min-h-screen bg-background" />;

  // 🚨 Enforcement UI with Escape Hatch
  if (!isAllowed) {
    return (
      <DeviceRestrictionBlocker 
        activeRole={activeRole as Role} 
        currentWidth={windowWidth} 
        availableRoles={availableRoles}
        onSwitchRole={switchRole}
      />
    );
  }

  // Viewport categorization for layout selection
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const isDesktop = windowWidth >= 1024;

  if ((isTablet || isDesktop) && !forceMobile) {
    // 1. Gating Logic
    // Even if viewport is allowed, we check for specific clinical UI permissions
    if (!RBACUtils.hasAnyRole(user, ['doctor', 'clinicAdmin', 'superAdmin'])) {
      return <>{mobile}</>;
    }

    // 2. Pricing Tier Gating
    if (RBACUtils.hasRole(user, 'doctor') && data?.clinic?.plan === '999') {
      return <PremiumUpgradeModal onSwitchToMobile={() => setForceMobile(true)} />;
    }

    return <>{tablet}</>;
  }

  return <>{mobile}</>;
}
