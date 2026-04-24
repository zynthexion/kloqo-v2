'use client';

import React from 'react';
import { useNurseDashboardContext } from '@/contexts/NurseDashboardContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { User, Power, Clock, Users, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
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

export function NurseDesktopHeader() {
  const { data, selectedDoctorId, setSelectedDoctorId, updateDoctorStatus } = useNurseDashboardContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showConfirmIn, setShowConfirmIn] = React.useState(false);
  const [isToggling, setIsToggling] = React.useState(false);
  
  const selectedDoctor = data?.doctors.find(d => d.id === selectedDoctorId);

  // Sync selectedDoctorId with URL param if missing
  React.useEffect(() => {
    const urlDocId = searchParams.get('doctor');
    if (selectedDoctorId && urlDocId !== selectedDoctorId) {
       const params = new URLSearchParams(searchParams.toString());
       params.set('doctor', selectedDoctorId);
       router.replace(`?${params.toString()}`);
    }
  }, [selectedDoctorId, searchParams, router]);

  const handleDoctorChange = (id: string) => {
    setSelectedDoctorId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set('doctor', id);
    router.replace(`?${params.toString()}`);
  };
  const consultationStatus = selectedDoctor?.consultationStatus || 'Out';

  const handleStatusToggle = async () => {
    if (!selectedDoctorId) return;
    const newStatus = consultationStatus === 'In' ? 'Out' : 'In';
    
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
    <header className="px-8 py-6 flex flex-col gap-6 bg-white/40 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-30">
      <div className="flex justify-between items-center">
        {/* Clinic & Date */}
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {data?.clinic.name || 'Kloqo Clinic'}
            </h1>
            <div className="flex items-center gap-3 text-slate-500 text-sm font-medium mt-1">
              <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-md">
                <Clock className="h-3.5 w-3.5" />
                <span>{format(new Date(), 'EEEE, dd MMM')}</span>
              </div>
              <span className="w-1 h-1 bg-slate-300 rounded-full" />
              <span>Nurse Command Center</span>
            </div>
          </div>

          {/* Quick Stats Summary */}
          <div className="flex items-center gap-4 ml-8">
             <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Arrived</span>
                <span className="text-lg font-black text-emerald-600">{data?.appointments.filter(a => ['Confirmed', 'Skipped'].includes(a.status)).length || 0}</span>
             </div>
             <div className="w-px h-8 bg-slate-200" />
             <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pending</span>
                <span className="text-lg font-black text-primary">{data?.appointments.filter(a => a.status === 'Pending').length || 0}</span>
             </div>
          </div>
        </div>

        {/* Action Toggle */}
        <div className="flex items-center gap-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={consultationStatus}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Button
                onClick={handleStatusToggle}
                className={cn(
                  "h-12 px-6 rounded-2xl gap-3 transition-all duration-500 shadow-lg",
                  consultationStatus === 'In' 
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20" 
                    : "bg-slate-200 hover:bg-slate-300 text-slate-600 shadow-slate-200/20"
                )}
              >
                <Power className={cn("h-5 w-5", consultationStatus === 'In' ? "text-white" : "text-slate-400")} />
                <span className="font-bold uppercase tracking-widest text-xs">
                  {consultationStatus === 'In' ? 'Doctor In' : 'Doctor Out'}
                </span>
              </Button>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Doctor Selection Strip - Hidden when only one doctor (Self-Managed Mode) */}
      {data?.doctors && data.doctors.length > 1 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mr-2">Assign:</span>
          {data?.doctors.map((doc) => (
            <button
              key={doc.id}
              onClick={() => handleDoctorChange(doc.id)}
              className={cn(
                "flex items-center gap-3 p-1.5 pr-4 rounded-full transition-all duration-300 border-2",
                selectedDoctorId === doc.id
                  ? "bg-white border-primary shadow-md scale-105"
                  : "bg-slate-100/50 border-transparent hover:bg-slate-100 hover:border-slate-200"
              )}
            >
              <div className="relative">
                <Avatar className="h-8 w-8 border border-white">
                  <AvatarImage src={doc.avatar} />
                  <AvatarFallback className="bg-slate-200 text-[10px]">{doc.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white",
                  doc.consultationStatus === 'In' ? "bg-emerald-500" : "bg-slate-300"
                )} />
              </div>
              <span className={cn(
                "text-xs font-bold whitespace-nowrap",
                selectedDoctorId === doc.id ? "text-slate-900" : "text-slate-500"
              )}>
                Dr. {doc.name}
              </span>
            </button>
          ))}
        </div>
      )}
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
    </header>
  );
}
