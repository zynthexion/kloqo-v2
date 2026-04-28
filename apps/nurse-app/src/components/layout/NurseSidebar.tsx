'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Settings, 
  Activity,
  LogOut,
  User,
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
    { href: '/day-snapshot', icon: LayoutDashboard, label: 'Dash' },
    { href: '/dashboard', icon: Activity, label: 'Live' },
    { href: '/appointments', icon: CalendarDays, label: 'Appts' },
    { href: '/settings', icon: Settings, label: 'Setup' },
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-24 bg-white/40 backdrop-blur-xl border-r border-slate-200/50 flex flex-col items-center py-6 z-50 transition-all duration-500 hover:w-28 group/sidebar">
      {/* Clinic Brand */}
      <div className="mb-10 relative">
        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20 rotate-3 group-hover/sidebar:rotate-0 transition-transform">
          <span className="text-white font-black text-xl">K</span>
        </div>
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
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

        <div className="p-3 rounded-2xl bg-slate-100/50 hover:bg-slate-200/50 transition-colors cursor-pointer group">
          <Activity className="h-6 w-6 text-slate-400 group-hover:text-primary transition-colors" />
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
