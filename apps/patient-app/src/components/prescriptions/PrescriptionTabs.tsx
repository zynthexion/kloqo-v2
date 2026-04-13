'use client';

import { cn } from '@/lib/utils';
import type { Tab } from '@/hooks/use-prescription-state';

interface PrescriptionTabsProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function PrescriptionTabs({ activeTab, onTabChange }: PrescriptionTabsProps) {
  return (
    <div className="flex px-4 pt-4 gap-2 bg-slate-50 sticky top-[72px] z-40 pb-2">
      {(['queue', 'search'] as Tab[]).map(tab => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={cn(
            "flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all",
            activeTab === tab 
              ? "bg-theme-blue text-white shadow-xl shadow-theme-blue/20 translate-y-[-2px]" 
              : "bg-white text-slate-400 border-2 border-slate-100 hover:border-slate-200"
          )}
        >
          {tab === 'queue' ? '⚡ Live Queue' : '🔍 Search Rx'}
        </button>
      ))}
    </div>
  );
}
