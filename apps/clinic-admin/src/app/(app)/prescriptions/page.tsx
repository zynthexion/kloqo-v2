'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, ClipboardList, BarChart2, Loader2, Clock, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api-client';
import { usePrescriptionViewer } from '@/hooks/usePrescriptionViewer';
import { PrescriptionViewerModal } from '@/components/prescriptions/PrescriptionViewerModal';
import { Button } from '@/components/ui/button';
import { Appointment } from '@kloqo/shared';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatDistanceToNow } from 'date-fns';

interface RxStats {
  period: string;
  totalWritten: number;
  totalDispensed: number;
  totalAbandoned: number;
  captureRate: number;
  revenueGenerated: number;
  leakageTotal: number;
  leakageReasons: { reason: string; count: number }[];
  subscriptionCost: number;
  roi: number;
}

const LEAKAGE_COLORS = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#6b7280'];

function StatCard({ title, value, sub, icon: Icon, color = 'blue', badge }: {
  title: string; value: string | number; sub?: string; icon: any;
  color?: 'blue' | 'green' | 'red' | 'amber'; badge?: string;
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-start gap-4">
      <div className={`p-3 rounded-xl ${colorMap[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-black text-slate-800 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        {badge && <span className="inline-block mt-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{badge}</span>}
      </div>
    </div>
  );
}

const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Create a pleasant double-chime sound
    osc.type = 'sine';
    
    // First chime
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    // Second chime
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.3); // E5
    gainNode.gain.setValueAtTime(0, ctx.currentTime + 0.3);
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.35);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.9);
  } catch (e) {
    console.error('Audio play failed (browser might require user interaction first):', e);
  }
};

export default function PrescriptionsPage() {
  const { currentUser } = useAuth();
  const { prescriptionUrl, isOpen, openViewer, closeViewer } = usePrescriptionViewer();
  const [stats, setStats] = useState<RxStats | null>(null);
  const [queue, setQueue] = useState<Appointment[]>([]);
  const [period, setPeriod] = useState<'today' | 'month'>('month');
  const [loading, setLoading] = useState(true);
  const prevQueueLengthRef = useRef(0);

  const clinicId = currentUser?.clinicId;

  const fetchDashboardData = useCallback(async (isInitialLoad = false) => {
    if (!clinicId) return;
    if (isInitialLoad) setLoading(true);

    try {
      const [s, q] = await Promise.all([
        apiRequest<RxStats>(`/clinic/prescriptions/stats?clinicId=${clinicId}&period=${period}`),
        apiRequest<Appointment[]>(`/clinic/prescriptions?clinicId=${clinicId}&pharmacyStatus=pending`),
      ]);
      
      setStats(s);
      
      const parseDate = (d: any) => {
        if (!d) return 0;
        if (d.seconds) return d.seconds * 1000;
        const date = new Date(d);
        return isNaN(date.getTime()) ? 0 : date.getTime();
      };
      
      const sortedQueue = (q || []).sort((a: any, b: any) => parseDate(a.completedAt) - parseDate(b.completedAt));
      setQueue(sortedQueue);
      
      // Check for new prescriptions and trigger sound if not initial load
      if (!isInitialLoad && sortedQueue.length > prevQueueLengthRef.current) {
         playNotificationSound();
      }
      prevQueueLengthRef.current = sortedQueue.length;
      
    } catch (error) {
      console.error(error);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }, [clinicId, period]);

  useEffect(() => {
    fetchDashboardData(true);
    
    // Poll every 15 seconds for real-time prescription queue updates
    const interval = setInterval(() => {
      fetchDashboardData(false);
    }, 15000);
    
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const roiPositive = (stats?.roi ?? 0) >= 0;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6 pt-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Pharmacy ROI Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">Track prescription conversion and revenue impact</p>
        </div>
        <div className="flex gap-2">
          {(['today', 'month'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${period === p ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {p === 'today' ? 'Today' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* ── SECTION 1: Revenue vs. Cost ROI ──────────────────────── */}
      {stats && (
        <>
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl p-6 text-white shadow-lg">
            <p className="text-sm font-semibold opacity-80 uppercase tracking-wider">Revenue Generated via Kloqo</p>
            <p className="text-4xl font-black mt-2">
              ₹{stats.revenueGenerated.toLocaleString()}
            </p>
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/20">
              <div>
                <p className="text-xs opacity-70">Subscription Cost</p>
                <p className="font-bold">₹{stats.subscriptionCost.toLocaleString()}/mo</p>
              </div>
              <div className="w-px h-8 bg-white/30" />
              <div>
                <p className="text-xs opacity-70">Your Net ROI</p>
                <p className={`font-bold ${roiPositive ? 'text-white' : 'text-red-200'}`}>
                  {roiPositive ? '+' : '-'}₹{Math.abs(stats.roi).toLocaleString()}
                </p>
              </div>
              <div className="w-px h-8 bg-white/30" />
              <div>
                <p className="text-xs opacity-70">Capture Rate</p>
                <p className="font-bold">{stats.captureRate}%</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Rx Written" value={stats.totalWritten} icon={ClipboardList} color="blue"
              sub="Completed consultations" />
            <StatCard title="Rx Dispensed" value={stats.totalDispensed} icon={Check} color="green"
              badge={`${stats.captureRate}% capture rate`} />
            <StatCard title="Rx Abandoned" value={stats.totalAbandoned} icon={AlertTriangle} color="red"
              sub="Lost potential revenue" />
          </div>

          {/* ── SECTION 2: Leakage Widget ──────────────────────────── */}
          {stats.leakageReasons.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-50 rounded-xl"><TrendingDown className="h-5 w-5 text-red-500" /></div>
                <div>
                  <h3 className="font-bold text-slate-800">Lost Revenue Analysis</h3>
                  <p className="text-xs text-slate-400">{stats.totalAbandoned} prescriptions abandoned</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4 items-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={stats.leakageReasons} dataKey="count" nameKey="reason" cx="50%" cy="50%" outerRadius={70} paddingAngle={3}>
                      {stats.leakageReasons.map((_, i) => (
                        <Cell key={i} fill={LEAKAGE_COLORS[i % LEAKAGE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {stats.leakageReasons.map((r, i) => (
                    <div key={r.reason} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: LEAKAGE_COLORS[i % LEAKAGE_COLORS.length] }} />
                        <span className="text-slate-600">{r.reason}</span>
                      </div>
                      <span className="font-bold text-slate-800">{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── SECTION 3: Live FIFO Queue Mirror ──────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-50 rounded-xl"><BarChart2 className="h-5 w-5 text-blue-500" /></div>
          <div>
            <h3 className="font-bold text-slate-800">Live Pharmacy Queue</h3>
            <p className="text-xs text-slate-400">{queue.length} prescriptions pending at pharmacy</p>
          </div>
        </div>
        {queue.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">Queue is clear ✓</p>
        ) : (
          <div className="space-y-2">
            {queue.map((appt: any) => (
              <div key={appt.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="font-semibold text-sm text-slate-800">{appt.patientName}</p>
                  <p className="text-xs text-slate-400">Dr. {appt.doctorName}</p>
                </div>
                <div className="flex items-center gap-3">
                  {appt.tokenNumber && (
                    <span className="text-xs font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">#{appt.tokenNumber}</span>
                  )}
                  {(() => {
                    if (!appt.completedAt) return null;
                    const d = appt.completedAt.seconds ? new Date(appt.completedAt.seconds * 1000) : new Date(appt.completedAt);
                    if (isNaN(d.getTime())) return null;
                    
                    return (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(d, { addSuffix: true })}
                      </span>
                    );
                  })()}
                  {appt.prescriptionUrl && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => openViewer(appt.prescriptionUrl!)}
                      className="h-8 rounded-lg text-[10px] font-black uppercase text-blue-600 bg-blue-50/50 border-blue-100 hover:bg-blue-100 transition-all"
                    >
                      View Rx
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PrescriptionViewerModal 
        isOpen={isOpen}
        prescriptionUrl={prescriptionUrl}
        onClose={closeViewer}
      />
    </div>
  );
}
