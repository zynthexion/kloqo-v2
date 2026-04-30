'use client';

import { format, isSameDay } from 'date-fns';
import { Loader2, Calendar as CalendarIcon, Download, FileText, ExternalLink, X } from 'lucide-react';
import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import ClinicHeader from '@/components/clinic/ClinicHeader';
import { TabletDashboardLayout } from '@/components/layout/TabletDashboardLayout';
import { ResponsiveAppLayout } from '@/components/layout/ResponsiveAppLayout';
import { NurseDesktopShell } from '@/components/layout/NurseDesktopShell';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';

// Refactored Hooks & Components
import { useAppointmentManagement } from '@/hooks/useAppointmentManagement';
import { AppointmentDatePicker } from '@/components/appointments/AppointmentDatePicker';
import { AppointmentSearchAndList } from '@/components/appointments/AppointmentSearchAndList';
import { useDashboardBooking } from '@/hooks/useDashboardBooking';
import { BookingFlow } from '@/components/dashboard/BookingFlow';

export default function AppointmentsPage() {
  const {
    user, authLoading, dashLoading, data, selectedDoctor, selectedDate,
    setSelectedDate, searchTerm, setSearchTerm, dateLoading, handleDoctorChange,
    currentDoctor, filteredAppointments, dates, updateAppointmentStatus,
    page, setPage, totalCount, hasMore, limit
  } = useAppointmentManagement();
  const { activeRole } = useActiveIdentity();
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const booking = useDashboardBooking(selectedDoctor, user?.clinicId);

  const handleReschedule = (appt: any) => {
    booking.startReschedule(appt);
  };

  const isToday = isSameDay(selectedDate, new Date());

  if (authLoading || (user && dashLoading)) {
    return (
      <AppFrameLayout>
        <div className="flex h-full w-full items-center justify-center bg-slate-50">
          <Loader2 className="h-10 w-10 animate-spin text-theme-blue" />
        </div>
      </AppFrameLayout>
    );
  }

  if (!user) return null;

  const mobileView = (
    <AppFrameLayout showBottomNav>
      <div className="flex flex-col h-full w-full max-w-full overflow-x-hidden bg-muted/20 font-pt-sans">
        <ClinicHeader
          doctors={(data?.doctors ?? []) as any}
          selectedDoctor={selectedDoctor}
          onDoctorChange={handleDoctorChange}
          showLogo={false}
          showSettings={false}
          pageTitle="Bookings"
        />

        <main className="flex-1 flex flex-col min-h-0 w-full max-w-full overflow-x-hidden bg-card rounded-t-[2rem] -mt-4 z-10 shadow-premium">
          <AppointmentDatePicker dates={dates} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <AppointmentSearchAndList 
            searchTerm={searchTerm} 
            onSearchChange={setSearchTerm} 
            isLoading={dateLoading} 
            appointments={filteredAppointments} 
            onUpdateStatus={updateAppointmentStatus} 
            selectedDate={selectedDate} 
            consultationStatus={currentDoctor?.consultationStatus}
            onViewPrescription={setViewerUrl}
            onReschedule={handleReschedule}
            page={page}
            setPage={setPage}
            totalCount={totalCount}
            hasMore={hasMore}
            limit={limit}
          />
        </main>
      </div>
    </AppFrameLayout>
  );

  const tabletView = (
    <TabletDashboardLayout
      hideSidebar={activeRole === 'nurse'}
      hideRightPanel={activeRole === 'nurse'}
    >
      <div className="space-y-8 py-4 animate-in fade-in duration-700 font-pt-sans">
        <header className="flex justify-between items-end">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Clinical Bookings</h1>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2 px-1">
                Fulfillment for {format(selectedDate, 'MMMM d, yyyy')} {isToday && '(Today)'}
              </p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 space-y-6 sticky top-24">
            <AppointmentDatePicker dates={dates} selectedDate={selectedDate} onSelectDate={setSelectedDate} isTablet />
          </div>

          <div className="lg:col-span-8">
            <AppointmentSearchAndList 
              searchTerm={searchTerm} 
              onSearchChange={setSearchTerm} 
              isLoading={dateLoading} 
              appointments={filteredAppointments} 
              onUpdateStatus={updateAppointmentStatus} 
              selectedDate={selectedDate} 
              isTablet 
              consultationStatus={currentDoctor?.consultationStatus}
              onViewPrescription={setViewerUrl}
              onReschedule={handleReschedule}
              page={page}
              setPage={setPage}
              totalCount={totalCount}
              hasMore={hasMore}
              limit={limit}
            />
          </div>
        </div>
      </div>
    </TabletDashboardLayout>
  );

  return (
    <>
      <ResponsiveAppLayout 
        mobile={mobileView} 
        tablet={
          activeRole === 'nurse' ? (
            <NurseDesktopShell>
              {tabletView}
            </NurseDesktopShell>
          ) : tabletView
        } 
      />
      {viewerUrl && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col animate-in fade-in duration-300" onClick={() => setViewerUrl(null)}>
          <div className="flex items-center justify-between p-4 bg-black/40 backdrop-blur-md shrink-0">
            <button onClick={() => setViewerUrl(null)} className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
              <X className="h-5 w-5" /> Close Preview
            </button>
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
            {typeof navigator !== 'undefined' && /iPhone|iPad|Android/i.test(navigator.userAgent) ? (
              <div className="flex flex-col items-center justify-center gap-6 p-8 text-center">
                <div className="h-24 w-24 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                  <FileText className="h-12 w-12 text-slate-400" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Prescription Ready</h3>
                  <p className="text-xs text-slate-400 font-bold mt-2 uppercase tracking-widest max-w-xs">
                    Tap below to view the full prescription
                  </p>
                </div>
                <a
                  href={viewerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 h-14 px-8 bg-white text-black font-black rounded-2xl shadow-xl transition-all active:scale-95"
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

      <BookingFlow 
        isOpen={booking.isBookingDrawerOpen}
        onClose={() => booking.setIsBookingDrawerOpen(false)}
        bookingMode={booking.bookingMode}
        advancedStep={booking.advancedStep}
        setAdvancedStep={booking.setAdvancedStep}
        selectedDate={booking.selectedDate}
        setSelectedDate={booking.setSelectedDate}
        slots={booking.slots}
        selectedSlot={booking.selectedSlot}
        setSelectedSlot={booking.setSelectedSlot}
        loadingSlots={booking.loadingSlots}
        isBooking={booking.isBooking}
        walkIn={booking.walkIn}
        handleAdvancedBook={booking.handleAdvancedBook}
        nextDates={booking.nextDates}
        clinicId={user?.clinicId}
        fetchSlots={booking.fetchSlots}
      />
    </>
  );
}
