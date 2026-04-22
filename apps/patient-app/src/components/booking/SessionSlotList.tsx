'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { getClinic12hTimeString } from '@kloqo/shared-core';
import { subMinutes } from 'date-fns';
import { CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BackendSlot {
    time: string;         // ISO string
    slotIndex: number;
    sessionIndex: number;
    isAvailable: boolean;
    status: 'available' | 'booked' | 'reserved' | 'past' | 'blocked' | 'break';
}

interface SessionSlotListProps {
    /** Flat array of DecoratedSlots from /public-booking/doctors/:id/slots */
    backendSlots: BackendSlot[];
    selectedSlot: any | null;
    onSlotSelect: (slot: any) => void;
    slotsLoading: boolean;
    isAdvanceCapacityReached: boolean;
    t: any;
}

/**
 * SessionSlotList (Backend-Driven)
 *
 * Renders the slot selection UI for the patient-app booking flow.
 * All slot logic (buffer, 85/15 reserve, break hiding) is enforced by the backend.
 * This component only:
 *   1. Groups the flat backend slots by sessionIndex.
 *   2. Shows one selectable card per session ("First Available" rule).
 *   3. Shows session time range and a count of available slots.
 *
 * Patient UX decisions:
 *   - Breaks are shown as "Unavailable" — patients do not see break reasons.
 *   - Every session with an available slot is shown (no session hiding).
 *   - Only the first available slot is selectable (density first, no Swiss-cheese).
 */
export function SessionSlotList({
    backendSlots,
    selectedSlot,
    onSlotSelect,
    slotsLoading,
    isAdvanceCapacityReached,
    t
}: SessionSlotListProps) {
    if (slotsLoading && backendSlots.length === 0) {
        return (
            <div className="space-y-4 px-2">
                <Skeleton className="h-5 w-32 rounded" />
                {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
            </div>
        );
    }

    // Group slots by sessionIndex
    const sessionMap = new Map<number, BackendSlot[]>();
    backendSlots.forEach(slot => {
        const list = sessionMap.get(slot.sessionIndex) ?? [];
        list.push(slot);
        sessionMap.set(slot.sessionIndex, list);
    });

    const sessions = Array.from(sessionMap.entries()).sort(([a], [b]) => a - b);

    return (
        <div className="space-y-5 px-2">
            <div className="flex justify-between items-center">
                <h2 className="font-bold text-lg">{t.bookAppointment?.selectTime ?? 'Select Time'}</h2>
                {slotsLoading && (
                    <span className="text-xs text-muted-foreground animate-pulse">Updating…</span>
                )}
            </div>

            {isAdvanceCapacityReached && !slotsLoading && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    All sessions are fully booked for this date.
                </div>
            )}

            {sessions.length === 0 && !slotsLoading && (
                <p className="text-muted-foreground text-center py-10 text-sm">
                    No sessions found for this date. Try a different day.
                </p>
            )}

            {sessions.map(([sessionIdx, slots]) => {
                const availableSlots = slots.filter(s => s.status === 'available');
                const firstAvailable = availableSlots[0];
                const isFull = availableSlots.length === 0;

                // Session time range from first/last slot
                const firstSlotTime = new Date(slots[0].time);
                const lastSlotTime  = new Date(slots[slots.length - 1].time);
                const sessionStart  = getClinic12hTimeString(firstSlotTime);
                const sessionEnd    = getClinic12hTimeString(lastSlotTime);

                // Reporting time = first available slot - 15m
                const reportingTime = firstAvailable
                    ? getClinic12hTimeString(subMinutes(new Date(firstAvailable.time), 15))
                    : null;

                const isSelected = firstAvailable
                    && selectedSlot?.slotIndex === firstAvailable.slotIndex;

                return (
                    <button
                        key={sessionIdx}
                        type="button"
                        onClick={() => !isFull && firstAvailable && onSlotSelect(firstAvailable)}
                        disabled={isFull || slotsLoading}
                        className={cn(
                            "w-full p-5 rounded-2xl text-left transition-all duration-200 border-2 group",
                            isFull
                                ? "bg-muted border-transparent opacity-50 cursor-not-allowed"
                                : isSelected
                                    ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.01]"
                                    : "bg-card border-border hover:border-primary/50 hover:shadow-md cursor-pointer"
                        )}
                    >
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                {/* Session label */}
                                <p className={cn(
                                    "text-[10px] font-black uppercase tracking-widest",
                                    isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                                )}>
                                    Session {sessionIdx + 1}
                                </p>

                                {/* Time range */}
                                <p className="text-base font-bold leading-tight">
                                    {sessionStart}
                                    <span className={cn("mx-1.5 text-xs", isSelected ? "opacity-70" : "text-muted-foreground")}>—</span>
                                    {sessionEnd}
                                </p>

                                {/* First available slot time HIDDEN per user request - focusing on Arrive By only */}
                                {/* {!isFull && firstAvailable && (
                                    <p className={cn(
                                        "text-sm font-medium flex items-center gap-1.5 mt-1",
                                        isSelected ? "text-primary-foreground" : "text-primary"
                                    )}>
                                        <Clock className="h-3.5 w-3.5" />
                                        First slot at {getClinic12hTimeString(new Date(firstAvailable.time))}
                                    </p>
                                )} */}

                                {/* Reporting time */}
                                {reportingTime && !isFull && (
                                    <p className={cn(
                                        "text-xs",
                                        isSelected ? "text-primary-foreground/60" : "text-muted-foreground"
                                    )}>
                                        Please arrive by <strong>{reportingTime}</strong>
                                    </p>
                                )}

                                {isFull && (
                                    <p className="text-xs text-destructive font-semibold mt-1">
                                        Fully booked
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-col items-end gap-2">
                                {isSelected && (
                                    <CheckCircle2 className="h-6 w-6 text-primary-foreground animate-in zoom-in-50 duration-200" />
                                )}
                                {!isFull && (
                                    <span className={cn(
                                        "text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full",
                                        isSelected
                                            ? "bg-white/20 text-primary-foreground"
                                            : "bg-primary/10 text-primary"
                                    )}>
                                        {availableSlots.length} open
                                    </span>
                                )}
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
