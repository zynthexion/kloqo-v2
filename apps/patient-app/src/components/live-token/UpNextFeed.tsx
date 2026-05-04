'use client';

import { motion } from 'framer-motion';
import { useLiveToken } from '@/contexts/LiveTokenContext';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

export const UpNextFeed = () => {
    const { masterQueue, yourAppointment, language, t } = useLiveToken() as any;

    // Show the slots provided by the backend
    const upNext = masterQueue.slice(0, 11);

    if (upNext.length === 0) return null;

    const getStatusStyle = (appt: any, isYou: boolean) => {
        if (isYou) return "bg-primary border-primary/50 shadow-xl shadow-primary/20 scale-105 z-10";
        
        switch (appt.status) {
            case 'InConsultation':
                return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
            case 'Confirmed':
                return "bg-blue-500/10 border-blue-500/30 text-blue-400";
            case 'Pending':
                return "bg-amber-500/10 border-amber-500/30 text-amber-400";
            case 'Empty':
                return "bg-white/5 border-dashed border-white/10 opacity-50";
            default:
                return "bg-white/5 border-white/10";
        }
    };

    const getStatusLabel = (appt: any, isYou: boolean, index: number) => {
        if (isYou) return language === 'ml' ? 'നിങ്ങൾ' : 'YOU';
        if (appt.status === 'InConsultation') return t.liveToken?.inside || 'INSIDE';
        if (appt.status === 'Empty') return t.liveToken?.expectingPatient || 'EXPECTING';
        return `#${index + 1}`;
    };

    return (
        <div className="w-full mt-6">
            <div className="flex items-center gap-2 mb-3 px-2">
                <User className="w-3 h-3 text-slate-500" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {t.liveToken?.queueStatus || 'QUEUE STATUS'}
                </p>
            </div>
            
            <div 
                className="flex gap-3 overflow-x-auto pb-4 no-scrollbar scroll-smooth snap-x snap-mandatory"
            >
                {upNext.map((appt: any, index: number) => {
                    const isYou = appt.id === yourAppointment?.id;
                    const isEmpty = appt.status === 'Empty';
                    
                    return (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            key={appt.id}
                            className={cn(
                                "shrink-0 snap-center flex flex-col items-center justify-center w-24 h-28 rounded-3xl border transition-all duration-300",
                                getStatusStyle(appt, isYou)
                            )}
                        >
                            <span className={cn(
                                "text-[9px] font-black mb-1.5 uppercase tracking-widest text-center px-1",
                                isYou ? "text-white/70" : "text-slate-500"
                            )}>
                                {getStatusLabel(appt, isYou, index)}
                            </span>
                            
                            {isEmpty ? (
                                <div className="flex flex-col items-center">
                                    <div className="w-6 h-6 rounded-full border border-white/10 flex items-center justify-center mb-1">
                                        <div className="w-1 h-1 rounded-full bg-white/20 animate-pulse" />
                                    </div>
                                    <span className="text-[8px] text-white/20 font-bold uppercase">Slot {(appt.slotIndex ?? 0) + 1}</span>
                                </div>
                            ) : (
                                <span className={cn(
                                    "text-xl font-black tracking-tighter",
                                    isYou ? "text-white" : "text-inherit"
                                )}>
                                    {appt.tokenNumber}
                                </span>
                            )}
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};
