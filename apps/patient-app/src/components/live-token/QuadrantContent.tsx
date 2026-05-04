'use client';

import { useLiveToken } from '@/contexts/LiveTokenContext';
import { QueueVisualization } from './QueueVisualization';
import { AppointmentStatusCard } from './AppointmentStatusCard';
import { UpNextFeed } from './UpNextFeed';
import { PatientSwitcher } from './PatientSwitcher';
import { CabinDoorAlert } from './CabinDoorAlert';
import { AnimatePresence, motion } from 'framer-motion';

export const QuadrantContent = () => {
    const { 
        patientsAhead, 
        isConfirmedAppointment, 
        yourAppointment, 
        quadrant 
    } = useLiveToken() as any;

    if (!yourAppointment) return null;

    // Position #1 Trigger: Only for confirmed patients who are exactly next
    const isNext = patientsAhead === 0 && isConfirmedAppointment;

    return (
        <AnimatePresence mode="wait">
            {isNext ? (
                <CabinDoorAlert key="next-alert" />
            ) : (
                <motion.div
                    key="main-content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full max-w-sm h-full flex flex-col items-center justify-between pb-6 px-4"
                >
                    {/* Switcher at the very top */}
                    <div className="w-full pt-2">
                        <PatientSwitcher />
                    </div>

                    {/* Hero Visualization - Flexibly shrinks to fit */}
                    <div className="w-full flex-[1.5] min-h-0 flex items-center justify-center relative">
                        <QueueVisualization />
                    </div>

                    {/* Footer Section - Takes up exactly what it needs */}
                    <div className="w-full flex-none space-y-6 mt-auto">
                        <AppointmentStatusCard />
                        
                        <div className="w-full pb-2">
                            <UpNextFeed />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
