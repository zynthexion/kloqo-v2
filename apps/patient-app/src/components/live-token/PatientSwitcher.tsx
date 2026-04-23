'use client';

import { useRouter } from 'next/navigation';
import { useLiveToken } from '@/contexts/LiveTokenContext';
import { getReportByTimeLabel, cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';

export const PatientSwitcher = () => {
    const {
        uniquePatientAppointments,
        yourAppointment,
        language,
        clinics,
        doctors,
    } = useLiveToken();
    const router = useRouter();

    if (uniquePatientAppointments.length <= 1) return null;

    return (
        <div className="w-full mb-6">
            <div className="flex items-center gap-2 mb-3 px-6">
                <Users className="w-3 h-3 text-slate-500" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {language === 'ml' ? 'പ്രൊഫൈൽ മാറ്റുക' : 'Switch Profile'}
                </p>
            </div>

            <div className="flex overflow-x-auto gap-3 px-6 pb-2 no-scrollbar">
                {uniquePatientAppointments.map((appt, index) => {
                    const isSelected = yourAppointment?.id === appt.id;
                    const apptClinic = clinics.find(c => c.id === appt.clinicId);
                    const isClassic = apptClinic?.tokenDistribution === 'classic';
                    
                    return (
                        <motion.button
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: index * 0.05 }}
                            key={appt.id}
                            onClick={() => router.push(`/live-token/${appt.id}`)}
                            className={cn(
                                "relative shrink-0 flex flex-col justify-center min-w-[140px] max-w-[160px] rounded-2xl p-3 border transition-all duration-300",
                                isSelected
                                    ? "bg-primary border-primary/50 shadow-[0_10px_20px_rgba(var(--primary),0.2)]"
                                    : "bg-white/5 border-white/5 hover:bg-white/10"
                            )}
                        >
                            <h3 className={cn(
                                "text-xs font-bold truncate mb-1",
                                isSelected ? "text-white" : "text-slate-300"
                            )}>
                                {appt.patientName}
                            </h3>
                            
                            <div className="flex items-center gap-1.5">
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded-md text-[9px] font-black",
                                    isSelected ? "bg-white/20 text-white" : "bg-white/5 text-slate-500"
                                )}>
                                    {isClassic 
                                        ? `#${appt.classicTokenNumber?.toString().padStart(3, '0') || '---'}` 
                                        : appt.tokenNumber || '---'}
                                </span>
                                {isSelected && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                                )}
                            </div>

                            {isSelected && (
                                <div className="absolute -top-1 -right-1">
                                    <div className="bg-emerald-500 w-2.5 h-2.5 rounded-full border-2 border-primary shadow-sm"></div>
                                </div>
                            )}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
};
