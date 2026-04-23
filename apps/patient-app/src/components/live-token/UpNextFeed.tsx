'use client';

import { motion } from 'framer-motion';
import { useLiveToken } from '@/contexts/LiveTokenContext';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

export const UpNextFeed = () => {
    const { masterQueue, yourAppointment, language } = useLiveToken();

    // Show only the next 10 people in line, excluding the person currently being consulted
    const upNext = masterQueue.slice(1, 11);

    if (upNext.length === 0) return null;

    return (
        <div className="w-full mt-6">
            <div className="flex items-center gap-2 mb-3 px-2">
                <User className="w-3 h-3 text-slate-500" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {language === 'ml' ? 'അടുത്തത്' : 'UP NEXT'}
                </p>
            </div>
            
            <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                {upNext.map((appt, index) => {
                    const isYou = appt.id === yourAppointment?.id;
                    
                    return (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            key={appt.id}
                            className={cn(
                                "shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-2xl border transition-all duration-300",
                                isYou 
                                    ? "bg-primary border-primary/50 shadow-lg shadow-primary/20 scale-105 z-10" 
                                    : "bg-white/5 border-white/5"
                            )}
                        >
                            <span className={cn(
                                "text-[9px] font-black mb-1",
                                isYou ? "text-white/70" : "text-slate-500"
                            )}>
                                {isYou ? (language === 'ml' ? 'നിങ്ങൾ' : 'YOU') : `#${index + 1}`}
                            </span>
                            <span className={cn(
                                "text-lg font-black tracking-tighter",
                                isYou ? "text-white" : "text-slate-300"
                            )}>
                                {appt.tokenNumber}
                            </span>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};
