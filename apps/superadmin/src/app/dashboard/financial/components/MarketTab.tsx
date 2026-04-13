'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Target, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function MarketTab({ pnlProjections, useOfFunds }: any) {
  return (
    <div className="space-y-8 animate-in fade-in transition-all duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Market Capture Potential (India TAM/SAM)</CardTitle>
            <CardDescription>
              TAM: ₹{(pnlProjections.market.tam / 10000000).toFixed(1)} Cr | 
              SAM: ₹{(pnlProjections.market.sam / 10000000).toFixed(1)} Cr
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-500 uppercase font-bold mb-1">Total India TAM</p>
              <p className="text-2xl font-black">₹{(pnlProjections.market.tam / 10000000).toFixed(1)} Cr</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-xs text-blue-500 uppercase font-bold mb-1">Serviceable (SAM)</p>
              <p className="text-2xl font-black text-blue-700">₹{(pnlProjections.market.sam / 10000000).toFixed(1)} Cr</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-xs text-emerald-500 uppercase font-bold mb-1">Target Slice (SOM - 12mo)</p>
              <p className="text-2xl font-black text-emerald-700">₹{(pnlProjections.market.som / 10000000).toFixed(1)} Cr</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-slate-900 text-white border-none relative overflow-hidden">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-400" /> Series A Split
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(useOfFunds).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500">
                    <span>{key}</span>
                    <span className="text-blue-400">{value as number}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-blue-500 h-full" style={{ width: `${value as number}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Rule of 40 Score</p>
                <p className={`text-4xl font-black ${pnlProjections.ruleOf40 > 40 ? 'text-emerald-600' : 'text-orange-600'}`}>
                   {Math.round(pnlProjections.ruleOf40)}%
                </p>
                <Badge variant={pnlProjections.ruleOf40 > 40 ? 'default' : 'secondary'} className="mt-2">
                  {pnlProjections.ruleOf40 > 40 ? 'Venture Grade' : 'Needs Growth'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
