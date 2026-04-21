'use client';

import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import ClinicHeader from '@/components/clinic/ClinicHeader';
import { TabletDashboardLayout } from '@/components/layout/TabletDashboardLayout';
import { ResponsiveAppLayout } from '@/components/layout/ResponsiveAppLayout';

// Refactored Hooks & Components
import { useAppointmentManagement } from '@/hooks/useAppointmentManagement';
import { AppointmentDatePicker } from '@/components/appointments/AppointmentDatePicker';
import { AppointmentSearchAndList } from '@/components/appointments/AppointmentSearchAndList';

export default function AppointmentsPage() {
  const {
    user, authLoading, dashLoading, data, selectedDoctor, selectedDate,
    setSelectedDate, searchTerm, setSearchTerm, dateLoading, handleDoctorChange,
    currentDoctor, filteredAppointments, dates, updateAppointmentStatus
  } = useAppointmentManagement();

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
      <div className="flex flex-col h-full bg-muted/20 font-pt-sans">
        <ClinicHeader
          doctors={(data?.doctors ?? []) as any}
          selectedDoctor={selectedDoctor}
          onDoctorChange={handleDoctorChange}
          showLogo={false}
          showSettings={false}
          pageTitle="Bookings"
        />

        <main className="flex-1 flex flex-col min-h-0 bg-card rounded-t-[2rem] -mt-4 z-10 shadow-premium overflow-hidden">
          <AppointmentDatePicker dates={dates} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <AppointmentSearchAndList 
            searchTerm={searchTerm} 
            onSearchChange={setSearchTerm} 
            isLoading={dateLoading} 
            appointments={filteredAppointments} 
            onUpdateStatus={updateAppointmentStatus} 
            selectedDate={selectedDate} 
            consultationStatus={currentDoctor?.consultationStatus}
          />
        </main>
      </div>
    </AppFrameLayout>
  );

  const tabletView = (
    <TabletDashboardLayout>
      <div className="space-y-8 py-4 animate-in fade-in duration-700 font-pt-sans">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Clinical Bookings</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2 px-1">
              Fulfillment for {format(selectedDate, 'MMMM d, yyyy')}
            </p>
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
            />
          </div>
        </div>
      </div>
    </TabletDashboardLayout>
  );

  return <ResponsiveAppLayout mobile={mobileView} tablet={tabletView} />;
}
