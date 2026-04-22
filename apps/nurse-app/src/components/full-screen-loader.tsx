'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface FullScreenLoaderProps {
    isOpen: boolean;
}

export function FullScreenLoader({ isOpen }: FullScreenLoaderProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-sm touch-none animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-4">
                <div className="relative">
                    <Loader2 className="h-12 w-12 animate-spin text-theme-blue" />
                    <div className="absolute inset-0 bg-theme-blue/20 blur-xl rounded-full animate-pulse" />
                </div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Processing Booking...</p>
            </div>
        </div>
    );
}
