'use client';

import { usePrescriptionState } from '@/hooks/use-prescription-state';
import { RxCard } from '@/components/prescriptions/RxCard';
import { PrescriptionTabs } from '@/components/prescriptions/PrescriptionTabs';
import { DispenseModal, AbandonModal, RxViewer } from '@/components/prescriptions/Modals';
import { Loader2, FileText, Search, X } from 'lucide-react';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * PharmacistPrescriptionsPage Orchestrator
 * Modularized dashboard for pharmacist queues, handling dispense validation,
 * leakage tracking (abandonment), and historical Rx search.
 */
export default function PharmacistPrescriptionsPage() {
  const { theme } = useTheme();
  const isModern = theme === 'modern';
  const {
    activeTab, setActiveTab,
    queue, searchResults,
    loadingQueue, loadingSearch,
    searchQuery, setSearchQuery,
    viewerUrl, setViewerUrl,
    dispenseTarget, setDispenseTarget, billValue, setBillValue, dispensing,
    abandonTarget, setAbandonTarget, abandonReason, setAbandonReason, abandoning,
    handleSearch, confirmDispense, confirmAbandon
  } = usePrescriptionState();

  return (
    <AppFrameLayout showBottomNav>
      <div className="flex flex-col h-full bg-slate-50 font-pt-sans">
        <header className="relative p-6 pb-12 text-white rounded-b-[3rem] bg-theme-blue overflow-hidden shadow-2xl shadow-theme-blue/30 sticky top-0 z-50">
          <div className="absolute top-[-50px] left-[-50px] w-[150px] h-[150px] bg-white/10 rounded-full blur-2xl" />
          <div className="absolute top-[30px] right-[-80px] w-[200px] h-[200px] border-[20px] border-white/5 rounded-full" />
          <div className="relative z-10">
            <h1 className="text-2xl font-black uppercase tracking-tight leading-none">Rx Queue</h1>
            <p className="text-[10px] font-black opacity-60 mt-2 uppercase tracking-[0.2em]">
              {loadingQueue ? 'Syncing...' : `${queue.length} Pending Actions`}
            </p>
          </div>
        </header>

        <PrescriptionTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="flex-1 overflow-y-auto p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {activeTab === 'queue' ? (
            loadingQueue ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-theme-blue/30" strokeWidth={3} />
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Hydrating Queue...</p>
              </div>
            ) : queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-400 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 mx-2">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <FileText className="h-10 w-10 text-slate-200" />
                </div>
                <h3 className="font-black text-slate-800 uppercase tracking-tight">Queue Clear</h3>
                <p className="text-[10px] uppercase font-bold text-slate-400 mt-2 tracking-widest">Waiting for next patient...</p>
              </div>
            ) : (
              queue.map(appt => (
                <RxCard 
                  key={appt.id} appt={appt} showActions 
                  onView={setViewerUrl} 
                  onDispense={setDispenseTarget} 
                  onAbandon={setAbandonTarget} 
                  isModern={isModern} 
                />
              ))
            )
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2 sticky top-0 bg-slate-50 z-10 pb-2">
                <div className="relative flex-1 group">
                  <input
                    type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Patient Name..."
                    className="w-full h-14 pl-5 pr-12 rounded-2xl border-2 border-slate-100 bg-white text-sm font-black text-slate-800 placeholder:text-slate-300 focus:border-theme-blue transition-all"
                  />
                  <Search className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-200 group-focus-within:text-theme-blue transition-colors" strokeWidth={3} />
                </div>
              </div>

              {loadingSearch ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-10 w-10 animate-spin text-theme-blue/20" />
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map(appt => (
                  <RxCard 
                    key={appt.id} appt={appt} 
                    onView={setViewerUrl} 
                    onDispense={setDispenseTarget} 
                    onAbandon={setAbandonTarget} 
                    isModern={isModern} 
                  />
                ))
              ) : searchQuery ? (
                <div className="text-center py-20 text-slate-400">
                  <X className="h-12 w-12 mx-auto mb-4 opacity-10" />
                  <p className="text-[10px] uppercase font-black tracking-widest leading-loose">No matches found for &ldquo;{searchQuery}&rdquo;</p>
                </div>
              ) : (
                <div className="text-center py-24 bg-white/50 rounded-[3rem] border-2 border-dashed border-slate-100">
                  <Search className="h-12 w-12 mx-auto mb-6 text-slate-100" />
                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em]">Enter patient name to search Rx history</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {dispenseTarget && (
        <DispenseModal 
          appt={dispenseTarget} billValue={billValue} 
          onBillChange={setBillValue} onConfirm={confirmDispense} 
          onClose={() => setDispenseTarget(null)} isPending={dispensing} 
        />
      )}

      {abandonTarget && (
        <AbandonModal 
          appt={abandonTarget} reason={abandonReason} 
          onReasonSelect={setAbandonReason} onConfirm={confirmAbandon} 
          onClose={() => setAbandonTarget(null)} isPending={abandoning} 
        />
      )}

      {viewerUrl && (
        <RxViewer url={viewerUrl} onClose={() => setViewerUrl(null)} />
      )}
    </AppFrameLayout>
  );
}
