'use client';

/**
 * LiveTokenContext
 *
 * Centralizes all state for the Live Token page into a single provider.
 * This prevents prop-drilling across deeply nested sub-components and
 * ensures a single source of truth for appointment, queue, and clinic data.
 *
 * Architecture note: This context replaces the massive 15+ prop signature
 * that would have been required if sub-components were extracted without
 * a state management strategy.
 */

import React, { createContext, useContext } from 'react';
import type { Appointment, Doctor, Clinic } from '@kloqo/shared';
import type { QueueState } from '@kloqo/shared-core';

// ─── Context Shape ────────────────────────────────────────────────────────────

export interface LiveTokenContextValue {
    // Core appointment data
    yourAppointment: Appointment | null;
    allTodaysAppointments: Appointment[];
    doctors: Doctor[];
    clinics: Clinic[];
    clinicData: any | null;

    // Related entities
    yourAppointmentDoctor: Doctor | null;

    // Queue state
    queueState: QueueState | null;
    masterQueue: Appointment[];
    simulatedQueue: Appointment[];
    currentTokenAppointment: Appointment | null;
    patientsAhead: number;
    isYourTurn: boolean;

    // Live doctor state
    liveDoctor: Doctor | null;
    currentDoctor: Doctor | null;

    // Time
    currentTime: Date;

    // Date/time computed values
    isAppointmentToday: boolean;
    daysUntilAppointment: number | null;
    appointmentDate: Date;
    formattedDate: string;

    // Doctor status computed
    doctorStatusInfo: { isLate: boolean; isBreak: boolean; isAffected: boolean; awayReason?: string };
    isDoctorIn: boolean;

    // Break/delay
    breakMinutes: number;
    validBreaks: any[];
    totalDelayMinutes: number;
    estimatedDelay: number;

    // Reporting time
    reportByTimeDisplay: string;
    reportByDiffMinutes: number | null;
    reportingCountdownLabel: string | null;
    isReportingPastDue: boolean;
    hoursUntilArrivalReminder: number | null;
    minutesUntilArrivalReminder: number | null;

    // Wait time estimates
    confirmedEstimatedWaitMinutes: number;
    estimatedWaitTime: number;

    // Location & arrival state
    locationStatus: 'idle' | 'checking' | 'success' | 'error';
    locationError: string | null;
    locationDenied: boolean;
    locationCheckAttempted: boolean;
    isConfirmingInline: boolean;
    inlineError: string | null;

    // Display gating booleans
    shouldShowQueueVisualization: boolean;
    shouldShowConfirmArrival: boolean;
    shouldShowQueueInfo: boolean;
    shouldShowEstimatedWaitTime: boolean;
    isSkippedAppointment: boolean;
    isConfirmedAppointment: boolean;

    // Callbacks
    handleConfirmArrivalInline: () => Promise<void>;
    handleCancelAppointment: () => Promise<void>;

    // Family / Multi-patient
    uniquePatientAppointments: Appointment[];

    // 4-Quadrant Logic
    quadrant: 'IN_CLINIC' | 'OUT_CLINIC' | 'IN_HOME' | 'OUT_HOME';

    // i18n
    t: any;
    language: 'en' | 'ml';
    departments: any[];
}

// ─── Context Creation ─────────────────────────────────────────────────────────

const LiveTokenContext = createContext<LiveTokenContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface LiveTokenProviderProps {
    children: React.ReactNode;
    value: LiveTokenContextValue;
}

export function LiveTokenProvider({ children, value }: LiveTokenProviderProps) {
    return (
        <LiveTokenContext.Provider value={value}>
            {children}
        </LiveTokenContext.Provider>
    );
}

// ─── Consumer Hook ─────────────────────────────────────────────────────────────

/**
 * Consume the LiveTokenContext. Must be used within a LiveTokenProvider.
 * Sub-components (AppointmentStatusCard, BottomMessage, QueueVisualization)
 * use this to access only the slice of state they need, without prop drilling.
 */
export function useLiveToken(): LiveTokenContextValue {
    const context = useContext(LiveTokenContext);
    if (!context) {
        throw new Error('useLiveToken must be used within a LiveTokenProvider');
    }
    return context;
}
