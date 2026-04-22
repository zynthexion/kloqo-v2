"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  CreditCard, MessageSquare, Stethoscope, Cpu, CalendarClock, 
  CheckCircle2, AlertTriangle, Clock, Sparkles, ArrowUpRight
} from "lucide-react";
import { format } from "date-fns";

interface BillingSubscriptionSettingsProps {
  clinicDetails: any | null;
  currentDoctorCount: number;
  onUpgrade?: () => void;
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    past_due: { label: "Past Due", className: "bg-amber-100 text-amber-700 border-amber-200" },
    cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200" },
    paused: { label: "Paused", className: "bg-slate-100 text-slate-600 border-slate-200" },
  };
  const s = map[status || ""] || map["active"];
  return <Badge className={`text-[10px] font-black uppercase ${s.className}`}>{s.label}</Badge>;
}

function MetricRow({ icon: Icon, label, value, sub }: { icon: any; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-slate-500" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-700">{label}</p>
          {sub && <p className="text-[10px] text-slate-400 font-medium">{sub}</p>}
        </div>
      </div>
      <div className="text-right">{value}</div>
    </div>
  );
}

export function BillingSubscriptionSettings({ clinicDetails, currentDoctorCount, onUpgrade }: BillingSubscriptionSettingsProps) {
  if (!clinicDetails) {
    return (
      <Card>
        <CardContent className="p-10 flex items-center justify-center">
          <p className="text-sm text-slate-400">Loading subscription details...</p>
        </CardContent>
      </Card>
    );
  }

  const { 
    plan, hardwareChoice, billingCycle, numDoctors, 
    subscriptionDetails, usage, calculatedMonthlyTotal
  } = clinicDetails;

  const safeFormatDate = (dateVal: any) => {
    if (!dateVal) return "—";
    try {
      let date: Date;
      if (dateVal instanceof Date) {
        date = dateVal;
      } else if (typeof dateVal === 'object' && (dateVal.toDate || dateVal._seconds || dateVal.seconds)) {
        const seconds = dateVal.seconds || dateVal._seconds || 0;
        date = dateVal.toDate ? dateVal.toDate() : new Date(seconds * 1000);
      } else {
        date = new Date(dateVal);
      }
      if (isNaN(date.getTime())) return "—";
      return format(date, "d MMM yyyy");
    } catch (e) {
      return "—";
    }
  };

  const nextBillingDate = safeFormatDate(subscriptionDetails?.nextBillingDate);
  const lastPaymentDate = safeFormatDate(subscriptionDetails?.lastPaymentDate);

  const whatsapp = usage?.whatsapp;
  const whatsappPercent = whatsapp ? Math.round((whatsapp.currentMonthCount / whatsapp.monthlyLimit) * 100) : 0;

  const hardwareLabels: Record<string, string> = {
    upfront: "Hardware (Paid Upfront)",
    emi: "Hardware (EMI)",
    byot: "Bring Your Own Tablet",
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <CardContent className="p-6 relative">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-1">Current Plan</p>
              <h2 className="text-3xl font-black text-white tracking-tight">{plan || "Kloqo Standard"}</h2>
              <p className="text-slate-400 text-xs font-medium mt-1 capitalize">{billingCycle || "Monthly"} billing</p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Monthly</p>
              <p className="text-3xl font-black text-white">
                ₹{(calculatedMonthlyTotal || 0).toLocaleString('en-IN')}
              </p>
              <StatusBadge status={subscriptionDetails?.subscriptionStatus} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Plan Details
          </CardTitle>
          <CardDescription className="text-xs">Your active subscription breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <MetricRow
            icon={Stethoscope}
            label="Doctor Seats"
            sub={`${currentDoctorCount} active / ${numDoctors} licensed`}
            value={
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-800">{numDoctors} seat{numDoctors > 1 ? "s" : ""}</span>
                {currentDoctorCount >= numDoctors && (
                  <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 font-black">At Limit</Badge>
                )}
              </div>
            }
          />
          <Separator />
          <MetricRow
            icon={Cpu}
            label="Hardware"
            value={<span className="text-sm font-semibold text-slate-700">{hardwareLabels[hardwareChoice] || hardwareChoice || "—"}</span>}
          />
          <Separator />
          <MetricRow
            icon={CalendarClock}
            label="Next Billing Date"
            sub={subscriptionDetails?.renewalType === "auto-debit" ? "Auto-debit" : "Manual UPI"}
            value={<span className="text-sm font-black text-slate-800">{nextBillingDate}</span>}
          />
          <Separator />
          <MetricRow
            icon={CheckCircle2}
            label="Last Payment"
            value={<span className="text-sm font-semibold text-slate-600">{lastPaymentDate}</span>}
          />
        </CardContent>
      </Card>

      {whatsapp && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-500" /> WhatsApp Usage
            </CardTitle>
            <CardDescription className="text-xs">Usage resets on the 1st of each month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-600">
                {whatsapp.currentMonthCount.toLocaleString()} / {whatsapp.isUnlimited ? "Unlimited" : whatsapp.monthlyLimit.toLocaleString()} messages
              </span>
              <span className={`text-xs font-black ${whatsappPercent > 80 ? "text-red-500" : "text-emerald-600"}`}>
                {whatsapp.isUnlimited ? "∞" : `${whatsappPercent}%`}
              </span>
            </div>
            {!whatsapp.isUnlimited && (
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${whatsappPercent > 80 ? "bg-red-400" : "bg-emerald-400"}`}
                  style={{ width: `${Math.min(whatsappPercent, 100)}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-dashed border-2 border-indigo-200 bg-indigo-50/30">
        <CardContent className="p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-black text-slate-800 text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" /> Need more seats or messages?
            </p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Contact us to upgrade your plan instantly.</p>
          </div>
          <Button 
            size="sm" 
            className="shrink-0 font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
            onClick={onUpgrade}
          >
            Upgrade <ArrowUpRight className="h-3 w-3 ml-1" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
