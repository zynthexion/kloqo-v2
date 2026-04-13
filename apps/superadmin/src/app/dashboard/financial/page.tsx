'use client';

import { useFinancialState, TabType } from './hooks/use-financial-state';
import { FinancialSidebar } from './components/FinancialSidebar';
import { OverviewTab } from './components/OverviewTab';
import { PlaybookTab } from './components/PlaybookTab';
import { SeedTab } from './components/SeedTab';
import { MarketTab } from './components/MarketTab';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { COHORT_DATA } from './constants';

export default function FinancialPage() {
  const state = useFinancialState();
  const { 
    activeTab, setActiveTab, loading, metrics, pnlProjections,
    assumptions, setAssumptions, pricing, setPricing,
    seedScenario, setSeedScenario, seedFundraising, setSeedFundraising,
    marketAssumptions, setMarketAssumptions, useOfFunds, appointments
  } = state;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-primary/20 mb-4" />
          <p className="text-muted-foreground font-medium">Calculating financial models...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-8 text-slate-900">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Financial Suite</h1>
          <p className="text-muted-foreground mt-2 text-lg">Live metrics, cohort retention, and scenario modeling.</p>
        </div>
        <div className="flex p-1 bg-muted rounded-xl gap-1 self-start flex-wrap">
          {(['overview', 'cohorts', 'seed', 'playbook', 'market', 'planning'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === tab ? 'bg-white shadow-sm text-primary' : 'hover:bg-white/50 text-muted-foreground'}`}
            >
              {tab === 'playbook' ? 'Investor Playbook' : tab === 'market' ? 'Market & Fund' : tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <FinancialSidebar 
          assumptions={assumptions} setAssumptions={setAssumptions}
          pricing={pricing} setPricing={setPricing}
          marketAssumptions={marketAssumptions} setMarketAssumptions={setMarketAssumptions}
        />

        <main className="lg:col-span-3 space-y-8">
          {activeTab === 'overview' && <OverviewTab metrics={metrics} appointments={appointments} />}
          
          {activeTab === 'playbook' && (
            <PlaybookTab 
              pnlProjections={pnlProjections} 
              metrics={metrics} 
              pricing={pricing} 
              assumptions={assumptions} 
            />
          )}

          {activeTab === 'seed' && (
            <SeedTab 
              seedScenario={seedScenario} setSeedScenario={setSeedScenario}
              seedFundraising={seedFundraising} setSeedFundraising={setSeedFundraising}
              pricing={pricing}
            />
          )}

          {activeTab === 'market' && (
            <MarketTab 
              pnlProjections={pnlProjections}
              useOfFunds={useOfFunds}
            />
          )}

          {activeTab === 'cohorts' && (
            <Card className="animate-in slide-in-from-bottom-4 transition-all duration-500 shadow-sm border-none">
              <CardHeader>
                <CardTitle>Clinic Retention Cohorts</CardTitle>
                <CardDescription>Percentage of clinics remaining active month-over-month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                   <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Cohort</TableHead>
                        <TableHead className="text-center font-bold">Size</TableHead>
                        {['M1', 'M2', 'M3', 'M4'].map(m => <TableHead key={m} className="text-center">{m}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {COHORT_DATA.map((row: any) => (
                        <TableRow key={row.month} className="hover:bg-slate-50/50">
                          <TableCell className="font-semibold text-slate-700">{row.month}</TableCell>
                          <TableCell className="text-center font-bold text-blue-600">{row.size}</TableCell>
                          <TableCell className="text-center bg-green-50 text-green-700 font-bold">{row.m1}%</TableCell>
                          <TableCell className="text-center text-slate-600">{row.m2 ? `${row.m2}%` : '-'}</TableCell>
                          <TableCell className="text-center text-slate-600">{row.m3 ? `${row.m3}%` : '-'}</TableCell>
                          <TableCell className="text-center text-slate-600">{row.m4 ? `${row.m4}%` : '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'planning' && (
            <div className="flex items-center justify-center p-20 bg-slate-50 border-2 border-dashed rounded-xl">
              <p className="text-muted-foreground flex items-center gap-2">
                <Badge variant="outline">Coming Soon</Badge>
                Refining Hiring Roadmap Split Logic...
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
