'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoleSwitcher } from './RoleSwitcher';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';
import { Role } from '@kloqo/shared';
import { FileText, Home, Radio, List, User, Settings, Bell, Search, ChevronRight, LogOut, Calendar, Activity, Zap } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Switch } from '@/components/ui/switch';

interface TabletDashboardLayoutProps {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
  headerActions?: React.ReactNode;
  collapsed?: boolean;
  noPadding?: boolean;
  hideSidebar?: boolean;
  hideRightPanel?: boolean;
}

export function TabletDashboardLayout({ 
  children, 
  rightPanel, 
  headerActions, 
  collapsed = false, 
  noPadding = false,
  hideSidebar = false,
  hideRightPanel = false
}: TabletDashboardLayoutProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { activeRole, availableRoles, displayName, displayAvatar, clinicalProfile } = useActiveIdentity();
  
  // Custom interactive collapse state
  const isDashboard = pathname.startsWith('/dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isDashboard);

  // Sync state if pathname changes to/from dashboard
  useEffect(() => {
    if (isDashboard) {
      setIsSidebarOpen(false);
    } else {
      setIsSidebarOpen(true);
    }
  }, [isDashboard]);
  
  const ALL_NAV_ITEMS = [
    { href: '/', icon: Home, label: 'Overview', menuKey: '/' },
    { href: '/dashboard', icon: Radio, label: 'Live', menuKey: '/dashboard' },
    { href: '/appointments', icon: List, label: 'Bookings', menuKey: '/appointments' },
    { href: '/appointments/schedule', icon: Calendar, label: 'Schedule', menuKey: '/appointments/schedule' },
    { href: '/prescriptions', icon: FileText, label: 'Rx Queue', menuKey: '/prescriptions' },
    { href: '/settings', icon: User, label: 'Profile', menuKey: '/settings' },
  ];

  const hardcodedRoles: Role[] = ['nurse', 'doctor', 'clinicAdmin', 'superAdmin'];
  
  const navItems = hardcodedRoles.includes(activeRole as Role)
    ? ALL_NAV_ITEMS.filter(item => activeRole === 'nurse' || activeRole === 'doctor' ? item.menuKey !== '/prescriptions' : true)
    : ALL_NAV_ITEMS.filter(item =>
        user?.accessibleMenus?.some((m: string) => m === item.menuKey || item.menuKey === '/settings')
      );

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] overflow-hidden font-sans text-lg">
      {/* 1. Left Sidebar (Navigation) */}
      {!hideSidebar && (
        <aside className={cn(
          "bg-white border-r border-slate-200 flex flex-col items-center py-8 z-40 transition-all duration-500 relative",
          !isSidebarOpen ? "w-0 opacity-0 -translate-x-full overflow-hidden border-0" : (collapsed ? "w-24" : "w-32 lg:w-40")
        )}>
          {/* Collapse Toggle inside Sidebar */}
          {isSidebarOpen && isDashboard && (
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="absolute -right-3 top-24 w-6 h-12 bg-white border border-slate-200 border-l-0 shadow-sm rounded-r-xl flex items-center justify-center text-slate-400 hover:text-primary transition-colors z-50"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
            </button>
          )}
          <div className="flex items-center justify-center p-4 shrink-0 mb-8 w-full">
            <Link className="flex items-center gap-3 group" href="/">
              <div className="w-10 h-10 shrink-0 lg:group-hover:hidden transition-opacity duration-200">
                <img alt="Kloqo Icon" loading="lazy" width="40" height="40" decoding="async" src="/kloqo_Logo_twest.png" style={{ color: 'transparent' }} />
              </div>
              {!collapsed && (
                <div className="w-28 h-auto shrink-0 hidden lg:group-hover:flex transition-opacity duration-200 delay-100 items-center justify-center">
                  <img alt="Kloqo Logo" loading="lazy" width="128" height="35" decoding="async" src="/kloqo_Logo_twest.png" style={{ color: 'transparent' }} />
                </div>
              )}
            </Link>
          </div>
          
          <nav className="flex-1 flex flex-col gap-6">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href === '/dashboard' && pathname.startsWith('/dashboard'));
              return (
                <Link href={item.href} key={item.label} title={item.label}>
                  <div className={cn(
                    "flex items-center justify-center min-h-[56px] w-[56px] rounded-2xl transition-all duration-300 group relative",
                    isActive 
                      ? "bg-primary/10 text-primary shadow-sm" 
                      : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                  )}>
                    <item.icon className={cn("h-7 w-7 transition-transform", isActive ? "scale-110 stroke-[2.5px]" : "group-hover:scale-110")} />
                    {isActive && (
                      <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-1.5 h-8 bg-primary rounded-r-full" />
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex flex-col gap-8 items-center w-full">
              <RoleSwitcher />
              
              <div className="w-full px-4 pb-8 flex flex-col items-center gap-4 group">
                  <Avatar className="h-16 w-16 rounded-2xl shadow-sm border-2 border-white group-hover:scale-105 transition-transform duration-500">
                      <AvatarImage src={displayAvatar} />
                      <AvatarFallback className="bg-primary/5 p-0 overflow-hidden">
                        <User className="w-8 h-8 text-slate-300" />
                      </AvatarFallback>
                  </Avatar>
                  <div className="text-center overflow-hidden w-full">
                      <p className="text-sm font-black text-slate-900 leading-tight truncate px-1">
                        {displayName}
                      </p>
                      <div className="flex items-center justify-center gap-2 mt-2 bg-slate-50 py-1.5 px-3 rounded-full border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Out</span>
                        <Switch className="scale-75 data-[state=checked]:bg-emerald-500" />
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">In</span>
                      </div>
                  </div>
              </div>
          </div>
        </aside>
      )}

      {/* Floating Restore Button (Visible when sidebar is collapsed) */}
      {!isSidebarOpen && !hideSidebar && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="fixed left-6 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center justify-center w-12 h-24 bg-slate-900 border border-slate-700 shadow-2xl rounded-full hover:bg-black transition-all duration-300 group hover:-translate-x-1 animate-in slide-in-from-left duration-500"
        >
          <div className="flex flex-col items-center gap-1">
            <ChevronRight className="h-5 w-5 text-white group-hover:translate-x-0.5 transition-transform" />
            <span className="text-[8px] font-black text-white/40 uppercase [writing-mode:vertical-lr] tracking-widest mt-1">Menu</span>
          </div>
        </button>
      )}

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-transparent overflow-y-auto custom-scrollbar relative">
        <header className="h-24 px-10 flex items-center justify-between sticky top-0 bg-[#F8FAFC]/80 backdrop-blur-md z-30 border-b border-slate-100 gap-8">
            <div className="relative flex-1 max-w-lg group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                <Input 
                    placeholder="Search clinical records..." 
                    className="pl-12 h-14 bg-white border-slate-200 shadow-sm rounded-2xl placeholder:font-medium placeholder:text-slate-400 focus-visible:ring-primary/20 transition-all font-bold text-slate-800 text-lg w-full"
                />
            </div>
            {headerActions}
        </header>

        <div className={cn("flex-1 flex flex-col w-full h-full relative", !noPadding && "px-10 py-10 pb-24")}>
            {children}
        </div>
      </main>

      {/* 3. Clinical Right Sidebar (Patient Context) */}
      {!collapsed && !hideRightPanel && (
        <aside className="hidden xl:flex w-80 lg:w-[400px] bg-white border-l border-slate-200 flex-col z-40">
          <div className="p-10 flex-1 overflow-y-auto custom-scrollbar">
              {rightPanel || (
                  <PatientContextPanel 
                    user={user} 
                    clinicalProfile={clinicalProfile}
                    displayName={displayName}
                    displayAvatar={displayAvatar}
                    specialty={clinicalProfile?.specialty || (activeRole === 'nurse' ? 'Clinical Nurse' : 'Practitioner')} 
                  />
              )}
          </div>
        </aside>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .shadow-premium { box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.02), 0 8px 10px -6px rgba(0, 0, 0, 0.02); }
      `}</style>
    </div>
  );
}

function PatientContextPanel({ user, clinicalProfile, displayName, displayAvatar, specialty }: { user: any, clinicalProfile: any, displayName: string, displayAvatar: string, specialty: string }) {
    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-700">
            {/* Identity Badge */}
            <div className="flex flex-col items-center p-10 rounded-[3rem] bg-slate-50 border border-slate-100 relative overflow-hidden group shadow-sm">
                <div className="absolute top-0 right-0 p-6">
                    <Zap className="h-6 w-6 text-primary/20" />
                </div>
                <Avatar className="h-32 w-32 border-8 border-white shadow-xl mb-8 group-hover:scale-105 transition-transform duration-500">
                    <AvatarImage src={displayAvatar} />
                    <AvatarFallback className="bg-primary/10 p-0 overflow-hidden">
                      <User className="w-12 h-12 text-slate-200" />
                    </AvatarFallback>
                </Avatar>
                <div className="text-center">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">{displayName}</h3>
                    <p className="text-xs font-black text-primary uppercase tracking-[0.2em] mt-4 bg-primary/5 px-6 py-2 rounded-full inline-block">
                        {specialty}
                    </p>
                </div>
            </div>

            {/* Quick Clinical Context Placeholder */}
            <div className="space-y-8">
                <div className="flex items-center justify-between px-2">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Clinical Snapshot</h4>
                    <Activity className="h-5 w-5 text-slate-300" />
                </div>

                <div className="space-y-4">
                    <div className="p-8 rounded-[2.5rem] bg-rose-50 border border-rose-100/50 group hover:bg-rose-100 transition-colors shadow-sm">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                <Activity className="h-5 w-5 text-rose-500" />
                            </div>
                            <span className="text-xs font-black text-rose-600 uppercase tracking-widest">Major Allergies</span>
                        </div>
                        <p className="text-sm font-bold text-rose-400 px-1 italic">No patient selected</p>
                    </div>

                    <div className="p-8 rounded-[2.5rem] bg-indigo-50 border border-indigo-100/50 group hover:bg-indigo-100 transition-colors shadow-sm">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                <Zap className="h-5 w-5 text-indigo-500" />
                            </div>
                            <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Active Meds</span>
                        </div>
                        <div className="h-2 w-1/2 bg-indigo-100 rounded-full mx-1" />
                    </div>
                </div>
            </div>

            <div className="p-8 rounded-[3rem] bg-slate-900 text-white space-y-5 shadow-2xl relative overflow-hidden">
                <Zap className="absolute top-[-20%] right-[-10%] w-48 h-48 opacity-10 rotate-12" />
                <p className="text-xs font-black uppercase tracking-widest opacity-60">System Status</p>
                <h4 className="text-xl font-black leading-tight">Identity verified. Clinic node ready for high-precision charting.</h4>
                <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Real-time Clinical Sync</span>
                </div>
            </div>
        </div>
    );
}
