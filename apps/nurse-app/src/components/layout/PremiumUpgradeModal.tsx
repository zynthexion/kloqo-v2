'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tablet, Smartphone, Sparkles, ChevronRight, LayoutGrid } from 'lucide-react';

interface PremiumUpgradeModalProps {
  onSwitchToMobile: () => void;
}

export function PremiumUpgradeModal({ onSwitchToMobile }: PremiumUpgradeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 font-pt-sans">
      <Card className="max-w-md w-full border-none shadow-2xl overflow-hidden bg-white">
        <div className="relative h-48 bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <LayoutGrid className="w-full h-full scale-150 rotate-12" />
          </div>
          <div className="relative flex flex-col items-center text-white">
            <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md mb-4 animate-bounce-slow">
              <Tablet className="h-12 w-12" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Complete Suite Feature</h2>
          </div>
          <div className="absolute top-4 right-4 bg-yellow-400 text-slate-900 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
            <Sparkles className="h-3 w-3" />
            PREMIUM
          </div>
        </div>
        
        <CardContent className="p-8 text-center">
          <h3 className="text-xl font-bold text-slate-900 mb-2">Upgrade to Unlock Tablet UI</h3>
          <p className="text-slate-500 mb-8 leading-relaxed">
            The high-end Tablet interface is part of our <span className="font-bold text-slate-900">₹1,999 Complete Suite</span> plan. 
            Currently, you are on the ₹999 Starter Scan plan.
          </p>
          
          <div className="space-y-3">
            <Button 
              onClick={onSwitchToMobile}
              className="w-full h-14 text-lg bg-primary hover:bg-blue-700 shadow-lg shadow-primary/20 group"
            >
              <Smartphone className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
              Use Mobile Version
              <ChevronRight className="ml-auto h-5 w-5 opacity-50" />
            </Button>
            
            <p className="text-xs text-slate-400 pt-4">
              Contact your clinic administrator to upgrade your plan and unlock the full tablet experience.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Add these to globals.css if not present
// @keyframes animate-bounce-slow {
//   0%, 100% { transform: translateY(-5%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }
//   50% { transform: translateY(0); animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
// }
