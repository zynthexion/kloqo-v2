'use client';

import { useState, useEffect } from 'react';
import { usePwa } from '@/lib/pwa';
import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { X, Download, Share, PlusSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function PWAInstallPrompt() {
    const { isIOS, isStandalone, isInstallable, promptInstall } = usePwa();
    const { t, language } = useLanguage();
    const [isVisible, setIsVisible] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Only show if not standalone and not dismissed in this session
        if (!isStandalone && !dismissed) {
            // Delay showing to not overwhelm the user immediately
            const timer = setTimeout(() => {
                if (isInstallable || isIOS) {
                    setIsVisible(true);
                }
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isStandalone, isInstallable, isIOS, dismissed]);

    const handleDismiss = () => {
        setIsVisible(false);
        setDismissed(true);
        // Could save to localStorage to dismiss for longer
        localStorage.setItem('pwa-prompt-dismissed', 'true');
    };

    useEffect(() => {
        const isAlreadyDismissed = localStorage.getItem('pwa-prompt-dismissed');
        if (isAlreadyDismissed) {
            setDismissed(true);
        }
    }, []);

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-20 left-4 right-4 z-[100]"
            >
                <div className="bg-white rounded-3xl shadow-2xl border border-primary/10 p-5 relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute -right-6 -top-6 h-24 w-24 bg-primary/5 rounded-full blur-2xl" />
                    
                    <button 
                        onClick={handleDismiss}
                        className="absolute right-3 top-3 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <div className="flex gap-4 items-start">
                        <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                            <img src="/icons/icon-192x192.png" alt="Kloqo" className="h-10 w-10" />
                        </div>
                        <div className="flex-grow pt-1">
                            <h3 className="font-bold text-slate-900 text-lg leading-tight">
                                {t.pwa?.installQuickAccess || 'Add Kloqo to Home Screen'}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                                {isIOS 
                                    ? (t.pwa?.installDescriptionIOS || 'Tap the share button and select "Add to Home Screen" for the best experience.')
                                    : (t.pwa?.installDescription || 'Install our app for faster booking and real-time queue updates.')
                                }
                            </p>
                        </div>
                    </div>

                    {isIOS ? (
                        <div className="mt-4 flex items-center justify-center gap-6 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex flex-col items-center gap-1">
                                <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                    <Share className="h-4 w-4 text-blue-500" />
                                </div>
                                <span className="text-[10px] font-medium text-slate-400">Share</span>
                            </div>
                            <div className="h-4 w-px bg-slate-200" />
                            <div className="flex flex-col items-center gap-1">
                                <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                    <PlusSquare className="h-4 w-4 text-slate-700" />
                                </div>
                                <span className="text-[10px] font-medium text-slate-400">Add to Home</span>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-5 flex gap-3">
                            <Button 
                                onClick={promptInstall}
                                className="flex-grow rounded-2xl h-12 bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                {t.profile?.installNow || 'Install Now'}
                            </Button>
                            <Button 
                                variant="ghost"
                                onClick={handleDismiss}
                                className="px-6 rounded-2xl h-12 text-slate-400 font-medium"
                            >
                                {t.profile?.maybeLater || 'Maybe Later'}
                            </Button>
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
