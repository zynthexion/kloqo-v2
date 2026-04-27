'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoleSwitcher } from './RoleSwitcher';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';
import { Role } from '@kloqo/shared';
import { FileText, Home, Radio, List, User, Settings, Bell, Search, ChevronRight, LogOut, Calendar, Activity, Zap, Users, Clock, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Switch } from '@/components/ui/switch';
import { useNurseDashboardContext } from '@/contexts/NurseDashboardContext';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
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
import { Power, Loader2 } from 'lucide-react';

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
  const { data, selectedDoctorId, updateDoctorStatus } = useNurseDashboardContext();
  const [showConfirmIn, setShowConfirmIn] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  
  const isDashboard = pathname.startsWith('/dashboard');

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
    <AppFrameLayout className="bg-[#F8FAFC]">
      <div className="flex h-full w-full overflow-hidden font-sans text-lg">
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-transparent overflow-y-auto custom-scrollbar relative">
          <header className="h-24 px-10 flex items-center justify-between sticky top-0 bg-[#F8FAFC]/80 backdrop-blur-md z-30 border-b border-slate-100 gap-8">
              <div className="flex-1">
                {/* Status Toggle in Header since we removed it from sidebar */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-white/50 py-1.5 px-4 rounded-full border border-slate-200">
                    <span className={cn("text-[10px] font-black uppercase tracking-widest", consultationStatus === 'Out' ? "text-slate-900" : "text-slate-400")}>Dr. {selectedDoctor?.name || 'Doctor'} is Out</span>
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
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .shadow-premium { box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.02), 0 8px 10px -6px rgba(0, 0, 0, 0.02); }
      `}</style>

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
    </AppFrameLayout>
  );
}

function PatientContextPanel({ user, clinicalProfile, displayName, displayAvatar, specialty }: { user: any, clinicalProfile: any, displayName: string, displayAvatar: string, specialty: string }) {
    const { data, selectedDoctorId } = useNurseDashboardContext();

    const appointments = data?.appointments || [];
    const doctorAppointments = selectedDoctorId 
        ? appointments.filter(a => a.doctorId === selectedDoctorId)
        : appointments;

    const arrivedCount = doctorAppointments.filter(a => a.status === 'Confirmed').length;
    const pendingCount = doctorAppointments.filter(a => a.status === 'Pending').length;
    const completedCount = doctorAppointments.filter(a => a.status === 'Completed').length;

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

            {/* Real-time Clinical Stats (from Snapshot) */}
            <div className="space-y-8">
                <div className="flex items-center justify-between px-2">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Clinical Snapshot</h4>
                    <Activity className="h-5 w-5 text-slate-300" />
                </div>

                <div className="space-y-4">
                    {/* Arrived Card */}
                    <div className="p-8 rounded-[2.5rem] bg-emerald-50 border border-emerald-100/50 group hover:bg-emerald-100 transition-colors shadow-sm">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                <Users className="h-5 w-5 text-emerald-500" />
                            </div>
                            <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">Arrived</span>
                        </div>
                        <p className="text-3xl font-black text-emerald-700">{arrivedCount}</p>
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mt-1">Waiting in clinic</p>
                    </div>

                    {/* Pending Card */}
                    <div className="p-8 rounded-[2.5rem] bg-amber-50 border border-amber-100/50 group hover:bg-amber-100 transition-colors shadow-sm">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                <Clock className="h-5 w-5 text-amber-500" />
                            </div>
                            <span className="text-xs font-black text-amber-600 uppercase tracking-widest">Pending</span>
                        </div>
                        <p className="text-3xl font-black text-amber-700">{pendingCount}</p>
                        <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mt-1">Yet to arrive</p>
                    </div>

                    {/* Completed Card */}
                    <div className="p-8 rounded-[2.5rem] bg-blue-50 border border-blue-100/50 group hover:bg-blue-100 transition-colors shadow-sm">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                <CheckCircle2 className="h-5 w-5 text-blue-500" />
                            </div>
                            <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Completed</span>
                        </div>
                        <p className="text-3xl font-black text-blue-700">{completedCount}</p>
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mt-1">Consultations done</p>
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
