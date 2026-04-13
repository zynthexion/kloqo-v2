'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, List, Radio, User, FileText, Bell } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

const ALL_NAV_ITEMS = [
  { href: '/home', icon: Home, label: 'Home', menuKey: '/home' },
  { href: '/live-token', icon: Radio, label: 'Live', menuKey: '/live-token' },
  { href: '/appointments', icon: List, label: 'Bookings', menuKey: '/appointments' },
  { href: '/settings', icon: User, label: 'Profile', menuKey: '/settings' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isModern = theme === 'modern';

  // In the patient app, all users see the same patient navigation items.
  const navItems = ALL_NAV_ITEMS;

  return (
    <nav className={cn(
      "z-50 w-full",
      "relative md:static" 
    )}>
      <div className={cn(
        "flex justify-around items-center h-16 max-w-md mx-auto px-6 transition-all duration-500",
        isModern && "modern-pill h-14 bg-white/80 backdrop-blur-md border border-white/40 shadow-premium",
      )}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href === '/' && (pathname.startsWith('/book-appointment') || pathname.startsWith('/walk-in'))) || 
            (item.href === '/dashboard' && pathname.startsWith('/dashboard'));
          
          return (
            <Link href={item.href} key={item.label} className="flex-1">
              <div
                className={cn(
                  'flex flex-col items-center justify-center gap-1 transition-all duration-300',
                  isActive 
                    ? (isModern ? 'text-primary scale-110' : 'text-theme-blue') 
                    : (isModern ? 'text-slate-400 hover:text-slate-600 hover:scale-105' : 'text-slate-400')
                )}
              >
                <div className={cn(
                  "relative transition-all duration-300",
                  isActive && isModern && "after:content-[''] after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-primary after:rounded-full"
                )}>
                  <item.icon className={cn("h-6 w-6", isActive && "stroke-[2.5px]")} />
                </div>
                {!isModern && (
                  <span className={cn("text-[10px] font-bold uppercase tracking-wider", isActive ? "opacity-100" : "opacity-70")}>
                    {item.label}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
