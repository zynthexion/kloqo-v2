'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Building2, DollarSign, PieChart as PieChartIcon, Heart, Target, Info } from 'lucide-react';
import { GLOSSARY } from '../constants'; // Assumed extracted constants

const InfoTooltip = ({ term }: { term: string }) => (
  <div className="group relative inline-flex ml-1 align-middle">
    <Info className="h-3 w-3 text-muted-foreground/50 cursor-help hover:text-primary transition-colors" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none text-center">
      {GLOSSARY[term] || "Financial metric for analysis."}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
    </div>
  </div>
);

export function FinancialSidebar({ 
  assumptions, setAssumptions, 
  pricing, setPricing,
  marketAssumptions, setMarketAssumptions
}: any) {
  return (
    <aside className="lg:col-span-1 space-y-6">
      <div className="sticky top-8 space-y-6">
        <Card className="border-none shadow-md bg-slate-900 text-white overflow-hidden">
          <CardHeader className="pb-2 border-b border-slate-800">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-400" />
              Global Controller
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs text-balance">Any change here updates everything.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-8 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar">
            {/* Sections from the original file's aside... */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-500 flex items-center gap-2">
                <Building2 className="h-3 w-3" /> Growth & Scale
              </h4>
              <div className="space-y-3">
                {/* ... (Starting Clinics, MoM Growth, Churn, etc) */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <label className="flex items-center">Starting Clinics <InfoTooltip term="Starting Clinics" /></label>
                    <span className="font-bold text-white">{assumptions.startingClinics}</span>
                  </div>
                  <input type="range" min="1" max="100" value={assumptions.startingClinics} onChange={e => setAssumptions({ ...assumptions, startingClinics: Number(e.target.value) })} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                </div>
                {/* ... more controllers truncated for this artifact */}
              </div>
            </div>
            
            {/* Revenue Model Section */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
               <h4 className="text-xs font-black uppercase text-slate-500 flex items-center gap-2">
                <DollarSign className="h-3 w-3" /> Revenue Model
              </h4>
              {/* ... (Subscription, Token Fee, etc) */}
            </div>
          </CardContent>
        </Card>

        <div className="bg-blue-600/10 border-blue-500/20 text-blue-400 p-4 rounded-lg">
          <p className="text-[10px] leading-relaxed">
            Every change here instantly recalibrates the entire Investor Playbook & Market models.
          </p>
        </div>
      </div>
    </aside>
  );
}
