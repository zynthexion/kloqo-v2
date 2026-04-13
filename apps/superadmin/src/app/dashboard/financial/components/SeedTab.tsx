'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowUpRight, Target } from 'lucide-react';

export function SeedTab({ seedScenario, setSeedScenario, seedFundraising, setSeedFundraising, pricing }: any) {
  return (
    <div className="space-y-8 animate-in fade-in transition-all duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-lg bg-white">
          <CardHeader className="bg-slate-50 rounded-t-xl border-b pb-4">
            <CardTitle className="flex items-center gap-2"><ArrowUpRight className="h-5 w-5 text-emerald-600" /> Early Traction Modeler</CardTitle>
            <CardDescription>Simulate your first 6 months of clinic adoption.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-slate-500">Paying Clinics</label>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-slate-900">{seedScenario.paying}</span>
                  <span className="text-sm text-slate-500 mb-1">clinics</span>
                </div>
                <input type="range" min="0" max="20" value={seedScenario.paying} onChange={e => setSeedScenario({ ...seedScenario, paying: Number(e.target.value) })} className="w-full h-2 bg-emerald-100 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-slate-500">Beta/Testing</label>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-slate-900">{seedScenario.testing}</span>
                  <span className="text-sm text-slate-500 mb-1">clinics</span>
                </div>
                <input type="range" min="0" max="50" value={seedScenario.testing} onChange={e => setSeedScenario({ ...seedScenario, testing: Number(e.target.value) })} className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-500" />
              </div>
            </div>
            
            <div className="rounded-lg bg-slate-50 p-4 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Current MRR (Traction):</span>
                <span className="font-bold text-emerald-600">₹{((seedScenario.paying * seedScenario.pilotPrice) + (seedScenario.paying * 45 * 25 * 0.5)).toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-slate-900 text-white">
          <CardHeader className="border-b border-slate-800 pb-4">
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-purple-400" /> Seed Valuation</CardTitle>
            <CardDescription className="text-slate-400 text-xs">Based on Ask Amount vs Dilution</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500">Ask Amount (₹)</label>
                <div className="text-3xl font-bold">₹{(seedFundraising.askAmount / 100000).toFixed(1)} Lakhs</div>
                <input type="range" min="1000000" max="25000000" step="500000" value={seedFundraising.askAmount} onChange={e => setSeedFundraising({ ...seedFundraising, askAmount: Number(e.target.value) })} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500">Equity Offered (%)</label>
                <div className="text-3xl font-bold text-purple-400">{seedFundraising.equityOffered}%</div>
                <input type="range" min="1" max="30" step="0.5" value={seedFundraising.equityOffered} onChange={e => setSeedFundraising({ ...seedFundraising, equityOffered: Number(e.target.value) })} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500" />
              </div>
            </div>
            <div className="pt-4 border-t border-slate-800">
               <div className="text-xs text-slate-500 uppercase mb-1">Post-Money Valuation</div>
               <div className="text-xl font-bold text-white">₹{((seedFundraising.askAmount / seedFundraising.equityOffered) * 100 / 10000000).toFixed(2)} Cr</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
