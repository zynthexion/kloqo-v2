'use client';

import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Calendar, Zap, MapPin, Clock, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Doctor } from '@kloqo/shared';
import { cn } from '@/lib/utils';

interface BookingChoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    doctor: Doctor | null;
    distance: number | null; // in meters
    onWalkIn: (doctor: Doctor) => void;
    onAdvanced: (doctor: Doctor) => void;
    t: any;
}

export function BookingChoiceModal({
    isOpen,
    onClose,
    doctor,
    distance,
    onWalkIn,
    onAdvanced,
    t
}: BookingChoiceModalProps) {
    if (!doctor) return null;

    const isNearby = distance !== null && distance <= 150;

    // 🔍 DEBUG: Walk-in disabled diagnosis
    console.log('[BookingChoiceModal] distance (meters):', distance);
    console.log('[BookingChoiceModal] isNearby:', isNearby);
    console.log('[BookingChoiceModal] doctor.latitude:', (doctor as any).latitude);
    console.log('[BookingChoiceModal] doctor.longitude:', (doctor as any).longitude);
    if (distance === null) {
        console.warn('[BookingChoiceModal] Walk-in DISABLED — distance is null. Either userLocation is missing or doctor has no GPS coords.');
    } else if (distance > 150) {
        console.warn(`[BookingChoiceModal] Walk-in DISABLED — too far: ${distance.toFixed(0)}m (limit: 150m).`);
    }
    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="bottom" className="rounded-t-[3rem] px-6 pt-10 pb-12 border-none bg-background/95 backdrop-blur-xl">
                <SheetHeader className="text-left mb-8">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="h-1.5 w-12 bg-slate-200 rounded-full mx-auto absolute top-4 left-1/2 -translate-x-1/2" />
                        <SheetTitle className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                            {t.bookingChoice.title}
                        </SheetTitle>
                    </div>
                    <SheetDescription className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">
                        {t.bookingChoice.subTitle}
                    </SheetDescription>
                </SheetHeader>

                <div className="grid gap-4">
                    {/* Option 1: Consult Today (Walk-in) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <button
                            onClick={() => isNearby && onWalkIn(doctor)}
                            className={cn(
                                "w-full text-left p-6 rounded-[2.5rem] transition-all duration-300 relative group overflow-hidden border-2",
                                isNearby 
                                    ? "bg-primary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/40 shadow-xl shadow-primary/5" 
                                    : "bg-slate-50 border-slate-100 opacity-60 grayscale cursor-not-allowed"
                            )}
                        >
                            {/* Glow Effect for nearby */}
                            {isNearby && (
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />
                            )}

                            <div className="flex items-start justify-between relative z-10">
                                <div className="flex gap-4">
                                    <div className={cn(
                                        "h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner",
                                        isNearby ? "bg-primary text-white" : "bg-slate-200 text-slate-400"
                                    )}>
                                        <Zap className="w-7 h-7 fill-current" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                                            {t.bookingChoice.consultToday}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-tight max-w-[200px]">
                                            {t.bookingChoice.consultTodayDesc}
                                        </p>
                                    </div>
                                </div>
                                {isNearby && (
                                    <div className="bg-green-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest animate-pulse shadow-lg shadow-green-500/20">
                                        {t.bookingChoice.nearbyBadge}
                                    </div>
                                )}
                            </div>

                            {!isNearby && (
                                <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-red-50 rounded-xl border border-red-100">
                                    <MapPin className="w-3 h-3 text-red-500" />
                                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                                        {t.bookingChoice.tooFarWarning}
                                    </span>
                                </div>
                            )}

                            {isNearby && (
                                <div className="mt-4 flex items-center justify-between text-primary font-black uppercase text-[10px] tracking-widest">
                                    <span>{distance?.toFixed(0)}m {t.consultToday.metersAway}</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            )}
                        </button>
                    </motion.div>

                    {/* Option 2: Book for Later (Advanced) */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <button
                            onClick={() => onAdvanced(doctor)}
                            className="w-full text-left p-6 rounded-[2.5rem] bg-white border-2 border-slate-100 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 group relative"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex gap-4">
                                    <div className="h-14 w-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shadow-inner group-hover:bg-slate-200 transition-colors">
                                        <Calendar className="w-7 h-7" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                                            {t.bookingChoice.bookLater}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-tight max-w-[200px]">
                                            {t.bookingChoice.bookLaterDesc}
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-1 transition-all mt-4" />
                            </div>
                        </button>
                    </motion.div>
                </div>

                {!isNearby && (
                    <p className="mt-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-[280px] mx-auto">
                        {t.bookingChoice.mustBeNearbyWarning}
                    </p>
                )}
            </SheetContent>
        </Sheet>
    );
}
