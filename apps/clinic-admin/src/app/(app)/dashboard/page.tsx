'use client';

import { Suspense, useRef, useCallback } from "react";
import { format } from "date-fns";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useAuth } from "@/context/AuthContext";
import { RBACUtils } from "@kloqo/shared";
import { useDashboard } from "@/hooks/use-dashboard";
import { DashboardHeader, DashboardMainGrid, PrintableContent } from "@/components/dashboard/dashboard-ui";

function DashboardPageContent() {
  const { currentUser } = useAuth();
  const isAdmin = RBACUtils.hasAnyRole(currentUser, ['clinicAdmin', 'superAdmin']);
  const contentToPrintRef = useRef<HTMLDivElement>(null);

  const {
    dateRange,
    setDateRange,
    selectedDate,
    dashboardData,
    dataLoading,
    isPrinting,
    setIsPrinting,
    isPrintMode,
    setIsPrintMode,
    handleDateSelect
  } = useDashboard();

  const handlePrint = useCallback(() => {
    setIsPrintMode(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setIsPrintMode(false), 1000);
    }, 500);
  }, [setIsPrintMode]);

  const handleDownloadPdf = useCallback(async () => {
    setIsPrinting(true);
    setIsPrintMode(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const content = contentToPrintRef.current;
      if (!content) return;

      const canvas = await html2canvas(content, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

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
  }, [dateRange, setIsPrinting, setIsPrintMode]);

  return (
    <>
      <DashboardHeader 
        isAdmin={isAdmin} 
        dateRange={dateRange} 
        setDateRange={setDateRange} 
        isPrinting={isPrinting} 
        handlePrint={handlePrint} 
        handleDownloadPdf={handleDownloadPdf} 
      />

      <PrintableContent
        ref={contentToPrintRef}
        dateRange={dateRange}
        selectedDate={selectedDate}
        isPrintMode={isPrintMode}
      >
        <DashboardMainGrid 
          dashboardData={dashboardData} 
          dataLoading={dataLoading} 
          isAdmin={isAdmin} 
          selectedDate={selectedDate} 
          handleDateSelect={handleDateSelect} 
        />
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
