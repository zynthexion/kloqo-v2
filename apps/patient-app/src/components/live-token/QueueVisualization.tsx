import { Users, Star, Clock } from 'lucide-react';
import { useLiveToken } from '@/contexts/LiveTokenContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export const QueueVisualization = () => {
    const {
        quadrant,
        isYourTurn,
        patientsAhead,
        currentTokenAppointment,
        yourAppointment,
        estimatedWaitTime,
        reportingCountdownLabel,
        doctorStatusInfo,
        t,
        language,
        liveDelay
    } = useLiveToken() as any;

    const isHome = quadrant === 'OUT_HOME' || quadrant === 'IN_HOME';
    const isOut = quadrant === 'OUT_HOME' || quadrant === 'OUT_CLINIC';

    return (
        <div className="w-full h-full flex flex-col items-center justify-center py-4">
            {/* 🛸 NOW CONSULTING PILL (Only in Flow Mode) */}
            <AnimatePresence mode="wait">
                {!isOut && currentTokenAppointment && (
                    <motion.div
                        key={currentTokenAppointment?.id}
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="mb-4 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full px-6 py-2 flex items-center gap-3 shadow-2xl shadow-primary/20"
                    >
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {t.liveToken.nowInside}
                            </span>
                        </div>
                        <span className="text-xl font-black text-primary tracking-tighter">
                            {currentTokenAppointment?.tokenNumber || '---'}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 🌋 CENTRAL HERO METRIC */}
            <div className="relative flex items-center justify-center w-full">
                {/* Background Glows */}
                <div className={cn(
                    "absolute inset-0 blur-[120px] rounded-full scale-150 transition-colors duration-1000",
                    isOut ? "bg-amber-500/10" : "bg-primary/5"
                )} />
                
                <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={cn(
                        "relative z-10 h-60 w-60 rounded-full border backdrop-blur-3xl flex flex-col items-center justify-center shadow-2xl overflow-hidden transition-all duration-700",
                        isOut ? "border-amber-500/20 bg-amber-500/5" : "border-white/10 bg-white/5"
                    )}
                >
                    {/* Inner Decorative Rings */}
                    <div className={cn(
                        "absolute inset-0 border rounded-full scale-[0.8] opacity-50",
                        isOut ? "border-amber-500/20" : "border-primary/20"
                    )} />
                    <div className={cn(
                        "absolute inset-0 border rounded-full scale-[0.6] opacity-30",
                        isOut ? "border-amber-500/10" : "border-primary/10"
                    )} />

                    {isYourTurn ? (
                        <div className="flex flex-col items-center text-center px-6">
                            <Star className="h-12 w-12 text-primary fill-primary mb-4 animate-bounce" />
                            <h2 className="text-4xl font-black text-white leading-tight uppercase tracking-tighter">
                                {language === 'ml' ? 'നിങ്ങളുടെ ഊഴം!' : 'IT\'S YOUR TURN'}
                            </h2>
                        </div>
                    ) : isHome ? (
                        <div className="flex flex-col items-center text-center px-6">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3">REPORT BY</p>
                            <span className={cn(
                                "font-black text-white tracking-tighter leading-none mb-4",
                                (reportingCountdownLabel?.length || 0) > 15 ? "text-4xl" : "text-6xl"
                            )}>
                                {reportingCountdownLabel || '---'}
                            </span>
                            {!isOut && (
                                <div className="space-y-2 flex flex-col items-center">
                                    <div className="bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20">
                                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest">SESSION ACTIVE</p>
                                    </div>
                                    {liveDelay >= 10 && (
                                        <div className="bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 flex items-center gap-1.5">
                                            <Clock className="w-3 h-3 text-amber-500" />
                                            <p className="text-[9px] font-black text-amber-500 uppercase">
                                                +{Math.floor(liveDelay / 10) * 10}m DELAY
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-center px-6">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">AHEAD</p>
                            <span className="text-8xl font-black text-white tracking-tighter leading-none">
                                {patientsAhead}
                            </span>
                            <div className={cn(
                                "mt-4 flex items-center gap-2 px-4 py-1.5 rounded-full border",
                                isOut ? "bg-amber-500/10 border-amber-500/20" : "bg-primary/10 border-primary/20"
                            )}>
                                <Clock className={cn("h-3.5 w-3.5", isOut ? "text-amber-500" : "text-primary")} />
                                <span className={cn("text-sm font-black", isOut ? "text-amber-500" : "text-primary")}>
                                    {isOut ? (language === 'ml' ? 'കണക്കാക്കുന്നു...' : 'Calculating...') : `~${estimatedWaitTime}m`}
                                </span>
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Remove context message section to avoid redundancy */}
        </div>
    );
};
