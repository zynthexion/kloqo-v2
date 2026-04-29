'use client';

import React from 'react';
import { Phone, UserPlus, BarChart3, Coffee, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import ClinicHeader from '@/components/clinic/ClinicHeader';
import DailyProgress from '@/components/clinic/DailyProgress';
import { cn } from '@/lib/utils';
import { Doctor } from '@kloqo/shared';

interface MobileDashboardViewProps {
  isModern: boolean;
  dashData: any;
  selectedDoctor: string;
  handleDoctorChange: (id: string) => void;
  consultationStatus: 'In' | 'Out';
  handleStatusChange: (status: 'In' | 'Out', sessionIndex?: number) => Promise<void>;
  mainMenuItems: any[];
  activeRole?: any;
}

export function MobileDashboardView({
  isModern,
  dashData,
  selectedDoctor,
  handleDoctorChange,
  consultationStatus,
  handleStatusChange,
  mainMenuItems,
  activeRole
}: MobileDashboardViewProps) {
  const router = useRouter();

  return (
    <AppFrameLayout showBottomNav>
      <div className={cn("relative flex flex-col h-full transition-all duration-500", !isModern && "bg-muted/20")}>
        <ClinicHeader
          doctors={(dashData?.doctors ?? []) as Doctor[]}
          selectedDoctor={selectedDoctor}
          onDoctorChange={handleDoctorChange}
          showLogo={true}
          consultationStatus={consultationStatus}
          onStatusChange={handleStatusChange}
          hasActiveAppointments={
            (dashData?.appointments ?? []).some((a: any) =>
              ['Pending', 'Confirmed', 'Skipped'].includes(a.status)
            )
          }
        />

        {isModern && selectedDoctor && (
          <DailyProgress 
            appointments={(dashData?.appointments ?? []).filter((a: any) => a.doctorId === selectedDoctor)} 
            className="animate-in fade-in slide-in-from-top-4 duration-700"
          />
        )}

        <main className={cn(
          "relative flex-1 flex flex-col p-6 z-10 transition-all duration-500",
          isModern ? "-mt-8" : "-mt-12 bg-gradient-to-b from-transparent to-[rgba(37,108,173,0.3)]"
        )}>
          <div className="flex flex-col flex-1 justify-center mx-auto w-full max-w-2xl px-4">
            <div className="relative flex-1 flex flex-col justify-center items-center gap-8 py-12">
              {mainMenuItems.map((item, index) => (
                <div
                  key={index}
                  onClick={item.disabled ? undefined : item.action}
                  className={cn(
                    "transition-all duration-500 ease-in-out flex flex-col items-center justify-center text-center p-8",
                    isModern 
                      ? "w-full min-h-[160px] rounded-[3rem] shadow-premium bg-white/70 backdrop-blur-md border border-white/50 flex-row justify-start text-left" 
                      : "w-full max-w-lg min-h-[180px] rounded-[2.5rem] shadow-premium bg-white border border-slate-100 flex-row justify-start text-left px-10",
                    item.disabled
                      ? 'opacity-60 cursor-not-allowed bg-slate-100/50'
                      : 'cursor-pointer hover:shadow-2xl hover:-translate-y-2 active:scale-[0.98]',
                    !isModern && item.colors
                  )}
                >
                  <div className={cn(
                    "rounded-[1.5rem] p-5 transition-all duration-500 shadow-lg", 
                    isModern ? item.colors + " shadow-primary/25 mr-6" : item.iconContainer + " mr-6"
                  )}>
                    <item.icon className={cn("h-10 w-10 text-white")} />
                  </div>
                  <div className="flex-1 flex flex-col items-start text-left">
                    <h2 className={cn(
                      "font-black leading-tight tracking-tight", 
                      isModern ? "text-slate-900 text-2xl" : "text-white text-2xl"
                    )}>
                      {item.title}
                    </h2>
                    <p className={cn(
                      "text-sm mt-1.5 font-medium", 
                      isModern ? "text-slate-500" : "text-white/80"
                    )}>
                      {item.subtitle}
                    </p>
                  </div>
                </div>
              ))}

              {['nurse', 'doctor'].includes(activeRole) && (
                <>
                  {/* Left Side: Snapshot Icon */}
                  <button
                    onClick={() => router.push('/day-snapshot')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-8 z-50 group"
                    aria-label="Snapshot"
                  >
                    <div className={cn(
                      "relative w-20 h-20 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center",
                      isModern 
                        ? "bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/30" 
                        : "bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-white/20"
                    )}>
                      <BarChart3 className="h-8 w-8 text-white drop-shadow-lg" strokeWidth={2.5} />
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                         <span className={cn("text-[10px] font-black uppercase tracking-widest", isModern ? "text-slate-400" : "text-white/60")}>Snapshot</span>
                      </div>
                    </div>
                  </button>

                  {/* Right Side: Break Icon */}
                  <button
                    onClick={() => selectedDoctor && router.push(`/schedule-break?doctor=${selectedDoctor}`)}
                    className={cn(
                       "absolute right-0 top-1/2 -translate-y-1/2 translate-x-8 z-50 group",
                       !selectedDoctor && "opacity-50 pointer-events-none"
                    )}
                    aria-label="Break"
                  >
                    <div className={cn(
                      "relative w-20 h-20 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center",
                      isModern 
                        ? "bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/30" 
                        : "bg-gradient-to-br from-amber-600 to-amber-800 border-2 border-white/20"
                    )}>
                      <Coffee className="h-8 w-8 text-white drop-shadow-lg scale-x-[-1]" strokeWidth={2.5} />
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                         <span className={cn("text-[10px] font-black uppercase tracking-widest", isModern ? "text-slate-400" : "text-white/60")}>Break</span>
                      </div>
                    </div>
                  </button>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </AppFrameLayout>
  );
}
