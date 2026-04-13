"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { format, subDays } from "date-fns";
import { apiRequest } from "@/lib/api-client";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { 
  TrendingUp, 
  AlertCircle, 
  Download, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Loader2,
  Stethoscope,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProviderPerformance {
  doctorId: string;
  name: string;
  clinicalRevenue: number;
  pharmacyRevenue: number;
  totalRevenue: number;
  prescriptionsIssued: number;
  prescriptionsDispensed: number;
  leakageRate: number;
  fulfillmentRate: number;
}

type SortField = 'totalRevenue' | 'fulfillmentRate' | 'name' | 'clinicalRevenue' | 'pharmacyRevenue';
type SortOrder = 'asc' | 'desc';

export default function ProviderPerformanceReportPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  
  const [data, setData] = useState<ProviderPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('totalRevenue');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append('start', dateRange.from.toISOString());
      if (dateRange?.to) params.append('end', dateRange.to.toISOString());

      const result = await apiRequest<ProviderPerformance[]>(`/clinic/providers/performance?${params.toString()}`);
      setData(result || []);
    } catch (error) {
      console.error("Failed to fetch provider performance data:", error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else {
        comparison = (a[sortField] as number) - (b[sortField] as number);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [data, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortOrder === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 text-primary" /> 
      : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
  };

  return (
    <div className="flex-1 space-y-6 p-8 bg-slate-50/30">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            Provider Efficiency Leaderboard
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Benchmarking doctor clinical value and pharmacy fulfillment ROI.</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker onDateChange={setDateRange} initialDateRange={dateRange} />
          <Button variant="outline" className="font-bold gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-white overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-24 h-24 -mt-8 -mr-8 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-500"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Clinical Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">
              ₹{data.reduce((sum, d) => sum + d.clinicalRevenue, 0).toLocaleString()}
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Consultation Fees Invoiced</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden relative group">
           <div className="absolute top-0 right-0 w-24 h-24 -mt-8 -mr-8 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pharmacy Captured ROI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">
              ₹{data.reduce((sum, d) => sum + d.pharmacyRevenue, 0).toLocaleString()}
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Fulfilled Medicine Revenue</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden relative group">
           <div className="absolute top-0 right-0 w-24 h-24 -mt-8 -mr-8 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all duration-500"></div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-widest">Avg. Fulfillment Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900">
              {data.length > 0 ? Math.round(data.reduce((sum, d) => sum + d.fulfillmentRate, 0) / data.length) : 0}%
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Clinic-wide RX Loyalty</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-lg bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-tight">Provider Rankings</CardTitle>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-100">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[250px] px-6 font-black text-slate-500 uppercase text-[10px] tracking-widest cursor-pointer" onClick={() => toggleSort('name')}>
                  <div className="flex items-center">Doctor Name <SortIcon field="name" /></div>
                </TableHead>
                <TableHead className="px-6 font-black text-slate-500 uppercase text-[10px] tracking-widest cursor-pointer text-right" onClick={() => toggleSort('clinicalRevenue')}>
                   <div className="flex items-center justify-end">Clinical (₹) <SortIcon field="clinicalRevenue" /></div>
                </TableHead>
                <TableHead className="px-6 font-black text-slate-500 uppercase text-[10px] tracking-widest cursor-pointer text-right" onClick={() => toggleSort('pharmacyRevenue')}>
                   <div className="flex items-center justify-end">Pharmacy (₹) <SortIcon field="pharmacyRevenue" /></div>
                </TableHead>
                <TableHead className="px-6 font-black text-slate-900 uppercase text-[10px] tracking-widest cursor-pointer text-right bg-primary/5" onClick={() => toggleSort('totalRevenue')}>
                   <div className="flex items-center justify-end">Total ROI (₹) <SortIcon field="totalRevenue" /></div>
                </TableHead>
                <TableHead className="px-6 font-black text-slate-500 uppercase text-[10px] tracking-widest text-center">RX Issued</TableHead>
                <TableHead className="px-6 font-black text-slate-500 uppercase text-[10px] tracking-widest text-center">RX Dispensed</TableHead>
                <TableHead className="px-6 font-black text-slate-500 uppercase text-[10px] tracking-widest cursor-pointer text-center" onClick={() => toggleSort('fulfillmentRate')}>
                   <div className="flex items-center justify-center">Fulfillment (%) <SortIcon field="fulfillmentRate" /></div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={7} className="h-16 bg-slate-50/20"></TableCell>
                  </TableRow>
                ))
              ) : sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-slate-400 font-medium">
                    No data found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((row, idx) => (
                  <TableRow key={row.doctorId} className="group hover:bg-slate-50/50 transition-all border-slate-50">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                          <Stethoscope className="h-5 w-5" />
                        </div>
                        <div>
                          <span className="block text-sm font-black text-slate-800">{row.name}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Provider Rank: {idx + 1}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 text-right text-slate-600 font-bold text-sm">
                      ₹{row.clinicalRevenue.toLocaleString()}
                    </TableCell>
                    <TableCell className="px-6 text-right text-slate-600 font-black text-sm">
                      ₹{row.pharmacyRevenue.toLocaleString()}
                    </TableCell>
                    <TableCell className="px-6 text-right text-primary font-black text-base bg-primary/[0.02]">
                      ₹{row.totalRevenue.toLocaleString()}
                    </TableCell>
                    <TableCell className="px-6 text-center text-slate-500 font-medium">
                      {row.prescriptionsIssued}
                    </TableCell>
                    <TableCell className="px-6 text-center text-slate-700 font-bold">
                      {row.prescriptionsDispensed}
                    </TableCell>
                    <TableCell className="px-6 text-center px-6">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full transition-all duration-1000",
                              row.fulfillmentRate < 50 ? "bg-red-500" : "bg-emerald-500"
                            )}
                            style={{ width: `${row.fulfillmentRate}%` }}
                          ></div>
                        </div>
                        <span className={cn(
                          "text-xs font-black min-w-[32px]",
                          row.fulfillmentRate < 50 ? "text-red-500" : "text-emerald-700"
                        )}>
                          {row.fulfillmentRate}%
                        </span>
                        {row.fulfillmentRate < 50 && (
                          <div className="flex items-center justify-center h-5 w-5 rounded-full bg-red-100 text-red-600">
                             <AlertCircle className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Deep Analytics Tip */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex items-start gap-4 shadow-sm">
        <div className="h-10 w-10 shrink-0 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
          <TrendingUp className="h-6 w-6" />
        </div>
        <div>
          <h4 className="text-sm font-black text-primary uppercase tracking-tight">Executive Insight: Reducing Rx Leakage</h4>
          <p className="text-xs text-primary/80 font-medium mt-1 pr-12">
            Providers highlighted with a <span className="text-red-600 font-black">RED ALERT</span> have a fulfillment rate under 50%. This identifies a critical disconnect between the doctor's consulting room and your pharmacy counter. Review if specific specialties (e.g. skin, peds) are out-of-stock or if patients prefer digital copies for these doctors.
          </p>
        </div>
      </div>
    </div>
  );
}
