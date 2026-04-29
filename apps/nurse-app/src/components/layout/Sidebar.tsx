'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Radio, List, Calendar, Settings, ChevronRight, User, Power, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNurseDashboard } from '@/hooks/useNurseDashboard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { RoleSwitcher } from './RoleSwitcher';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function Sidebar() {
  const pathname = usePathname();
  const { data, selectedDoctorId, updateDoctorStatus } = useNurseDashboard();
  const [showConfirmIn, setShowConfirmIn] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

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

  const navItems = [
    { href: '/', icon: Home, label: 'Overview' },
    { href: '/dashboard', icon: Radio, label: 'Live' },
    { href: '/appointments', icon: List, label: 'Bookings' },
    { href: '/appointments/schedule', icon: Calendar, label: 'Schedule' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ];

  const selectedDoctor = data?.doctors.find(d => d.id === selectedDoctorId);
  const consultationStatus = selectedDoctor?.consultationStatus || 'Out';

  const handleStatusChange = async (checked: boolean) => {
    if (!selectedDoctorId) return;
    const newStatus = checked ? 'In' : 'Out';
    
    if (newStatus === 'In') {
      setShowConfirmIn(true);
      return;
    }

    await performToggle('Out');
  };

  const performToggle = async (status: 'In' | 'Out') => {
    setIsToggling(true);
    try {
      await updateDoctorStatus(selectedDoctorId!, status);
    } finally {
      setIsToggling(false);
      setShowConfirmIn(false);
    }
  };

  return (
    <>
      {/* Sidebar Navigation */}
      <aside className={cn(
        "hidden md:flex bg-white border-r border-slate-200 flex-col items-center py-8 z-40 transition-all duration-500 fixed left-0 top-0 bottom-0",
        !isSidebarOpen ? "w-0 opacity-0 -translate-x-full overflow-hidden border-0" : "w-28 hover:w-32 group/sidebar"
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
        
        {/* Logo Section */}
        <div className="flex items-center justify-center p-4 shrink-0 mb-8 w-full">
          <Link className="flex items-center gap-3 group" href="/">
            <div className="w-10 h-10 shrink-0 lg:group-hover:hidden transition-opacity duration-200">
              <img alt="Kloqo Icon" src="/kloqo_Logo_twest.png" className="w-full h-full object-contain" />
            </div>
          </Link>
        </div>

        {/* Navigation Section */}
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

        {/* User / Doctor Context Switcher at Bottom */}
        <div className="mt-auto flex flex-col gap-8 items-center w-full">
          <RoleSwitcher />
          
          <div className="w-full px-4 pb-4 flex flex-col items-center gap-4 group">
            <Avatar className="h-16 w-16 rounded-2xl shadow-sm border-2 border-white group-hover:scale-105 transition-transform duration-500">
              <AvatarImage src={selectedDoctor?.avatar} />
              <AvatarFallback className="bg-primary/5 p-0 overflow-hidden">
                <User className="w-8 h-8 text-slate-300" />
              </AvatarFallback>
            </Avatar>
            <div className="text-center overflow-hidden w-full">
              <p className="text-sm font-black text-slate-900 leading-tight truncate px-1">
                {selectedDoctor?.name || 'Dr.'}
              </p>
              <div className="flex items-center justify-center gap-2 mt-2 bg-slate-50 py-1.5 px-3 rounded-full border border-slate-100">
                <span className={cn("text-[10px] font-black uppercase tracking-widest", consultationStatus === 'Out' ? "text-slate-900" : "text-slate-400")}>Out</span>
                <Switch 
                  className="scale-75 data-[state=checked]:bg-emerald-500" 
                  checked={consultationStatus === 'In'}
                  onCheckedChange={handleStatusChange}
                  disabled={isToggling}
                />
                <span className={cn("text-[10px] font-black uppercase tracking-widest", consultationStatus === 'In' ? "text-emerald-600" : "text-slate-400")}>In</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Floating Restore Button (Visible when sidebar is collapsed) */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="fixed left-6 top-1/2 -translate-y-1/2 z-50 hidden md:flex flex-col items-center justify-center w-12 h-24 bg-slate-900 border border-slate-700 shadow-2xl rounded-full hover:bg-black transition-all duration-300 group hover:-translate-x-1 animate-in slide-in-from-left duration-500"
        >
          <div className="flex flex-col items-center gap-1">
            <ChevronRight className="h-5 w-5 text-white group-hover:translate-x-0.5 transition-transform" />
            <span className="text-[8px] font-black text-white/40 uppercase [writing-mode:vertical-lr] tracking-widest mt-1">Menu</span>
          </div>
        </button>
      )}

      {/* Confirmation Dialog for Toggling 'In' */}
      <AlertDialog open={showConfirmIn} onOpenChange={setShowConfirmIn}>
        <AlertDialogContent className="rounded-[2rem] p-8 border-slate-100 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black text-slate-900 leading-tight">
              Start Doctor Session?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-medium py-4 leading-relaxed">
              Toggling <span className="font-bold text-emerald-600">"Doctor In"</span> will immediately notify all arrived patients that the consultation has started. Please ensure you are ready to receive patients.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-4">
            <AlertDialogCancel className="h-14 rounded-2xl border-slate-200 font-bold text-slate-500 hover:bg-slate-50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => performToggle('In')}
              disabled={isToggling}
              className="h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black shadow-lg shadow-emerald-500/20 px-8"
            >
              {isToggling ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Power className="h-4 w-4 mr-2" />
              )}
              Start Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
