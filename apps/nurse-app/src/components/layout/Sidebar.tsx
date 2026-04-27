'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LayoutDashboard, CalendarDays, Map, Settings, UserCog, Loader2 } from 'lucide-react';
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
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dash' },
    { href: '/appointments', icon: CalendarDays, label: 'Appts' },
    { href: '/day-snapshot', icon: Map, label: 'Maps' },
    { href: '/settings', icon: Settings, label: 'Setup' },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-24 bg-white/40 backdrop-blur-xl border-r border-slate-200/50 flex-col items-center py-6 z-50 transition-all duration-500 hover:w-28 group/sidebar">
      {/* Logo Section */}
      <div className="mb-8 relative px-4 w-full">
        <Link href="/" className="flex items-center justify-center group/logo">
          <div className="w-10 h-10 shrink-0 group-hover/sidebar:hidden transition-all duration-300">
            <img alt="Kloqo Icon" className="w-full h-full object-contain" src="/kloqo_Logo_twest.png" />
          </div>
          <div className="hidden group-hover/sidebar:flex w-full items-center justify-center transition-all duration-500 animate-in fade-in zoom-in-95">
            <img alt="Kloqo Logo" className="h-8 w-auto object-contain" src="/kloqo_Logo_twest.png" />
          </div>
        </Link>
      </div>

      {/* Doctor Switcher (Top Position for Visibility) */}
      <div className="mb-8 w-full px-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className="flex flex-col items-center justify-center w-full p-3 rounded-2xl transition-all duration-300 gap-1 group hover:bg-slate-100/50"
              type="button"
            >
              <div className="relative">
                <Avatar className="h-10 w-10 border-2 border-white shadow-premium transition-transform group-hover:scale-110">
                  <AvatarImage src={activeDoctor?.avatar} />
                  <AvatarFallback className="bg-slate-100 text-[10px]">{activeDoctor?.name?.substring(0, 2).toUpperCase() || 'DR'}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white bg-emerald-500 flex items-center justify-center shadow-sm">
                  <UserCog className="h-2 w-2 text-white" />
                </div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-primary transition-colors">Context</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="w-64 rounded-2xl p-2 shadow-premium border-white/40 bg-white/80 backdrop-blur-xl z-[100]">
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

      {/* Navigation Section */}
      <nav className="flex-1 flex flex-col gap-2 w-full px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href === '/dashboard' && pathname === '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300 gap-1 group",
                isActive 
                  ? "bg-primary text-white shadow-lg scale-105" 
                  : "text-slate-400 hover:bg-slate-100/50 hover:text-slate-600"
              )}
            >
              <item.icon className={cn(
                "h-6 w-6 transition-transform group-hover:scale-110",
                isActive ? "text-white" : "text-slate-400"
              )} />
              <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Profile/Settings Section */}
      <div className="mt-auto flex flex-col gap-4 items-center w-full px-3 pb-4">
        <RoleSwitcher />
        <Link href="/settings" className="group mt-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-200 transition-all duration-300 group-hover:bg-primary/5 group-hover:border-primary/20">
            <Settings className="h-6 w-6 text-slate-400 group-hover:text-primary transition-colors" />
          </div>
        </Link>
      </div>
    </aside>
  );
}
