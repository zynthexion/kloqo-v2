'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  FileText, Check, Search, Download, ExternalLink, 
  Clock, Loader2, X, AlertTriangle, LogOut, 
  UserCircle, Printer, StickyNote, RotateCcw
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { apiRequest } from '@/lib/api-client';
import { Appointment } from '@kloqo/shared';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

type Tab = 'queue' | 'search';

const ABANDON_REASONS = [
  'Patient requested printout / Buying elsewhere',
  'Medicine out of stock',
  'Patient refused (Too expensive)',
  'Patient left without visiting pharmacy',
];

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val?.toDate) return val.toDate();
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export default function PharmacistPrescriptionsPage() {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const isModern = theme === 'modern';

  const [activeTab, setActiveTab] = useState<Tab>('queue');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [queue, setQueue] = useState<Appointment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Appointment[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  // Dispense modal state
  const [dispenseTarget, setDispenseTarget] = useState<Appointment | null>(null);
  const [billValue, setBillValue] = useState('');
  const [dispenseNotes, setDispenseNotes] = useState('');
  const [dispensing, setDispensing] = useState(false);

  // Abandon modal state
  const [abandonTarget, setAbandonTarget] = useState<Appointment | null>(null);
  const [abandonReason, setAbandonReason] = useState('');
  const [abandoning, setAbandoning] = useState(false);

  // Print Iframe ref
  const printIframeRef = useRef<HTMLIFrameElement>(null);

  const clinicId = user?.clinicId;

  const fetchQueue = useCallback(async () => {
    if (!clinicId) return;
    setLoadingQueue(true);
    try {
      const data = await apiRequest<Appointment[]>(`/clinic/prescriptions?clinicId=${clinicId}&pharmacyStatus=pending`);
      setQueue((data || []).sort((a, b) => {
        const aTime = toDate(a.completedAt)?.getTime() ?? 0;
        const bTime = toDate(b.completedAt)?.getTime() ?? 0;
        return aTime - bTime;
      }));
    } catch (e) { console.error(e); }
    finally { setLoadingQueue(false); }
  }, [clinicId]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const confirmDispense = async () => {
    if (!dispenseTarget) return;
    setDispensing(true);
    try {
      await apiRequest(`/prescriptions/${dispenseTarget.id}/dispense`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          billValue: billValue ? Number(billValue) : undefined,
          notes: dispenseNotes.trim() || undefined
        }),
      });
      setQueue(prev => prev.filter(a => a.id !== dispenseTarget.id));
      setDispenseTarget(null);
      setBillValue('');
      setDispenseNotes('');
      // Operational feedback only
      alert('Order Fulfilled');
    } catch (e) { console.error(e); }
    finally { setDispensing(false); }
  };

  const confirmAbandon = async () => {
    if (!abandonTarget || !abandonReason) return;
    setAbandoning(true);
    try {
      await apiRequest(`/prescriptions/${abandonTarget.id}/abandon`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: abandonReason }),
      });
      setQueue(prev => prev.filter(a => a.id !== abandonTarget.id));
      setAbandonTarget(null);
      setAbandonReason('');
    } catch (e) { console.error(e); }
    finally { setAbandoning(false); }
  };

  const handlePrint = (appt: Appointment) => {
    if (!printIframeRef.current || !appt.prescriptionUrl) return;

    const iframe = printIframeRef.current;
    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Prescription - ${appt.patientName}</title>
          <style>
            @page { margin: 10mm; size: A4; }
            body { font-family: sans-serif; margin: 0; padding: 20px; color: #1e293b; }
            header { border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; }
            .clinic-info h1 { font-size: 24px; color: #1e3a8a; margin: 0; }
            .clinic-info p { font-size: 12px; color: #64748b; margin: 2px 0; }
            .patient-meta { background: #f8fafc; padding: 15px; border-radius: 12px; margin-bottom: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border: 1px solid #e2e8f0; }
            .patient-meta div b { font-size: 10px; text-transform: uppercase; color: #94a3b8; display: block; margin-bottom: 2px; }
            .patient-meta div span { font-weight: 700; font-size: 14px; }
            .rx-container { text-align: center; }
            .rx-image { max-width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
            footer { position: fixed; bottom: 20px; left: 0; right: 0; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px; }
          </style>
        </head>
        <body>
          <header>
            <div className="clinic-info">
              <h1>${(user as any)?.clinicName || 'Digital Prescription'}</h1>
              <p>Clinical Fulfillment Record</p>
            </div>
            <div style="text-align: right">
              <div style="font-weight: 800; color: #3b82f6; font-size: 20px;">#${appt.tokenNumber || '---'}</div>
              <div style="font-size: 10px; color: #94a3b8;">${new Date().toLocaleDateString()}</div>
            </div>
          </header>

          <div class="patient-meta">
            <div><b>Patient Name</b><span>${appt.patientName}</span></div>
            <div><b>Consulting Doctor</b><span>Dr. ${appt.doctorName}</span></div>
            <div><b>Date</b><span>${toDate(appt.completedAt)?.toLocaleDateString() || '--'}</span></div>
            <div><b>Status</b><span>Order Fulfilled</span></div>
          </div>

          <div class="rx-container">
            <img src="${appt.prescriptionUrl}" class="rx-image" />
          </div>

          <footer>
            This is a computer-generated prescription fulfilled at ${(user as any)?.clinicName}. 
            Powered by Kloqo V2.
          </footer>

          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    doc.close();
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !clinicId) return;
    setLoadingSearch(true);
    try {
      const data = await apiRequest<Appointment[]>(`/clinic/prescriptions?clinicId=${clinicId}`);
      const q = searchQuery.toLowerCase();
      setSearchResults((data || []).filter(a => a.patientName?.toLowerCase().includes(q)));
    } catch (e) { console.error(e); }
    finally { setLoadingSearch(false); }
  };

  const RxCard = ({ appt, showActions = false }: { appt: Appointment; showActions?: boolean }) => {
    const completedAt = toDate(appt.completedAt);
    return (
      <div className={cn(
        "flex flex-col gap-4 p-5 rounded-3xl border border-slate-100 bg-white shadow-sm transition-all duration-300",
        "hover:shadow-2xl hover:-translate-y-1 hover:border-theme-blue/20 group",
        isModern && "glass-card border-none"
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {appt.tokenNumber && (
                <span className="text-[10px] font-black text-theme-blue bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-tighter">
                  Token #{appt.tokenNumber}
                </span>
              )}
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                appt.pharmacyStatus === 'dispensed' ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              )}>
                <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", appt.pharmacyStatus === 'dispensed' ? "bg-emerald-500" : "bg-amber-500")} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {appt.pharmacyStatus === 'dispensed' ? 'Dispensed' : 'Pending'}
                </span>
              </div>
            </div>
            <h3 className="font-black text-slate-800 text-lg leading-tight truncate group-hover:text-theme-blue transition-colors">
              {appt.patientName}
            </h3>
            <p className="text-sm text-slate-500 font-medium flex items-center gap-1 mt-0.5">
              <UserCircle className="h-3 w-3 opacity-40 lowercase" /> Dr. {appt.doctorName}
            </p>
          </div>
          {completedAt && !isNaN(completedAt.getTime()) && (
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                <Clock className="h-3 w-3" />
                <span>{formatDistanceToNow(completedAt, { addSuffix: true })}</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
          <button
            onClick={() => setViewerUrl(appt.prescriptionUrl || null)}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all ring-1 ring-slate-200/50"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View Rx
          </button>
          
          <div className="flex gap-2">
            <a
              href={appt.prescriptionUrl}
              download target="_blank" rel="noreferrer"
              className="flex-1 flex items-center justify-center p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all ring-1 ring-slate-200/50"
              title="Download Original"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
            <button
              onClick={() => handlePrint(appt)}
              className="flex-1 flex items-center justify-center p-2.5 rounded-2xl bg-theme-blue/10 hover:bg-theme-blue/20 text-theme-blue transition-all"
              title="Branded Print"
            >
              <Printer className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {showActions && (
          <div className="flex gap-2">
            <button
              onClick={() => { setDispenseTarget(appt); setBillValue(''); }}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
            >
              <Check className="h-4 w-4" /> COMPLETE FULFILLMENT
            </button>
            <button
              onClick={() => { setAbandonTarget(appt); setAbandonReason(''); }}
              className="flex items-center justify-center p-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-500 transition-all"
              title="Mark as abandoned"
            >
              <AlertTriangle className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <AppFrameLayout showBottomNav={false}>
      <div className="flex flex-col h-full bg-slate-50/20">
        <header className="sticky top-0 z-40 bg-theme-blue text-white px-6 py-4 md:py-6 shadow-2xl transition-all duration-300">
          <div className="absolute inset-0 overflow-hidden opacity-10">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-white rounded-full blur-3xl" />
            <div className="absolute top-0 right-0 w-60 h-60 bg-white rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-inner group transition-all hover:scale-110">
                <FileText className="h-6 w-6 group-hover:rotate-12 transition-transform" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl md:text-2xl font-black tracking-tight leading-none">
                   FULFILLMENT CENTER
                </h1>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                    Live Dashboard &bull; {(user as any)?.clinicName || 'Operational Mode'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 p-2 bg-black/10 backdrop-blur-3xl rounded-[1.5rem] border border-white/10 shadow-2xl">
              <div className="hidden lg:flex flex-col items-end pr-4 border-r border-white/10 pl-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Pharmacist Session</span>
                <span className="text-xs font-bold">${(user as any)?.displayName || 'Clinical Staff'}</span>
              </div>
              
              <div className="w-full md:w-56 text-slate-900 drop-shadow-xl">
                <RoleSwitcher />
              </div>

              <button 
                onClick={() => setShowLogoutConfirm(true)}
                className="p-3 bg-rose-500 hover:bg-rose-600 active:scale-90 text-white rounded-2xl shadow-lg shadow-rose-900/40 transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-[1600px] w-full mx-auto p-4 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-white p-3 rounded-[2rem] shadow-premium border border-slate-100">
            <div className="flex flex-1 gap-2">
              {(['queue', 'search'] as Tab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 py-3 px-6 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300",
                    activeTab === tab 
                      ? "bg-theme-blue text-white shadow-xl shadow-theme-blue/20 translate-y-[-1px]" 
                      : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                  )}
                >
                  {tab === 'queue' ? '⚡ Active Fulfillment' : '🔍 Secure Search'}
                </button>
              ))}
            </div>

            {activeTab === 'search' && (
              <div className="flex-1 flex gap-2 animate-in slide-in-from-right-4 duration-300">
                <div className="flex-1 relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-theme-blue transition-colors" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Search Patient Record..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-4 focus:ring-theme-blue/10 transition-all"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={loadingSearch}
                  className="px-6 bg-theme-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-theme-blue/30 active:scale-95 transition-all"
                >
                  {loadingSearch ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                </button>
              </div>
            )}
          </div>

          <main className="pb-24">
            {activeTab === 'queue' ? (
              loadingQueue ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                  <div className="h-10 w-10 border-4 border-theme-blue border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Syncing Fulfillment Queue...</p>
                </div>
              ) : queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[3rem] border border-dashed border-slate-200">
                  <div className="h-24 w-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                    <Check className="h-10 w-10 text-emerald-400" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900">Zero Pending Orders</h2>
                  <p className="text-sm text-slate-400 font-medium mt-1">Excellent work. Your queue is completely optimized.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {queue.map(appt => <RxCard key={appt.id} appt={appt} showActions />)}
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-300">
                {searchResults.length > 0
                  ? searchResults.map(appt => <RxCard key={appt.id} appt={appt} />)
                  : searchQuery.trim() && !loadingSearch && (
                      <div className="col-span-full py-32 text-center">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-300">No Historical Records Found for &quot;{searchQuery}&quot;</p>
                      </div>
                    )
                }
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ── Dispense Modal (Centered Dialog for Desktop) ─────────────────────── */}
      {dispenseTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-[2.5rem] p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-emerald-50 rounded-2xl flex items-center justify-center">
                  <Check className="h-6 w-6 text-emerald-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Complete Fulfillment</h2>
              </div>
              <button onClick={() => setDispenseTarget(null)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                <X className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
               <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center font-black text-theme-blue shadow-sm border border-slate-100">
                 #{dispenseTarget.tokenNumber || '---'}
               </div>
               <div>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none mb-1">Patient Name</p>
                 <p className="text-lg font-black text-slate-800">{dispenseTarget.patientName}</p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest leading-none">TOTAL BILL (₹)</label>
                <div className="flex items-center gap-3 border-2 border-slate-100 rounded-2xl px-5 py-4 bg-slate-50 focus-within:border-theme-blue/30 focus-within:ring-4 focus-within:ring-theme-blue/5 transition-all">
                  <span className="text-slate-400 font-bold text-xl">₹</span>
                  <input
                    type="number"
                    value={billValue}
                    onChange={e => setBillValue(e.target.value)}
                    placeholder="0"
                    className="flex-1 bg-transparent text-2xl font-black text-slate-900 outline-none placeholder:opacity-30"
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Used for secure financial reporting.</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest leading-none flex items-center gap-1.5">
                  INTERNAL NOTES
                </label>
                <textarea
                  value={dispenseNotes}
                  onChange={e => setDispenseNotes(e.target.value)}
                  placeholder="e.g., Stock out of drug X..."
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-800 outline-none focus:border-theme-blue/30 focus:ring-4 focus:ring-theme-blue/5 h-16 resize-none"
                />
              </div>
            </div>

            <button
              onClick={confirmDispense}
              disabled={dispensing}
              className="w-full py-5 bg-theme-blue text-white font-black rounded-3xl text-sm uppercase tracking-[0.2em] shadow-xl shadow-theme-blue/30 active:scale-95 transition-all"
            >
              {dispensing ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Finalize & Close Order'}
            </button>
          </div>
        </div>
      )}

      {/* ── Abandon Modal (Centered Dialog for Desktop) ───────────────────── */}
      {abandonTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-[2.5rem] p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-rose-50 rounded-2xl flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-rose-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Abandon Reason</h2>
              </div>
              <button onClick={() => setAbandonTarget(null)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                <X className="h-6 w-6 text-slate-400" />
              </button>
            </div>

            <p className="text-sm font-medium text-slate-500 leading-relaxed">
              Standardized leakage tracking. Why is this prescription leaving the clinic unfulfilled?
            </p>

            <div className="space-y-2">
              {ABANDON_REASONS.map(reason => (
                <button
                  key={reason}
                  onClick={() => setAbandonReason(reason)}
                  className={cn(
                    "w-full text-left px-5 py-4 rounded-2xl border-2 font-bold text-sm transition-all flex items-center justify-between group",
                    abandonReason === reason
                      ? "border-rose-400 bg-rose-50 text-rose-700"
                      : "border-slate-100 text-slate-500 hover:border-rose-200 hover:bg-rose-50/50"
                  )}
                >
                  {reason}
                  <div className={cn(
                    "h-2 w-2 rounded-full transition-all",
                    abandonReason === reason ? "bg-rose-500 scale-150" : "bg-slate-200"
                  )} />
                </button>
              ))}
            </div>

            <button
              onClick={confirmAbandon}
              disabled={!abandonReason || abandoning}
              className="w-full py-5 bg-rose-500 text-white font-black rounded-3xl text-sm uppercase tracking-[0.2em] shadow-xl shadow-rose-500/30 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
            >
              {abandoning ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Log Abandonment'}
            </button>
          </div>
        </div>
      )}

      {/* ── Logout Confirmation Modal ───────────────────────────────── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="h-14 w-14 bg-rose-50 rounded-2xl flex items-center justify-center mb-4 transition-transform hover:scale-110">
              <LogOut className="h-7 w-7 text-rose-500" />
            </div>
            <h3 className="text-xl font-black text-slate-900 leading-tight">Confirm Sign Out</h3>
            <p className="text-sm text-slate-500 mt-2 font-medium">Are you sure you want to end your fulfillment session?</p>
            
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await logout();
                  router.push('/login');
                }}
                className="flex-1 py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-2xl shadow-lg shadow-rose-200 transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print Iframe */}
      <iframe
        ref={printIframeRef}
        style={{ display: 'none' }}
        title="Print Prescription"
      />

      {/* Prescription Image Viewer */}
      {viewerUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setViewerUrl(null)}>
          <div className="flex items-center justify-between p-4">
            <button onClick={() => setViewerUrl(null)} className="text-white font-bold text-sm">✕ Close</button>
            <div className="flex gap-3">
              <a href={viewerUrl} download target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-white bg-white/20 px-3 py-1.5 rounded-full text-sm font-semibold"
                onClick={e => e.stopPropagation()}
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={async e => {
                    e.stopPropagation();
                    try { await navigator.share({ url: viewerUrl }); } catch {}
                  }}
                  className="flex items-center gap-1.5 text-white bg-white/20 px-3 py-1.5 rounded-full text-sm font-semibold"
                >
                  Share
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
            <img src={viewerUrl} alt="Prescription" className="max-w-full max-h-full rounded-xl object-contain" />
          </div>
        </div>
      )}
    </AppFrameLayout>
  );
}
