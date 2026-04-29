'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, UserPlus, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNurseDashboard } from '@/hooks/useNurseDashboard';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { useTheme } from '@/contexts/ThemeContext';
import { ResponsiveAppLayout } from '@/components/layout/ResponsiveAppLayout';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useDashboardBooking } from '@/hooks/useDashboardBooking';
import { MobileDashboardView } from '@/components/dashboard/MobileDashboardView';
import { TabletDashboardView } from '@/components/dashboard/TabletDashboardView';
import { BookingFlow } from '@/components/dashboard/BookingFlow';

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');

  const clinicId = user?.clinicId;
  const { data: dashData, loading: dashLoading, updateDoctorStatus } = useNurseDashboard(clinicId);
  const { data: analytics, loading: analyticsLoading, range, setRange } = useAnalytics(selectedDoctor);

  // Modularized logic and state
  const booking = useDashboardBooking(selectedDoctor, clinicId);

  const isInitialLoading = authLoading || (user && dashLoading && !dashData);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
  }, [user, authLoading, router]);

  // Auto-select first doctor
  useEffect(() => {
    if (dashData?.doctors?.length && !selectedDoctor) {
      const stored = localStorage.getItem('selectedDoctorId');
      const found = dashData.doctors.find(d => d.id === stored);
      setSelectedDoctor(found ? found.id : dashData.doctors[0].id);
    }
  }, [dashData?.doctors, selectedDoctor]);

  const handleDoctorChange = (id: string) => {
    setSelectedDoctor(id);
    localStorage.setItem('selectedDoctorId', id);
  };

  const currentDoctor = dashData?.doctors.find(d => d.id === selectedDoctor);
  const consultationStatus = (currentDoctor?.consultationStatus ?? 'Out') as 'In' | 'Out';

  const handleStatusChange = async (newStatus: 'In' | 'Out', sessionIndex?: number) => {
    if (!currentDoctor) return;
    try {
      await updateDoctorStatus(currentDoctor.id, newStatus, sessionIndex);
    } catch (e) {
      console.error(e);
    }
  };

  const { theme } = useTheme();
  const isModern = theme === 'modern';

  if (isInitialLoading) {
    return (
      <AppFrameLayout>
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-theme-blue" />
        </div>
      </AppFrameLayout>
    );
  }

  if (!user) return null;

  const { displayName, activeRole } = useActiveIdentity();

  const mainMenuItems = [
    {
      icon: Phone,
      title: 'Phone Booking',
      subtitle: 'Manage phone appointments',
      action: booking.handleAdvancedOpen,
      disabled: !selectedDoctor,
      colors: isModern ? 'bg-gradient-to-br from-[#F5470D] to-[#fc7144] text-white' : 'bg-gradient-to-br from-[#429EBD] to-[#52b1d3] text-white',
      iconContainer: 'bg-white/20',
    },
    {
      icon: UserPlus,
      title: 'Walk-in',
      subtitle: selectedDoctor ? 'Register a new walk-in patient' : 'Select a doctor first',
      action: booking.handleWalkInOpen,
      disabled: !selectedDoctor,
      colors: isModern ? 'bg-gradient-to-br from-[#232230] to-[#3a394a] text-white' : 'bg-gradient-to-br from-[#FFBA08] to-[#ffd46a] text-black',
      iconContainer: 'bg-white/20',
    },
  ];

  if (activeRole === 'doctor') {
    mainMenuItems.push({
      icon: Loader2, // Replace later if needed or add Calendar icon
      title: 'Update Schedule',
      subtitle: 'Manage availability & clinical pauses',
      action: () => router.push(`/appointments/schedule?doctor=${selectedDoctor}`),
      disabled: !selectedDoctor,
      colors: isModern ? 'bg-gradient-to-br from-[#4F46E5] to-[#6366F1] text-white' : 'bg-gradient-to-br from-[#10B981] to-[#34D399] text-white',
      iconContainer: 'bg-white/20',
    });
  }


  return (
    <>
      <ResponsiveAppLayout 
        mobile={
          <MobileDashboardView 
            isModern={isModern}
            dashData={dashData}
            selectedDoctor={selectedDoctor}
            handleDoctorChange={handleDoctorChange}
            consultationStatus={consultationStatus}
            handleStatusChange={handleStatusChange}
            mainMenuItems={mainMenuItems}
            activeRole={activeRole}
          />
        } 
        tablet={
          <TabletDashboardView 
            displayName={displayName}
            range={range}
            setRange={setRange}
            analytics={analytics}
            analyticsLoading={analyticsLoading}
            mainMenuItems={mainMenuItems}
          />
        } 
      />

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
        clinicId={clinicId}
        fetchSlots={booking.fetchSlots}
      />
    </>
  );
}
