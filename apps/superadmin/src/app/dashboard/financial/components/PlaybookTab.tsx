'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, DollarSign } from 'lucide-react';

export function PlaybookTab({ pnlProjections, metrics, pricing, assumptions }: any) {
  return (
    <div className="space-y-8 animate-in fade-in transition-all duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Efficiency Scores */}
        <Card className="bg-slate-50 border-blue-100">
          <CardHeader className="p-4">
            <CardTitle className="text-sm text-muted-foreground">LTV / CAC Ratio</CardTitle>
            <div className="text-2xl font-bold text-blue-600">{pnlProjections.efficiency.ltvCac?.toFixed(1) || '0.0'}x</div>
          </CardHeader>
        </Card>
        <Card className="bg-slate-50 border-emerald-100">
          <CardHeader className="p-4">
            <CardTitle className="text-sm text-muted-foreground">Payback Period</CardTitle>
            <div className="text-2xl font-bold text-emerald-600">{pnlProjections.efficiency.payback?.toFixed(1) || '0.0'} Mo</div>
          </CardHeader>
        </Card>
        <Card className="bg-slate-50 border-purple-100">
          <CardHeader className="p-4">
            <CardTitle className="text-sm text-muted-foreground">Proj. Gross Margin</CardTitle>
            <div className="text-2xl font-bold text-purple-600">{Math.round(pnlProjections.ruleOf40)}%</div>
          </CardHeader>
        </Card>
      </div>

      <Card className="bg-slate-900 text-white border-none shadow-lg">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2"><Shield className="h-5 w-5 text-blue-400" /> Unit Economics</CardTitle>
        </CardHeader>
        <CardContent>
           <div className="space-y-4">
            <div className="flex justify-between border-b border-slate-700 pb-2">
              <span className="text-slate-400">Monthly Revenue (Per Clinic)</span>
              <span className="font-bold">₹{(pricing.subscription + (45 * 25 * pricing.tokenFee)).toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="font-bold underline">Contribution Margin</span>
              <span className="text-xl font-black text-blue-400">₹{((pricing.subscription + (45 * 25 * pricing.tokenFee)) - ((45 * 25 * assumptions.smsCost) + 100)).toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle>12-Month P&L & Burn Projection</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-bold">Month</TableHead>
                  <TableHead className="text-right font-bold">Clinics</TableHead>
                  <TableHead className="text-right font-bold text-blue-600">Revenue</TableHead>
                  <TableHead className="text-right font-bold text-red-600">Burn (OpEx)</TableHead>
                  <TableHead className="text-right font-bold">Net Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pnlProjections.projection.map((row: any) => (
                  <TableRow key={row.month}>
                     <TableCell className="font-medium">{row.month}</TableCell>
                     <TableCell className="text-right">{row.clinics}</TableCell>
                     <TableCell className="text-right font-semibold">₹{Math.round(row.revenue).toLocaleString()}</TableCell>
                     <TableCell className="text-right text-red-600">₹{Math.round(row.opex).toLocaleString()}</TableCell>
                     <TableCell className={`text-right font-bold ${row.profit >= 0 ? 'text-green-600' : 'text-red-700'}`}>₹{Math.round(row.profit).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
