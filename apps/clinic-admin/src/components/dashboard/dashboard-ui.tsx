'use client';

import { forwardRef } from 'react';
import OverviewStats from '@/components/dashboard/overview-stats';
import DoctorAvailability from '@/components/dashboard/doctor-availability';
import LiveRxQueue from '@/components/dashboard/live-rx-queue';
import FulfillmentComparisonChart from '@/components/dashboard/fulfillment-comparison-chart';
import TodaysAppointments from '@/components/dashboard/todays-appointments';
import TopPerformersWidget from '@/components/dashboard/top-performers-widget';
import AppointmentStatusChart from '@/components/dashboard/appointment-status-chart';
import PatientsVsAppointmentsChart from '@/components/dashboard/patients-vs-appointments-chart';
import PeakHoursChart from '@/components/dashboard/peak-hours-chart';
import PDFReport from '@/components/dashboard/pdf-report';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Printer, FileDown, Loader2 } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

export const PrintableContent = forwardRef<HTMLDivElement, {
  children: React.ReactNode;
  dateRange: DateRange | undefined;
  selectedDate: Date;
  isPrintMode?: boolean;
}>(({ children, dateRange, selectedDate, isPrintMode = false }, ref) => {
  return (
    <div ref={ref} className="flex-1 p-6 bg-background">
      {isPrintMode ? (
        <PDFReport dateRange={dateRange} selectedDate={selectedDate} />
      ) : (
        children
      )}
    </div>
  );
});
PrintableContent.displayName = 'PrintableContent';

export function DashboardHeader({ 
  isAdmin, 
  dateRange, 
  setDateRange, 
  isPrinting, 
  handlePrint, 
  handleDownloadPdf 
}: { 
  isAdmin: boolean; 
  dateRange: DateRange | undefined; 
  setDateRange: (range: DateRange | undefined) => void;
  isPrinting: boolean;
  handlePrint: () => void;
  handleDownloadPdf: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-4 px-6 border-b py-6 bg-white/80 backdrop-blur-md sticky top-0 z-10">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">
          {isAdmin ? "Clinic ROI & Revenue" : "Clinical Dashboard"}
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          {isAdmin ? "FinTech Tracking & Prescription Analytics" : "Patient Queue & Consultation Overview"}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <DateRangePicker onDateChange={setDateRange} initialDateRange={dateRange} />
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={isPrinting} onClick={handlePrint} className="h-9 px-4 font-bold border-slate-200">
              <Printer className="h-4 w-4 mr-2" /> Print ROI
            </Button>
            <Button variant="default" size="sm" disabled={isPrinting} onClick={handleDownloadPdf} className="h-9 px-4 font-bold shadow-md bg-primary text-white">
              {isPrinting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
              {isPrinting ? 'Generating...' : 'Export Analytics'}
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

export function DashboardMainGrid({ 
  dashboardData, 
  dataLoading, 
  isAdmin, 
  selectedDate, 
  handleDateSelect 
}: { 
  dashboardData: any; 
  dataLoading: boolean; 
  isAdmin: boolean; 
  selectedDate: Date;
  handleDateSelect: (date: Date | undefined) => void;
}) {
  return (
    <div className="space-y-6">
      <OverviewStats data={dashboardData} comparison={dashboardData?.comparison} loading={dataLoading} isAdmin={isAdmin} />
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {isAdmin && (
          <>
            <div className="lg:col-span-4 h-[420px]">
              <LiveRxQueue data={dashboardData?.roi?.livePrescriptionQueue} loading={dataLoading} />
            </div>
            <div className="lg:col-span-4 h-[420px]">
              <FulfillmentComparisonChart 
                whatsappRate={dashboardData?.roi?.whatsappFulfillmentRate}
                printedRate={dashboardData?.roi?.printedFulfillmentRate}
                loading={dataLoading}
              />
            </div>
            <div className="lg:col-span-4 h-[420px]">
              <TopPerformersWidget data={dashboardData?.roi?.providerPerformance} loading={dataLoading} />
            </div>
          </>
        )}
        <div className={cn("h-[420px]", isAdmin ? "lg:col-span-4" : "lg:col-span-12")}>
          <PatientsVsAppointmentsChart data={dashboardData?.timeSeries} loading={dataLoading} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3">
          <Card className="h-full border-slate-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-widest">Calendar</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center p-2">
              <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} className="w-full border-0 shadow-none bg-transparent" />
            </CardContent>
          </Card>
        </div>
        
        <div className="lg:col-span-3">
          <Card className="h-full border-slate-100 shadow-sm">
            <AppointmentStatusChart data={dashboardData} loading={dataLoading} />
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card className="h-full border-slate-100 shadow-sm">
            <PeakHoursChart data={dashboardData?.hourlyStats} loading={dataLoading} />
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card className="h-full border-slate-100 shadow-sm">
            <TodaysAppointments data={dashboardData?.recentAppointments} loading={dataLoading} selectedDate={selectedDate} />
          </Card>
        </div>
      </div>
    </div>
  );
}
