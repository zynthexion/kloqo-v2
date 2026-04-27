'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface NurseDesktopShellProps {
  children: React.ReactNode;
  className?: string;
}

import AppFrameLayout from './AppFrameLayout';

export function NurseDesktopShell({ children, className }: NurseDesktopShellProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Prevent hydration mismatch: render nothing structural until mounted
  if (!isMounted) return null;

  return (
    <AppFrameLayout className={cn("bg-[#F0F4F8]", className)}>
      <div className="flex-1 flex flex-col min-h-0 relative">
        {children}
      </div>
    </AppFrameLayout>
  );
}
