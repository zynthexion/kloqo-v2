'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BookingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function BookingDrawer({ 
  isOpen, 
  onClose, 
  title, 
  subtitle, 
  children 
}: BookingDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-2 bottom-2 right-2 w-full max-w-[500px] bg-white rounded-[2.5rem] shadow-2xl z-[101] flex flex-col overflow-hidden border border-white/20"
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                   <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                   <h2 className="text-xl font-black text-slate-900 tracking-tight">{title}</h2>
                </div>
                {subtitle && <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">{subtitle}</p>}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all hover:rotate-90"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content Container (Scrollable) */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50 scrollbar-none">
                <div className="p-8">
                    {children}
                </div>
            </div>
            
            {/* Minimal Footer Decoration */}
            <div className="h-4 bg-gradient-to-t from-slate-100/50 to-transparent pointer-events-none" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
