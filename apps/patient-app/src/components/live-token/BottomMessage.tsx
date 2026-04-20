'use client';

import { UserCheck, Clock } from 'lucide-react';
import { useLiveToken } from '@/contexts/LiveTokenContext';

export const BottomMessage = () => {
    const {
        language,
        t,
        isConfirmedAppointment,
        patientsAhead,
        isYourTurn,
        shouldShowQueueInfo,
        queueState,
        yourAppointment,
    } = useLiveToken() as any;

    if (!yourAppointment) return null;

    const renderContent = () => {
        // 🚨 CRITICAL: It's your turn
        if (shouldShowQueueInfo && isYourTurn) {
            const hasBreak = queueState?.nextBreakDuration && queueState.nextBreakDuration > 0;
            return (
                <div className="w-full text-center py-4 animate-bounce">
                    <div className={`${hasBreak ? 'bg-amber-100 text-amber-800' : 'bg-primary text-white shadow-lg'} rounded-3xl px-6 py-4 flex items-center justify-center gap-3`}>
                        {hasBreak ? <Clock className="w-6 h-6" /> : <UserCheck className="w-6 h-6" />}
                        <div className="text-left">
                            <span className="block text-sm font-black uppercase tracking-widest leading-none mb-1 opacity-80">
                                {t.liveToken.actionRequired}
                            </span>
                            <span className="font-black text-lg leading-tight">
                                {hasBreak
                                    ? (language === 'ml' ? `${t.liveToken.doctorOnBreak} (${queueState.nextBreakDuration} min)` : `${t.liveToken.doctorOnBreak} (${queueState.nextBreakDuration}m)`)
                                    : t.liveToken.itsYourTurn}
                            </span>
                        </div>
                    </div>
                </div>
            );
        }

        // ☕️ NOTIFICATION: Doctor on Break
        const hasBreak = queueState?.nextBreakDuration && queueState.nextBreakDuration > 0;
        if (shouldShowQueueInfo && hasBreak) {
            return (
                <div className="w-full text-center py-4">
                    <div className="bg-amber-50 text-amber-700 border border-amber-100 rounded-3xl px-6 py-4 flex items-center gap-4">
                        <div className="bg-amber-100 p-2 rounded-xl">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <span className="block text-xs font-bold uppercase tracking-widest opacity-60">{t.liveToken.systemNotice}</span>
                            <span className="font-bold text-sm">
                                {t.liveToken.doctorOnShortBreak}
                            </span>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    return renderContent();
};
