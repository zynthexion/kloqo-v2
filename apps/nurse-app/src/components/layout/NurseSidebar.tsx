'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Settings, 
  Map
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RoleSwitcher } from './RoleSwitcher';

interface SidebarItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
}

const SidebarItem = ({ href, icon: Icon, label, active }: SidebarItemProps) => (
  <Link href={href} className={cn(
    "flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300 gap-1 group",
    active 
      ? "bg-primary text-white shadow-lg scale-105" 
      : "text-slate-400 hover:bg-slate-100/50 hover:text-slate-600"
  )}>
    <Icon className={cn("h-6 w-6 transition-transform group-hover:scale-110", active ? "text-white" : "text-slate-400")} />
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </Link>
);

export function NurseSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const menuItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dash' },
    { href: '/appointments', icon: CalendarDays, label: 'Appts' },
    { href: '/day-snapshot', icon: Map, label: 'Maps' },
    { href: '/settings', icon: Settings, label: 'Setup' },
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-24 bg-white/40 backdrop-blur-xl border-r border-slate-200/50 flex flex-col items-center py-6 z-50 transition-all duration-500 hover:w-28 group/sidebar">
      {/* Clinic Brand */}
      <div className="mb-10 relative px-4 w-full">
        <Link href="/" className="flex items-center justify-center group/logo">
          <div className="w-10 h-10 shrink-0 group-hover/sidebar:hidden transition-all duration-300">
            <img 
              alt="Kloqo Icon" 
              src="/kloqo_Logo_twest.png" 
              className="w-full h-full object-contain"
            />
          </div>
          <div className="hidden group-hover/sidebar:flex w-full items-center justify-center transition-all duration-500 animate-in fade-in zoom-in-95">
            <img 
              alt="Kloqo Logo" 
              src="/kloqo_Logo_twest.png" 
              className="h-8 w-auto object-contain"
            />
          </div>
        </Link>
        <div className="absolute top-0 right-4 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
      </div>

      {/* Main Nav */}
      <nav className="flex-1 flex flex-col gap-4 w-full px-3">
        {menuItems.map((item) => (
          <SidebarItem 
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={pathname === item.href}
          />
        ))}
      </nav>

      {/* User / Bottom */}
      <div className="mt-auto flex flex-col gap-6 items-center w-full px-3">
        <div className="w-full">
           <RoleSwitcher />
        </div>

        
        <Link href="/settings">
          <Avatar className="h-12 w-12 border-2 border-white shadow-md hover:scale-110 transition-transform cursor-pointer">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-slate-200 text-slate-500 uppercase font-bold text-xs">
              {user?.name?.substring(0, 2)}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </aside>
  );
}
