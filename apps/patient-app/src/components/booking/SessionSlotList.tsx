'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { SessionSlot } from '@/hooks/use-booking-capacity';

interface SessionSlotListProps {
    sessionSlots: SessionSlot[];
    selectedSlot: Date | null;
    onSlotSelect: (slot: Date) => void;
    slotsLoading: boolean;
    isAdvanceCapacityReached: boolean;
    t: any;
}

export function SessionSlotList({
    sessionSlots, selectedSlot, onSlotSelect, slotsLoading, isAdvanceCapacityReached, t
}: SessionSlotListProps) {
    if (slotsLoading && sessionSlots.length === 0) {
        return (
            <div className="space-y-3 px-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
        );
    }

    return (
        <div className="space-y-4 px-2">
            <div className="flex justify-between items-center">
                <h2 className="font-bold text-lg">{t.bookAppointment.selectTime}</h2>
                {slotsLoading && <Loader2 className="animate-spin h-5 w-5 text-primary" />}
            </div>

            {isAdvanceCapacityReached && !slotsLoading && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    Advance booking capacity has been reached. No slots available.
                </div>
            )}

            <div className="space-y-3">
                {sessionSlots.map((session, sIdx) => (
                    <div key={sIdx} className="space-y-3">
                        {session.subsessions.map((sub, ssIdx) => {
                            const available = sub.slots.some(s => s.status === 'available');
                            const firstAvail = sub.slots.find(s => s.status === 'available');
                            const isSelected = firstAvail && selectedSlot?.getTime() === firstAvail.time.getTime();

                            return (
                                <button
                                    key={ssIdx}
                                    type="button"
                                    onClick={() => available && firstAvail && onSlotSelect(firstAvail.time)}
                                    disabled={!available || slotsLoading}
                                    className={cn(
                                        "w-full p-4 rounded-lg text-left transition-all duration-200 border-2",
                                        available ? "bg-[#ffc98b] border-[#ffc98b] cursor-pointer" : "bg-muted border-transparent opacity-50 cursor-not-allowed",
                                        isSelected && "ring-4 ring-primary ring-offset-2"
                                    )}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className={cn("font-semibold text-base", !available && "text-muted-foreground line-through")}>
                                                {sub.title}
                                            </span>
                                            {available && (
                                                <span className="text-xs text-gray-700 mt-1">
                                                    {sub.slots.filter(s => s.status === 'available').length} slots available
                                                </span>
                                            )}
                                        </div>
                                        {isSelected && <span className="text-primary font-bold">✓</span>}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>

            {sessionSlots.length === 0 && !slotsLoading && (
                <p className="text-muted-foreground text-center py-8">
                    {isAdvanceCapacityReached ? 'Booking capacity reached.' : 'No sessions available for this date.'}
                </p>
            )}
        </div>
    );
}
