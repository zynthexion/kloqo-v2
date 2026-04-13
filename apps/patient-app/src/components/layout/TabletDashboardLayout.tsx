'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  Home, 
  Radio, 
  List, 
  User, 
  Settings, 
  Bell, 
  Search, 
  ChevronRight,
  LogOut,
  Calendar,
  Activity,
  Zap
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TabletDashboardLayoutProps {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
  collapsed?: boolean;
}

export function TabletDashboardLayout({ children, rightPanel, collapsed = false }: TabletDashboardLayoutProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  
  const navItems = [
    { href: '/', icon: Home, label: 'Overview' },
    { href: '/dashboard', icon: Radio, label: 'Live Rx' },
    { href: '/appointments', icon: List, label: 'Bookings' },
    { href: '/settings', icon: User, label: 'Profile' },
  ];

  return (
    <div className="flex h-screen w-full bg-[#f8f9ff] overflow-hidden font-sans">
      {/* 1. Left Sidebar (Navigation) */}
      <aside className={cn(
        "bg-white border-r border-slate-100 flex flex-col items-center py-8 z-40 transition-all duration-500",
        collapsed ? "w-20" : "w-24 lg:w-32"
      )}>
        <div className={cn(
            "rounded-2xl bg-primary shadow-lg shadow-primary/30 flex items-center justify-center text-white font-black transition-all duration-500 mb-12",
            collapsed ? "w-10 h-10 text-lg" : "w-12 h-12 text-xl"
        )}>
          K
        </div>
        
        <nav className="flex-1 flex flex-col gap-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href === '/dashboard' && pathname.startsWith('/dashboard'));
            return (
              <Link href={item.href} key={item.label} title={item.label}>
                <div className={cn(
                  "p-3 rounded-2xl transition-all duration-300 group relative",
                  isActive 
                    ? "bg-primary/10 text-primary shadow-sm" 
                    : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                )}>
                  <item.icon className={cn("h-6 w-6 transition-transform", isActive ? "scale-110 stroke-[2.5px]" : "group-hover:scale-110")} />
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-6 items-center">
            <button className="p-4 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                <LogOut className="h-6 w-6" />
            </button>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-transparent overflow-y-auto custom-scrollbar relative">
        {/* Header Bar */}
        <header className="h-20 px-8 flex items-center justify-between sticky top-0 bg-[#f8f9ff]/80 backdrop-blur-md z-30">
            <div className="relative w-full max-w-md group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                <Input 
                    placeholder="Search patients, records..." 
                    className="pl-11 h-12 bg-white border-none shadow-premium rounded-2xl placeholder:font-medium placeholder:text-slate-400 focus-visible:ring-primary/20 transition-all"
                />
            </div>

            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" className="w-12 h-12 rounded-2xl bg-white shadow-premium relative">
                    <Bell className="h-5 w-5 text-slate-600" />
                    <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                </Button>
                <div className="h-12 w-[1px] bg-slate-200 mx-2" />
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-black text-slate-900 leading-none">Dr. {user?.name?.split(' ')[0]}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Surgeon</p>
                    </div>
                </div>
            </div>
        </header>

        <div className="px-8 pb-12">
            {children}
        </div>
      </main>

      {/* 3. Right Sidebar (Analytics & Profile) - Desktop landscape toggle */}
      {!collapsed && (
        <aside className="hidden xl:flex w-80 lg:w-96 bg-white border-l border-slate-100 flex-col z-40">
          <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
              {rightPanel || (
                  <DefaultRightPanel user={user} />
              )}
          </div>
        </aside>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .shadow-premium {
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.02), 0 8px 10px -6px rgba(0, 0, 0, 0.02);
        }
      `}</style>
    </div>
  );
}

function DefaultRightPanel({ user }: { user: any }) {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-700">
            {/* User Profile Card */}
            <div className="flex flex-col items-center p-6 rounded-[2.5rem] bg-slate-50 border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4">
                    <Settings className="h-5 w-5 text-slate-300 hover:text-slate-900 transition-colors cursor-pointer" />
                </div>
                <Avatar className="h-24 w-24 border-4 border-white shadow-xl mb-4 group-hover:scale-105 transition-transform duration-500">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary font-black text-2xl">{user?.name?.[0]}</AvatarFallback>
                </Avatar>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">{user?.name}</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Cardiologist (MBBS, MD)</p>
            </div>

            {/* Total Consultations Stat */}
            <div className="p-6 rounded-[2.5rem] bg-white shadow-premium border border-slate-50 space-y-4">
                <div className="flex justify-between items-start">
                    <div className="p-3 bg-purple-50 rounded-2xl">
                        <Activity className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="px-2 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-black">+54%</div>
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Consultations</p>
                    <h4 className="text-3xl font-black text-slate-900 mt-1">₹24,500</h4>
                </div>
                {/* Visual line/wave placeholder */}
                <div className="h-16 w-full flex items-end gap-1 px-1">
                    {[30, 45, 35, 60, 50, 80, 70].map((h, i) => (
                        <div key={i} className="flex-1 bg-purple-100 rounded-t-md relative group cursor-pointer" style={{ height: `${h}%` }}>
                            <div className="absolute inset-0 bg-purple-600 rounded-t-md opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Activities */}
            <div className="space-y-4">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest px-2">Recent Activities</h4>
                <div className="space-y-1">
                    {[
                        { title: 'To Philip Kelley', sub: 'Prescription Sent', price: '- ₹450', color: 'bg-pink-50 text-pink-500', icon: ChevronRight },
                        { title: 'To John Doe', sub: 'Consultation Done', price: '+ ₹800', color: 'bg-green-50 text-green-500', icon: ChevronRight },
                        { title: 'Walk-in Added', sub: 'New Patient', price: '', color: 'bg-blue-50 text-blue-500', icon: Zap }
                    ].map((act, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-[1.5rem] transition-colors cursor-pointer group">
                            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", act.color)}>
                                <act.icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-slate-900 truncate">{act.title}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{act.sub}</p>
                            </div>
                            <p className="text-xs font-black text-slate-900">{act.price}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
