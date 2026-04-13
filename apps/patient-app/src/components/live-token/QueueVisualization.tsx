'use client';

import { Users, Star } from 'lucide-react';
import { useLiveToken } from '@/contexts/LiveTokenContext';

export const QueueVisualization = () => {
    const {
        shouldShowQueueVisualization,
        isYourTurn,
        patientsAhead,
        masterQueue,
        clinicData,
        currentTokenAppointment,
        isSkippedAppointment,
        yourAppointment,
        t,
        isConfirmedAppointment
    } = useLiveToken() as any;

    if (!shouldShowQueueVisualization || isYourTurn || patientsAhead === 0 || masterQueue.length === 0) {
        return null;
    }

    const displayedPatientsAhead = patientsAhead;

    return (
        <div className="relative flex flex-col items-center justify-center space-y-4">
            {!(isSkippedAppointment && clinicData?.tokenDistribution === 'classic') && (
                <>
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground">{t.liveToken.currentToken}</p>
                        <p className="text-6xl font-bold" style={{ color: 'hsl(var(--token-current))' }}>
                            {clinicData?.tokenDistribution === 'classic'
                                ? (currentTokenAppointment?.classicTokenNumber ? `#${currentTokenAppointment.classicTokenNumber.toString().padStart(3, '0')}` : 'N/A')
                                : (currentTokenAppointment?.tokenNumber || 'N/A')
                            }
                        </p>
                    </div>

                    {!(clinicData?.tokenDistribution === 'classic' && !isConfirmedAppointment) && (
                        <div className="relative h-24 w-4 flex items-end justify-center">
                            <div className="absolute h-full w-2 rounded-full bg-gray-200"></div>
                            <div className="absolute bottom-0 w-2 rounded-full" style={{
                                height: `${Math.min(100, (displayedPatientsAhead / 5) * 100)}%`,
                                backgroundColor: 'hsl(var(--token-current))'
                            }}></div>
                        </div>
                    )}
                </>
            )}

            {!(clinicData?.tokenDistribution === 'classic' && !isConfirmedAppointment) && (
                <div className={(isSkippedAppointment && clinicData?.tokenDistribution === 'classic')
                    ? "relative flex flex-col items-center justify-center bg-gray-100 rounded-lg p-3 shadow-md w-20 h-20 mx-auto"
                    : "absolute right-0 top-1/2 -translate-y-1/2 transform flex flex-col items-center justify-center bg-gray-100 rounded-lg p-3 shadow-md w-20 h-20"
                }>
                    <p className="text-sm font-semibold">{t.liveToken.patientsAhead}</p>
                    <p className="text-3xl font-bold">{displayedPatientsAhead}</p>
                    {displayedPatientsAhead > 0 && yourAppointment?.isPriority ? (
                        <Star className="w-5 h-5 text-amber-600 fill-amber-600" />
                    ) : (
                        <Users className="w-5 h-5 text-muted-foreground" />
                    )}
                </div>
            )}

            {!(clinicData?.tokenDistribution === 'classic' && !isConfirmedAppointment) && (
                <div className="text-center">
                    <p className="text-sm text-muted-foreground">{t.liveToken.yourToken} ({yourAppointment?.patientName})</p>
                    <div className="flex items-center justify-center gap-2">
                        <p className="text-6xl font-bold" style={{ color: 'hsl(var(--token-your))' }}>
                            {clinicData?.tokenDistribution === 'classic'
                                ? (yourAppointment?.classicTokenNumber ? `#${yourAppointment.classicTokenNumber.toString().padStart(3, '0')}` : '--')
                                : yourAppointment?.tokenNumber
                            }
                        </p>
                        {yourAppointment?.isPriority && <Star className="w-8 h-8 text-amber-500 fill-amber-500" />}
                    </div>
                </div>
            )}
        </div>
    );
};
