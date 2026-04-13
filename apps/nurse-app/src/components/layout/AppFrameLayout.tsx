'use client';

import BottomNav from '@/components/clinic/BottomNav';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { RoleSwitcher } from './RoleSwitcher';

type AppFrameLayoutProps = {
  children: React.ReactNode;
  className?: string;
  showBottomNav?: boolean;
  isFullScreen?: boolean;
};

export default function AppFrameLayout({ children, className, showBottomNav = false, isFullScreen = false }: AppFrameLayoutProps) {
  const { theme } = useTheme();
  const isModern = theme === 'modern' && !isFullScreen;

  return (
    <main className={cn(
      "flex min-h-screen flex-col items-center justify-start bg-white md:p-4 transition-all duration-500",
      isModern && "bg-transparent backdrop-blur-sm",
      isFullScreen && "p-0 md:p-0 bg-[#020617]"
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
             {children}
           </div>
        </div>
        {showBottomNav && (
            <div className={cn(
              "mt-auto",
              isModern ? "px-4" : ""
            )}>
                <div className="max-w-md mx-auto">
                    <RoleSwitcher />
                </div>
                <div className={cn(
                   isModern ? "pb-8" : ""
                )}>
                   <BottomNav />
                </div>
            </div>
        )}
      </div>
    </main>
  );
}
