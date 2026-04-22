"use client";

import { useState, Suspense, useRef, forwardRef, useCallback, useEffect } from "react";
import { format, subDays } from "date-fns";
import { useReactToPrint } from "react-to-print";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { apiRequest } from "@/lib/api-client";
import OverviewStats from "@/components/dashboard/overview-stats";
import DoctorAvailability from "@/components/dashboard/doctor-availability";
import LiveRxQueue from "@/components/dashboard/live-rx-queue";
import FulfillmentComparisonChart from "@/components/dashboard/fulfillment-comparison-chart";
import TodaysAppointments from "@/components/dashboard/todays-appointments";
import TopPerformersWidget from "@/components/dashboard/top-performers-widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Printer, FileDown, Loader2 } from "lucide-react";
import AppointmentStatusChart from "@/components/dashboard/appointment-status-chart";
import PatientsVsAppointmentsChart from "@/components/dashboard/patients-vs-appointments-chart";
import PeakHoursChart from "@/components/dashboard/peak-hours-chart";
import PDFReport from "@/components/dashboard/pdf-report";
import { useAuth } from "@/context/AuthContext";
import { RBACUtils } from "@kloqo/shared";
import { cn } from "@/lib/utils";

// A new component that correctly forwards the ref for printing.
const PrintableContent = forwardRef<HTMLDivElement, {
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

function DashboardPageContent() {
  const { currentUser } = useAuth();
  const isAdmin = RBACUtils.hasAnyRole(currentUser, ['clinicAdmin', 'superAdmin']);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 6),
    to: new Date(),
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setDataLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append('startDate', dateRange.from.toISOString());
      if (dateRange?.to) params.append('endDate', dateRange.to.toISOString());

      const data = await apiRequest(`/clinic/dashboard?${params.toString()}`);
      setDashboardData(data);
    } catch (error: any) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setDataLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const contentToPrintRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    setIsPrintMode(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setIsPrintMode(false);
      }, 1000);
    }, 500);
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    setIsPrinting(true);
    setIsPrintMode(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const content = contentToPrintRef.current;
      if (!content) return;

      const canvas = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `roi-report-${format(dateRange?.from || new Date(), 'yyyy-MM-dd')}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsPrinting(false);
      setIsPrintMode(false);
    }
  }, [dateRange]);

  const handleDateSelect = useCallback((date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  }, []);

  return (
    <>
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
          <DateRangePicker
            onDateChange={setDateRange}
            initialDateRange={dateRange}
          />
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isPrinting}
                onClick={handlePrint}
                className="h-9 px-4 font-bold border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print ROI
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={isPrinting}
                onClick={handleDownloadPdf}
                className="h-9 px-4 font-bold shadow-md bg-primary hover:bg-primary/90 transition-all text-white"
              >
                {isPrinting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
                {isPrinting ? 'Generating...' : 'Export Analytics'}
              </Button>
            </div>
          )}
        </div>
      </header>

      <PrintableContent
        ref={contentToPrintRef}
        dateRange={dateRange}
        selectedDate={selectedDate}
        isPrintMode={isPrintMode}
      >
        <div className="space-y-6">
          {/* ROI Stats Layer */}
          <OverviewStats 
            data={dashboardData} 
            comparison={dashboardData?.comparison} 
            loading={dataLoading} 
            isAdmin={isAdmin}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* The Money Maker Action Center */}
            {isAdmin && (
              <div className="lg:col-span-4 h-[420px]">
                <LiveRxQueue 
                  data={dashboardData?.roi?.livePrescriptionQueue} 
                  loading={dataLoading} 
                />
              </div>
            )}

            {/* ROI: WhatsApp vs Printed */}
            {isAdmin && (
              <div className="lg:col-span-4 h-[420px]">
                <FulfillmentComparisonChart 
                  whatsappRate={dashboardData?.roi?.whatsappFulfillmentRate}
                  printedRate={dashboardData?.roi?.printedFulfillmentRate}
                  loading={dataLoading}
                />
              </div>
            )}

            {/* Provider Performance: Leaderboard Mini */}
            {isAdmin && (
              <div className="lg:col-span-4 h-[420px]">
                <TopPerformersWidget 
                  data={dashboardData?.roi?.providerPerformance} 
                  loading={dataLoading} 
                />
              </div>
            )}

            {/* Performance Correlation Charts */}
            <div className={cn("h-[420px]", isAdmin ? "lg:col-span-4" : "lg:col-span-12")}>
              <PatientsVsAppointmentsChart 
                data={dashboardData?.timeSeries} 
                loading={dataLoading} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3">
              <Card className="h-full border-slate-100 shadow-sm">
                <CardHeader className="pb-2">
                   <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-widest">Calendar</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center p-2">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    className="w-full border-0 shadow-none bg-transparent"
                  />
                </CardContent>
              </Card>
            </div>
            
            <div className="lg:col-span-3">
              <Card className="h-full border-slate-100 shadow-sm">
                 <AppointmentStatusChart 
                  data={dashboardData} 
                  loading={dataLoading} 
                />
              </Card>
            </div>

            <div className="lg:col-span-3">
              <Card className="h-full border-slate-100 shadow-sm">
                <PeakHoursChart 
                  data={dashboardData?.hourlyStats} 
                  loading={dataLoading} 
                />
              </Card>
            </div>

            <div className="lg:col-span-3">
              <Card className="h-full border-slate-100 shadow-sm">
                <TodaysAppointments 
                  data={dashboardData?.recentAppointments} 
                  loading={dataLoading} 
                  selectedDate={selectedDate}
                />
              </Card>
            </div>

            <div className="lg:col-span-3">
              <Card className="h-full border-slate-100 shadow-sm">
                <DoctorAvailability 
                  data={dashboardData?.doctorAvailability} 
                  loading={dataLoading} 
                  selectedDate={selectedDate}
                />
              </Card>
            </div>
          </div>
        </div>
      </PrintableContent>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardPageContent />
    </Suspense>
  );
}
