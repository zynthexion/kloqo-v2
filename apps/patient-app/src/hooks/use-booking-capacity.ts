'use client';

import { useCapacityCalculator } from './booking/use-capacity-calculator';
import { useSlotBuilder } from './booking/use-slot-builder';
import type { Doctor, Appointment, SessionSlot } from '@kloqo/shared';

export type { SessionSlot };


interface UseBookingCapacityProps {
    doctor: Doctor | null;
    selectedDate: Date;
    allAppointments: Appointment[];
    allBookedSlots: number[];
    currentTime: Date;
    t: any;
    language: string;
}

/**
 * useBookingCapacity (Orchestrator)
 * 
 * Modularized version that delegates logic to specialized hooks.
 * Simplifies the original 670-line monolith into a clean interface.
 */
export function useBookingCapacity({
    doctor,
    selectedDate,
    allAppointments,
    allBookedSlots,
    currentTime,
    t,
    language
}: UseBookingCapacityProps) {
    
    // 1. Calculate Capacity Limits
    const { 
        isAdvanceCapacityReached, 
        maximumAdvanceTokens, 
        activeAdvanceCount 
    } = useCapacityCalculator({
        doctor,
        selectedDate,
        allAppointments,
        currentTime
    });

    // 2. Build Visible Slots
    const { 
        sessionSlots, 
        totalAvailableSlots, 
        isSlotBooked 
    } = useSlotBuilder({
        doctor,
        selectedDate,
        allBookedSlots,
        currentTime,
        isAdvanceCapacityReached,
        t,
        language
    });

    // 3. Derived remaining count
    const remainingCapacity = Math.max(0, maximumAdvanceTokens - activeAdvanceCount);

    return {
        isAdvanceCapacityReached,
        sessionSlots,
        remainingCapacity,
        totalAvailableSlots,
        isSlotBooked
    };
}
