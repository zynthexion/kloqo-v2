'use client';

import { Hourglass, UserCheck, Clock, Forward } from 'lucide-react';
import { useLiveToken } from '@/contexts/LiveTokenContext';

export const BottomMessage = () => {
    const {
        language,
        t,
        isConfirmedAppointment,
        isDoctorIn,
        patientsAhead,
        estimatedWaitTime,
        breakMinutes,
        isYourTurn,
        shouldShowQueueInfo,
        queueState,
        doctorStatusInfo,
        confirmedEstimatedWaitMinutes,
        isAppointmentToday,
        daysUntilAppointment,
        yourAppointment,
        reportingCountdownLabel,
        isReportingPastDue,
        hoursUntilArrivalReminder,
        minutesUntilArrivalReminder,
        reportingLabel
    } = useLiveToken() as any;

    if (!yourAppointment) return null;

    // Helper logic extracted from the original BottomMessage or the returned render logic
    const renderContent = () => {
        // Option Not Available fallback
        if (shouldShowQueueInfo && !isConfirmedAppointment) {
            return (
                <div className="w-full text-center py-4">
                    <div className="bg-amber-100 text-amber-800 rounded-2xl px-4 py-3 flex flex-col items-center justify-center gap-2">
                        <Hourglass className="w-6 h-6" />
                        <div className="flex flex-col items-center justify-center gap-1">
                            <span className="text-sm font-medium">
                                {language === 'ml' ? 'ഏകദേശ കാത്തിരിപ്പ് സമയം' : 'Estimated waiting time'}
                            </span>
                            <span className="font-bold text-base">
                                {language === 'ml' ? 'ഈ ക്ലിനിക്കിൽ ഈ സൗകര്യം ലഭ്യമല്ല' : 'Option is not available for this clinic'}
                            </span>
                        </div>
                    </div>
                </div>
            );
        }

        // It's your turn
        if (shouldShowQueueInfo && isYourTurn) {
            const hasBreak = queueState?.nextBreakDuration && queueState.nextBreakDuration > 0;
            return (
                <div className="w-full text-center py-4">
                    <div className={`${hasBreak ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'} rounded-full px-4 py-3 flex items-center justify-center gap-2`}>
                        {hasBreak ? <Clock className="w-6 h-6" /> : <UserCheck className="w-6 h-6" />}
                        <span className="font-bold text-lg">
                            {hasBreak
                                ? (language === 'ml' ? `ഡോക്ടർ വിശ്രമത്തിലാണ് (${queueState.nextBreakDuration} മിനിറ്റ്)` : `Doctor is on break (${queueState.nextBreakDuration} mins)`)
                                : t.liveToken.itsYourTurn}
                        </span>
                    </div>
                </div>
            );
        }

        // You are next
        if (shouldShowQueueInfo && patientsAhead === 1) {
            const hasBreak = queueState?.nextBreakDuration && queueState.nextBreakDuration > 0;
            return (
                <div className="w-full text-center py-4">
                    <div className={`${hasBreak ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'} rounded-full px-4 py-3 flex items-center justify-center gap-2`}>
                        {hasBreak ? <Clock className="w-6 h-6" /> : <Forward className="w-6 h-6" />}
                        <span className="font-bold text-lg">
                            {hasBreak
                                ? (language === 'ml' ? `അടുത്തത് നിങ്ങളാണ് (വിശ്രമത്തിന് ശേഷം)` : `You are next! (After break)`)
                                : (language === 'ml' ? 'അടുത്തത് നിങ്ങളാണ്' : (t.liveToken.youAreNext || 'You are next'))}
                        </span>
                    </div>
                </div>
            );
        }

        // Multiple patients ahead
        if (shouldShowQueueInfo && patientsAhead > 1) {
            const mins = Math.max(1, Math.round(estimatedWaitTime));
            const waitTitle = language === 'ml' ? 'ഏകദേശ കാത്തിരിപ്പ് സമയം' : 'Estimated waiting time';
            
            return (
                <div className="w-full text-center py-4">
                    <div className="bg-green-100 text-green-800 animate-pulse rounded-full px-4 py-3 flex flex-col items-center justify-center gap-1">
                        <Hourglass className="w-6 h-6" />
                        <div className="flex flex-col items-center justify-center">
                            <span className="text-sm font-medium">{waitTitle}</span>
                            <span className="font-bold text-lg">{mins} {t.liveToken.minutes}</span>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    return renderContent();
};
