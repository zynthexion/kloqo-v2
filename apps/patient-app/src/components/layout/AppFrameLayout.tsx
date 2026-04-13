'use client';

import BottomNav from '@/components/clinic/BottomNav';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

type AppFrameLayoutProps = {
  children: React.ReactNode;
  className?: string;
  showBottomNav?: boolean;
};

export default function AppFrameLayout({ children, className, showBottomNav = false }: AppFrameLayoutProps) {
  const { theme } = useTheme();
  const isModern = theme === 'modern';

  return (
    <main className={cn(
      "flex min-h-screen flex-col items-center justify-start bg-white md:p-4 transition-all duration-500",
      isModern && "bg-transparent backdrop-blur-sm"
    )}>
      <div className={cn(
        "w-full min-h-screen bg-card flex flex-col transition-all duration-500",
        isModern ? "bg-transparent shadow-none" : "shadow-2xl",
        className
      )}>
        <div className={cn(
          "flex-1 flex flex-col min-h-0",
          isModern && "p-2" // Add some padding for floating effect
        )}>
           <div className={cn(
             "flex-1 flex flex-col min-h-0",
             isModern && "bg-white/70 backdrop-blur-xl rounded-[2.5rem] border border-white/40 shadow-premium overflow-hidden"
           )}>
             {children}
           </div>
        </div>
        {showBottomNav && (
            <div className={cn(
              "mt-auto",
              isModern ? "p-4 pb-8" : ""
            )}>
                <BottomNav />
            </div>
        )}
      </div>
    </main>
  );
}
