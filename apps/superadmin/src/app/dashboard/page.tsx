'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchDashboardData, fetchInvestorMetrics, fetchSystemSettings, updateSystemSettings } from '@/lib/analytics';
import { TrendingUp, TrendingDown, Users, Building2, Calendar, Activity, MessageCircle, IndianRupee, BarChart3, Layers, Zap } from 'lucide-react';
import type { SuperadminDashboardData } from '@kloqo/shared';
import { GrowthChart } from '@/components/dashboard/GrowthChart';
import { Switch } from '@/components/ui/switch';

interface InvestorMetrics {
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  gmvRouted: number;
}

export default function OverviewDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SuperadminDashboardData | null>(null);
  const [investor, setInvestor] = useState<InvestorMetrics | null>(null);
  const [isWhatsAppEnabled, setIsWhatsAppEnabled] = useState(true);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const [dashboardData, investorData] = await Promise.all([
          fetchDashboardData(),
          fetchInvestorMetrics(),
        ]);
        setData(dashboardData);
        setInvestor(investorData);
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  useEffect(() => {
    fetchSystemSettings()
      .then(s => setIsWhatsAppEnabled(s.isWhatsAppEnabled))
      .catch(() => {});
  }, []);

  const handleToggleWhatsApp = async (checked: boolean) => {
    setIsUpdatingSettings(true);
    try {
      await updateSystemSettings({ isWhatsAppEnabled: checked });
      setIsWhatsAppEnabled(checked);
    } catch (err) {
      console.error('Failed to update settings:', err);
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const StatCard = ({ title, value, description, icon: Icon, trend }: {
    title: string; value: string | number; description?: string; icon: any;
    trend?: { value: string; isPositive: boolean };
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">
            {description}
            {trend && (
              <span className={`ml-2 inline-flex items-center gap-1 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trend.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {trend.value}
              </span>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-bold">Overview Dashboard</h1>
        <p className="text-muted-foreground mt-1">Key metrics and recent activity</p>
      </div>

      {/* ── INVESTOR KPIs ─────────────────────────────────────── */}
      {investor && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> Investor Metrics
          </h2>
          {/* GMV Hero */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white p-6">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-60">Platform GMV Routed</p>
            <p className="text-4xl font-black mt-1">₹{investor.gmvRouted.toLocaleString()}</p>
            <p className="text-xs opacity-50 mt-1">Total pharma sales processed through Kloqo</p>
            <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-white/10">
              <div>
                <p className="text-xs opacity-50">MRR</p>
                <p className="font-bold text-lg">₹{investor.mrr.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs opacity-50">ARR</p>
                <p className="font-bold text-lg">₹{(investor.arr / 100000).toFixed(1)}L</p>
              </div>
              <div>
                <p className="text-xs opacity-50">Active Subs</p>
                <p className="font-bold text-lg">{investor.activeSubscriptions}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="MRR" value={`₹${investor.mrr.toLocaleString()}`}
              description="Monthly recurring revenue" icon={IndianRupee} />
            <StatCard title="ARR" value={`₹${(investor.arr / 100000).toFixed(1)}L`}
              description="Annualised run rate" icon={BarChart3} />
            <StatCard title="GMV Routed" value={`₹${(investor.gmvRouted / 100000).toFixed(1)}L`}
              description="Pharma transactions via Kloqo" icon={Layers} />
            <StatCard title="Active Subs" value={investor.activeSubscriptions}
              description="Paying clinics / pharmacies" icon={Activity} />
          </div>
        </div>
      )}

      {/* ── PLATFORM HEALTH ──────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Platform Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Clinics" value={data.metrics.totalClinics}
            description={`${data.metrics.activeClinics} fully onboarded`} icon={Building2} />
          <StatCard title="Total Patients" value={data.metrics.totalPatients.toLocaleString()}
            description="Registered on platform" icon={Users} />
          <StatCard title="Total Appointments" value={data.metrics.totalAppointments.toLocaleString()}
            description="Lifetime bookings" icon={Calendar} />
          <StatCard title="MAU" value={data.metrics.mau.toLocaleString()}
            description="Active this month" icon={Activity} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard title="Avg Retention" value={`${data.metrics.retention.toFixed(1)}%`}
            description="30-day return rate" icon={Users} />
          <StatCard title="Active Clinics Ratio"
            value={`${data.metrics.totalClinics > 0 ? ((data.metrics.activeClinics / data.metrics.totalClinics) * 100).toFixed(1) : 0}%`}
            description="Onboarding success rate" icon={Activity} />
        </div>
      </div>

      {/* Growth Chart */}
      <GrowthChart data={data.growthData} />

      {/* Recent Traffic + System Overview */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent Visitor Traffic</CardTitle>
            <CardDescription>Latest user sessions across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase border-b">
                  <tr>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Device</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.recentTraffic.map((session) => (
                    <tr key={session.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex flex-col">
                          <span>{session.entryPage || '/'}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                            {session.referrer || 'Direct'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 capitalize">{session.deviceType}</td>
                      <td className="px-4 py-3">
                        {session.sessionDuration ? `${Math.round(session.sessionDuration / 60)}m` : '< 1m'}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {new Date(session.sessionStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                  {data.recentTraffic.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        No recent traffic data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Overview</CardTitle>
            <CardDescription>Live stats & health</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Activity className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Backend V2</p>
                  <p className="text-xs text-muted-foreground">Operational • 2.0.0</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <MessageCircle className={`h-5 w-5 ${isWhatsAppEnabled ? 'text-blue-500' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-sm font-medium">WhatsApp Messaging</p>
                    <p className="text-[10px] text-muted-foreground">
                      {isWhatsAppEnabled ? 'Enabled Globally' : 'Disabled Globally'}
                    </p>
                  </div>
                </div>
                <Switch checked={isWhatsAppEnabled} onCheckedChange={handleToggleWhatsApp} disabled={isUpdatingSettings} />
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Patients / Clinic</span>
                  <span className="font-semibold">
                    {data.metrics.totalClinics > 0 ? (data.metrics.totalPatients / data.metrics.totalClinics).toFixed(1) : 0}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Appts / Patient</span>
                  <span className="font-semibold">
                    {data.metrics.totalPatients > 0 ? (data.metrics.totalAppointments / data.metrics.totalPatients).toFixed(1) : 0}
                  </span>
                </div>
                {investor && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">GMV / Sub / Mo</span>
                    <span className="font-semibold text-emerald-600">
                      ₹{investor.activeSubscriptions > 0
                        ? Math.round(investor.gmvRouted / investor.activeSubscriptions).toLocaleString()
                        : 0}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Traffic Analysis</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-[10px] font-bold">REAL-TIME</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
