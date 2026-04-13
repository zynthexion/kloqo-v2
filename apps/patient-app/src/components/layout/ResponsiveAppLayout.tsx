'use client';

import React, { useState, useEffect } from 'react';
import { DesktopBlocker } from './DesktopBlocker';

import { useAuth } from '@/contexts/AuthContext';
import { useNurseDashboardContext } from '@/contexts/NurseDashboardContext';
import { PremiumUpgradeModal } from './PremiumUpgradeModal';

interface ResponsiveAppLayoutProps {
  mobile: React.ReactNode;
  tablet: React.ReactNode;
}

export function ResponsiveAppLayout({ mobile, tablet }: ResponsiveAppLayoutProps) {
  const [viewMode, setViewMode] = useState<'mobile' | 'tablet' | 'desktop' | null>(null);
  const { user } = useAuth();
  const { data } = useNurseDashboardContext();
  const [forceMobile, setForceMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      
      if (width < 768) {
        setViewMode('mobile');
      } else if (width < 1440) { // Tablet range: 768px to 1439px
        setViewMode('tablet');
      } else { // Desktop: 1440px and above
        setViewMode('desktop');
      }
    };

    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (viewMode === null) return <div className="min-h-screen bg-background" />;

  if (viewMode === 'desktop') {
    return <DesktopBlocker />;
  }

  if (viewMode === 'tablet' && !forceMobile) {
    // 1. Gating Logic
    // Nurses (and other staff like receptionists) are strictly limited to Mobile UI even on tablets
    if (user?.role !== 'doctor' && user?.role !== 'clinicAdmin' && user?.role !== 'superAdmin') {
      return <>{mobile}</>;
    }

    // 2. Pricing Tier Gating
    // Premium Tablet UI requires the ₹1,999 plan. 
    // ₹999 plan is mobile-only.
    if (user?.role === 'doctor' && data?.clinic?.plan === '999') {
      return <PremiumUpgradeModal onSwitchToMobile={() => setForceMobile(true)} />;
    }

    return <>{tablet}</>;
  }

  return <>{mobile}</>;
}
