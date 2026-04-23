'use client';

import { motion } from 'framer-motion';
import { UserCheck, DoorOpen } from 'lucide-react';
import { useLiveToken } from '@/contexts/LiveTokenContext';

export const CabinDoorAlert = () => {
    const { language } = useLiveToken();

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] bg-emerald-500 flex flex-col items-center justify-center p-8 text-white overflow-hidden"
        >
            {/* Pulsing Background Rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.div 
                    animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute w-96 h-96 border-4 border-white/30 rounded-full"
                />
                <motion.div 
                    animate={{ scale: [1, 2], opacity: [0.2, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    className="absolute w-96 h-96 border-2 border-white/20 rounded-full"
                />
            </div>

            <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="relative z-10 flex flex-col items-center text-center space-y-8"
            >
                <div className="relative">
                    <div className="absolute inset-0 bg-white blur-3xl opacity-30 rounded-full scale-150"></div>
                    <div className="relative bg-white text-emerald-600 p-8 rounded-full shadow-2xl">
                        <DoorOpen className="w-24 h-24" />
                    </div>
                </div>

                <div className="space-y-4">
                    <h1 className="text-5xl font-black tracking-tighter leading-tight">
                        {language === 'ml' ? 'നിങ്ങളുടെ ഊഴം!' : 'YOU ARE NEXT!'}
                    </h1>
                    <p className="text-xl font-bold text-emerald-50 opacity-90 max-w-xs">
                        {language === 'ml' 
                            ? 'ദയവായി ഡോക്ടറുടെ മുറിയുടെ മുന്നിൽ നിൽക്കുക.' 
                            : 'Please stand by the cabin door. Doctor is ready for you.'}
                    </p>
                </div>

                <div className="pt-8">
                    <motion.div
                        animate={{ y: [0, 10, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-3xl px-8 py-4"
                    >
                        <div className="flex items-center gap-3">
                            <UserCheck className="w-6 h-6" />
                            <span className="text-lg font-black uppercase tracking-widest">
                                {language === 'ml' ? 'തയ്യാറാവുക' : 'Get Ready'}
                            </span>
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        </motion.div>
    );
};
