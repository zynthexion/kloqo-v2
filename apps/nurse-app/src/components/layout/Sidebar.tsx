'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Home, Calendar, LayoutDashboard, CalendarDays, Activity, Settings, UserCog, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNurseDashboard } from '@/hooks/useNurseDashboard';
import { useTheme } from '@/contexts/ThemeContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleSwitcher } from './RoleSwitcher';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const { data, loading, selectedDoctorId, setSelectedDoctorId } = useNurseDashboard();
  
  const isModern = theme === 'modern';

  const doctors = data?.doctors || [];
  const activeDoctor = doctors.find(d => d.id === selectedDoctorId);

  const handleDoctorChange = (id: string) => {
    setSelectedDoctorId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set('doctor', id);
    router.replace(`?${params.toString()}`);
  };

  const navItems = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/dashboard', icon: Activity, label: 'Live' },
    { href: '/appointments', icon: CalendarDays, label: 'Appts' },
    { href: '/appointments/schedule', icon: Calendar, label: 'Schedule' },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[100px] bg-white/40 backdrop-blur-xl border-r border-slate-200/50 flex-col items-center py-8 z-50 transition-all duration-500 hover:w-[110px] group/sidebar">
      {/* Logo Section */}
      <Link href="/" className="mb-12">
        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <img src="/kloqo_Logo_twest.png" alt="Kloqo" className="w-8 h-8 object-contain" />
        </div>
      </Link>

      {/* Navigation Section */}
      <nav className="flex-1 flex flex-col gap-6 w-full px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href === '/' && pathname === '/dashboard' && false); // exact match
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-300 gap-2 group relative",
                isActive 
                  ? "bg-primary text-white shadow-lg shadow-primary/25 scale-105" 
                  : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"
              )}
            >
              <item.icon className={cn(
                "h-6 w-6 transition-transform group-hover:scale-110",
                isActive ? "text-white" : "text-slate-400"
              )} />
              <span className={cn(
                "text-[10px] font-black uppercase tracking-widest",
                isActive ? "text-white" : "text-slate-400"
              )}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Profile/Settings & Doctor Switcher Section */}
      <div className="mt-auto pt-8 flex flex-col items-center gap-6 w-full px-4 border-t border-slate-100/50">
        <Link href="/settings" className="group">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-200 transition-all duration-300 group-hover:bg-primary/5 group-hover:border-primary/20">
            <Settings className="h-6 w-6 text-slate-400 group-hover:text-primary transition-colors" />
          </div>
        </Link>
        
        <RoleSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className="flex flex-col items-center justify-center w-full p-2 rounded-2xl transition-all duration-300 gap-1 group hover:bg-slate-100/50"
              type="button"
            >
              <div className="relative">
                <Avatar className="h-12 w-12 border-2 border-white shadow-premium transition-transform group-hover:scale-110">
                  <AvatarImage src={activeDoctor?.avatar} />
                  <AvatarFallback className="bg-slate-100 text-xs font-bold">{activeDoctor?.name?.substring(0, 2).toUpperCase() || 'DR'}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white bg-emerald-500 flex items-center justify-center shadow-sm">
                  <UserCog className="h-3 w-3 text-white" />
                </div>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-primary transition-colors mt-1">Context</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="w-64 rounded-2xl p-2 shadow-premium border-white/40 bg-white/80 backdrop-blur-xl z-[100] ml-4">
            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-3 py-2">
              Switch Serving Context
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-100" />
            {loading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            ) : doctors.length > 0 ? (
              doctors.map((doc) => (
                <DropdownMenuItem
                  key={doc.id}
                  onClick={() => handleDoctorChange(doc.id)}
                  className={cn(
                    "rounded-xl px-3 py-2 gap-3 cursor-pointer transition-all duration-200 mb-1",
                    selectedDoctorId === doc.id ? "bg-primary text-white shadow-md" : "hover:bg-slate-50 text-slate-600"
                  )}
                >
                  <Avatar className="h-8 w-8 border border-white/20">
                    <AvatarImage src={doc.avatar} />
                    <AvatarFallback className="bg-slate-100 text-[10px]">{doc.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className={cn("text-xs font-bold", selectedDoctorId === doc.id ? "text-white" : "text-slate-700")}>Dr. {doc.name}</span>
                    <span className={cn("text-[8px] uppercase tracking-widest opacity-70", selectedDoctorId === doc.id ? "text-white" : "text-slate-400")}>{doc.department || 'Clinical'}</span>
                  </div>
                </DropdownMenuItem>
              ))
            ) : (
              <div className="p-3 text-[10px] text-slate-400 italic">No assigned doctors found</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
