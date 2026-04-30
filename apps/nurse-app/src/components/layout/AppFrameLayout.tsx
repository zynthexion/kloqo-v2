'use client';

import BottomNav from '@/components/clinic/BottomNav';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

type AppFrameLayoutProps = {
  children: React.ReactNode;
  className?: string;
  showBottomNav?: boolean;
  isFullScreen?: boolean;
};

import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';

export default function AppFrameLayout({ children, className, showBottomNav = false, isFullScreen = false }: AppFrameLayoutProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const isModern = theme === 'modern' && !isFullScreen;

  return (
    <div className="flex min-h-screen bg-white group/sidebar overflow-x-hidden max-w-full">
      {/* Sidebar for Desktop */}
      {!isFullScreen && <Sidebar />}

      <main className={cn(
        "flex-1 flex flex-col items-center justify-start min-h-screen transition-all duration-500 overflow-x-hidden max-w-full",
        !isFullScreen && "md:pl-24 group-hover/sidebar:md:pl-28",
        isModern && "bg-transparent backdrop-blur-sm",
        isFullScreen && "bg-[#020617]"
      )}>
        <div className={cn(
          "w-full min-h-screen bg-card flex flex-col transition-all duration-500 overflow-hidden",
          isModern ? "bg-transparent shadow-none" : "shadow-2xl",
          isFullScreen && "shadow-none border-0 rounded-0",
          className
        )}>
          <div className={cn(
            "flex-1 flex flex-col min-h-0",
            isModern && "p-2"
          )}>
            <div className={cn(
              "flex-1 flex flex-col min-h-0",
              isModern && "bg-white/70 backdrop-blur-xl rounded-[2.5rem] border border-white/40 shadow-premium overflow-hidden",
              isFullScreen && "bg-transparent border-0 rounded-0"
            )}>
              <div className={cn("flex-1 overflow-auto", showBottomNav && "pb-20")}>
                {children}
              </div>
            </div>
          </div>

          {showBottomNav && (
            <div className={cn(
              "fixed bottom-0 left-0 right-0 z-50 transition-all duration-500",
              isModern ? "pb-8 px-4" : "bg-white border-t border-slate-100"
            )}>
              <div className="max-w-md mx-auto">
                <BottomNav />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
