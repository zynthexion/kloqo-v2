'use client';

import React, { useEffect, useState } from 'react';
import { NurseSidebar } from './NurseSidebar';
import { cn } from '@/lib/utils';

interface NurseDesktopShellProps {
  children: React.ReactNode;
  className?: string;
}

export function NurseDesktopShell({ children, className }: NurseDesktopShellProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Prevent hydration mismatch: render nothing structural until mounted
  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex">
      {/* 
        The sidebar is fixed. We need a spacer or padding on the main content.
        lg:flex ensures it only mounts/shows on large screens via CSS first logic
      */}
      <div className="hidden lg:block w-24 group-hover/sidebar:w-28 transition-all duration-500 shrink-0" />
      
      <NurseSidebar />

      <main className={cn(
        "flex-1 flex flex-col min-h-0 relative",
        className
      )}>
        {children}
      </main>
    </div>
  );
}
