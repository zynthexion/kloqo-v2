'use client';

import { Hourglass, UserCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useLiveToken } from '@/contexts/LiveTokenContext';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export const AppointmentStatusCard = () => {
    const {
        yourAppointment,
        t,
        language,
        isAppointmentToday,
        isConfirmedAppointment,
        isPendingAppointment,
        isSkippedAppointment,
        isReportingPastDue,
        reportingCountdownLabel,
        doctorStatusInfo,
        handleConfirmArrivalInline,
        quadrant,
        originalReportByTime,
        liveDelay
    } = useLiveToken() as any;
    
    const isHome = quadrant === 'OUT_HOME' || quadrant === 'IN_HOME';

    if (!yourAppointment) return null;

    const isPending = yourAppointment.status === 'Pending';
    const isOut = quadrant === 'OUT_HOME' || quadrant === 'OUT_CLINIC';
    const isClinic = quadrant === 'OUT_CLINIC' || quadrant === 'IN_CLINIC';

    return (
        <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full"
        >
            <div className="relative overflow-hidden bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-4 shadow-2xl">
                {/* 🚩 DYNAMIC BANNER ZONE */}
                <div className="mb-4">
                    {quadrant === 'OUT_HOME' && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            <p className="text-[10px] font-bold text-amber-400">
                                {language === 'ml' ? 'സെഷൻ താൽക്കാലികമായി നിർത്തിയിരിക്കുന്നു' : 'Session Temporarily Paused'}
                            </p>
                        </div>
                    )}
                    {quadrant === 'OUT_CLINIC' && (
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <AlertCircle className="w-4 h-4 text-rose-500" />
                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
                                    {language === 'ml' ? 'ഡോക്ടർ സ്ഥലത്തില്ല' : 'Doctor Away'}
                                </p>
                            </div>
                            <p className="text-xs font-bold text-rose-400/90 leading-tight">
                                {doctorStatusInfo?.awayReason || (language === 'ml' ? 'അത്യാവശ്യമായി ഒരിടം വരെ പോകേണ്ടി വന്നു.' : 'Doctor is attending an emergency.')}
                            </p>
                        </div>
                    )}
                    {quadrant === 'IN_HOME' && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                                {language === 'ml' ? 'സെഷൻ നടക്കുന്നു' : 'Session Active'}
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-center space-y-4">
                    {/* Patient Info & Token Badge */}
                    <div className="w-full flex items-center justify-between gap-4">
                        <div className="flex-grow">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">PATIENT</p>
                            <h2 className="text-lg font-bold text-white tracking-tight truncate max-w-[120px]">
                                {yourAppointment.patientName}
                            </h2>
                        </div>

                        <div className="relative group">
                            <div className="relative bg-gradient-to-br from-slate-200 via-white to-slate-300 border border-white/20 rounded-xl px-4 py-1.5 flex flex-col items-center shadow-lg">
                                <span className="text-[8px] font-bold text-slate-500 tracking-widest leading-none mb-0.5">TOKEN</span>
                                <span className="text-2xl font-black text-slate-900 tracking-tighter leading-none">
                                    {yourAppointment.tokenNumber}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Arrival Status & Action Zone */}
                    <div className="w-full space-y-4">
                        {isConfirmedAppointment ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-center gap-3 py-2 bg-primary/10 border border-primary/20 rounded-xl">
                                    <UserCheck className="w-4 h-4 text-primary" />
                                    <span className="text-xs font-bold text-primary uppercase tracking-wide">
                                        {language === 'ml' ? 'നിങ്ങൾ റിപ്പോർട്ട് ചെയ്തു' : 'Arrived & Verified'}
                                    </span>
                                </div>
                                
                                {quadrant === 'OUT_CLINIC' && (
                                    <motion.div 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-2"
                                    >
                                        <p className="text-[10px] font-bold text-slate-300 leading-relaxed">
                                            {language === 'ml' 
                                                ? 'നിങ്ങളുടെ സ്ഥാനം സുരക്ഷിതമാണ്. അടുത്തുള്ള ചായക്കടയിലോ മറ്റോ പോകണമെന്നുണ്ടെങ്കിൽ പോകാവുന്നതാണ്. തിരക്ക് തുടങ്ങുമ്പോൾ ഞങ്ങൾ അറിയിക്കാം.'
                                                : 'Your spot is safely locked. Feel free to step out for a tea. We will notify you before consultations resume.'}
                                        </p>
                                    </motion.div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4 w-full">
                                {/* Only show the Report By row if NOT in a Home quadrant (since it's the Hero metric there) */}
                                {!isHome && (isPending || isSkippedAppointment) && isAppointmentToday && (
                                    <div className={cn(
                                        "flex items-center justify-between p-3 rounded-xl border transition-all",
                                        isReportingPastDue ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-white/5 border-white/10 text-slate-300"
                                    )}>
                                        <div className="flex items-center gap-2">
                                            <Hourglass className={cn("w-4 h-4", isReportingPastDue && "animate-spin-slow")} />
                                            <span className="text-[10px] font-bold uppercase tracking-widest">
                                                {language === 'ml' ? 'റിപ്പോർട്ട് ചെയ്യുക' : 'Report By'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-lg font-black">{reportingCountdownLabel}</span>
                                        </div>
                                    </div>
                                )}

                                {isPending && isAppointmentToday && !isOut && (
                                    <div className="relative group">
                                        <div className="absolute -inset-1 bg-primary/30 blur-lg rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity animate-pulse"></div>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button className="relative w-full bg-primary hover:bg-primary/90 text-white font-black h-16 rounded-[1.5rem] shadow-xl shadow-primary/20 text-lg tracking-tight overflow-hidden">
                                                    <UserCheck className="mr-3 h-6 w-6" />
                                                    {language === 'ml' ? 'ഞാൻ എത്തി' : 'I Have Arrived'}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="w-[90%] rounded-[2rem] bg-slate-900 border-white/10 text-white">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="text-2xl font-bold">
                                                        {language === 'ml' ? 'നിങ്ങൾ എത്തിക്കഴിഞ്ഞോ?' : 'Confirm Arrival?'}
                                                    </AlertDialogTitle>
                                                    <AlertDialogDescription className="text-slate-400">
                                                        {language === 'ml' 
                                                            ? 'ക്ലിനിക്കിൽ റിപ്പോർട്ട് ചെയ്തതിനുശേഷം മാത്രം ഇത് ക്ലിക്ക് ചെയ്യുക.' 
                                                            : 'Only check-in if you are physically present at the clinic.'}
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter className="gap-3">
                                                    <AlertDialogCancel className="rounded-2xl h-14 bg-white/5 border-white/10 text-white hover:bg-white/10">
                                                        {language === 'ml' ? 'അല്ല' : 'Cancel'}
                                                    </AlertDialogCancel>
                                                    <AlertDialogAction 
                                                        onClick={handleConfirmArrivalInline}
                                                        className="rounded-2xl h-14 bg-primary font-bold text-white hover:bg-primary/90"
                                                    >
                                                        {language === 'ml' ? 'അതെ, ഞാൻ എത്തി' : 'Yes, I Am Here'}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                )}

                                {isSkippedAppointment && isAppointmentToday && (
                                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-4">
                                        <AlertCircle className="w-6 h-6 text-red-500 mt-1" />
                                        <div>
                                            <p className="font-bold text-red-400">
                                                {language === 'ml' ? 'സ്കിപ്പ് ചെയ്യപ്പെട്ടു' : 'Token Skipped'}
                                            </p>
                                            <p className="text-red-400/70 text-xs mt-1 leading-relaxed">
                                                {language === 'ml' 
                                                    ? 'റിപ്പോർട്ട് ചെയ്യാത്തതിനാൽ ടോക്കൺ സ്കിപ്പ് ചെയ്യപ്പെട്ടു. ഉടൻ റിപ്പോർട്ട് ചെയ്യുക.' 
                                                    : 'Your token was skipped. Report to the clinic immediately to reactivate.'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
