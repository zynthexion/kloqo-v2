'use client';

import { useState } from 'react';
import { Search, Loader2, Check, Download, FileText, ExternalLink } from 'lucide-react';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

// Refactored Hooks & Components
import { usePrescriptionFulfillment } from '@/hooks/usePrescriptionFulfillment';
import { PrescriptionHeader } from '@/components/prescriptions/PrescriptionHeader';
import { PrescriptionCard } from '@/components/prescriptions/PrescriptionCard';
import { DispenseModal, AbandonModal } from '@/components/prescriptions/FulfillmentModals';
import { LogOutDialog } from '@/components/layout/LogOutDialog';

export default function PharmacistPrescriptionsPage() {
  const { theme } = useTheme();
  const isModern = theme === 'modern';
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const {
    user, logout, activeTab, setActiveTab, queue, 
    searchQuery, setSearchQuery, searchResults,
    loadingQueue, loadingSearch, viewerUrl, setViewerUrl,
    dispenseTarget, setDispenseTarget, billValue, setBillValue,
    dispenseNotes, setDispenseNotes, dispensing,
    abandonTarget, setAbandonTarget, abandonReason, setAbandonReason,
    abandoning, printIframeRef, handleSearch, confirmDispense,
    confirmAbandon, handleBrandedPrint
  } = usePrescriptionFulfillment();

  return (
    <AppFrameLayout showBottomNav={false}>
      <div className="flex flex-col h-full bg-slate-50/20 font-pt-sans">
        <PrescriptionHeader 
          clinicName={(user as any)?.clinicName} 
          userName={user?.name || ''} 
          onLogout={() => setShowLogoutConfirm(true)} 
        />

        <div className="max-w-[1600px] w-full mx-auto p-4 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-white p-3 rounded-[2rem] shadow-premium border border-slate-100">
            <div className="flex flex-1 gap-2">
              {(['queue', 'search'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 py-3 px-6 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300",
                    activeTab === tab ? "bg-theme-blue text-white shadow-xl shadow-theme-blue/20" : "bg-slate-50 text-slate-400"
                  )}
                >
                  {tab === 'queue' ? '⚡ Active Fulfillment' : '🔍 Secure Search'}
                </button>
              ))}
            </div>

            {activeTab === 'search' && (
              <div className="flex-1 flex gap-2 animate-in slide-in-from-right-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Search Patient Record..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-theme-blue/10"
                  />
                </div>
                <button onClick={handleSearch} disabled={loadingSearch} className="px-6 bg-theme-blue text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-theme-blue/30">
                  {loadingSearch ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                </button>
              </div>
            )}
          </div>

          <main className="pb-24">
            {activeTab === 'queue' ? (
              loadingQueue ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                  <Loader2 className="h-10 w-10 animate-spin text-theme-blue" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Syncing Fulfillment Queue...</p>
                </div>
              ) : queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[3rem] border border-dashed border-slate-200">
                  <div className="h-24 w-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                    <Check className="h-10 w-10 text-emerald-400" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900">Zero Pending Orders</h2>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4">
                  {queue.map(appt => (
                    <PrescriptionCard key={appt.id} appt={appt} showActions isModern={isModern} onView={setViewerUrl} onPrint={handleBrandedPrint} onDispense={setDispenseTarget} onAbandon={setAbandonTarget} />
                  ))}
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {searchResults.map(appt => (
                  <PrescriptionCard key={appt.id} appt={appt} isModern={isModern} onView={setViewerUrl} onPrint={handleBrandedPrint} onDispense={setDispenseTarget} onAbandon={setAbandonTarget} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      <DispenseModal target={dispenseTarget} billValue={billValue} setBillValue={setBillValue} notes={dispenseNotes} setNotes={setDispenseNotes} isDispensing={dispensing} onConfirm={confirmDispense} onClose={() => setDispenseTarget(null)} />
      <AbandonModal target={abandonTarget} reason={abandonReason} setReason={setAbandonReason} isAbandoning={abandoning} onConfirm={confirmAbandon} onClose={() => setAbandonTarget(null)} />
      <LogOutDialog isOpen={showLogoutConfirm} setIsOpen={setShowLogoutConfirm} onLogout={logout} />
      
      {viewerUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setViewerUrl(null)}>
          <div className="flex items-center justify-between p-4 bg-black/40 backdrop-blur-md shrink-0">
            <button onClick={() => setViewerUrl(null)} className="text-white font-black text-sm uppercase tracking-widest">✕ Close Preview</button>
            <div className="flex gap-3">
              <a 
                href={viewerUrl} download target="_blank" rel="noreferrer" 
                className="flex items-center gap-1.5 text-white bg-white/20 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest" 
                onClick={e => e.stopPropagation()}
              >
                <Download className="h-3.5 w-3.5" /> Download PDF
              </a>
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
            {/iPhone|iPad|Android/i.test(navigator.userAgent) ? (
              <div className="flex flex-col items-center justify-center gap-6 p-8 text-center">
                <div className="h-24 w-24 rounded-full bg-theme-blue/10 flex items-center justify-center border border-theme-blue/20">
                  <FileText className="h-12 w-12 text-theme-blue" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Prescription Ready</h3>
                  <p className="text-xs text-slate-400 font-bold mt-2 uppercase tracking-widest max-w-xs">
                    Tap below to view the full prescription with letterhead
                  </p>
                </div>
                <a
                  href={viewerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 h-14 px-8 bg-theme-blue text-white font-black rounded-2xl shadow-xl shadow-theme-blue/30 transition-all active:scale-95"
                >
                  <ExternalLink className="h-5 w-5" />
                  Open PDF
                </a>
              </div>
            ) : (
              <iframe
                src={`${viewerUrl}#toolbar=0&view=FitH`}
                className="w-full h-full border-none rounded-xl"
                title="Prescription PDF"
              />
            )}
          </div>
        </div>
      )}

      <iframe ref={printIframeRef} style={{ display: 'none' }} title="Print" />
    </AppFrameLayout>
  );
}
