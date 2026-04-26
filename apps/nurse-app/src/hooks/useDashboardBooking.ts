import { useState, useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { getClinicNow } from '@kloqo/shared-core';
import { apiRequest } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { useWalkInFlow } from '@/hooks/useWalkInFlow';

export function useDashboardBooking(selectedDoctor: string, clinicId?: string) {
  const { toast } = useToast();
  const [isBookingDrawerOpen, setIsBookingDrawerOpen] = useState(false);
  const [bookingMode, setBookingMode] = useState<'walk-in' | 'advanced'>('walk-in');
  
  // Advanced Booking State
  const [advancedStep, setAdvancedStep] = useState<'identify' | 'slots' | 'confirm' | 'success'>('identify');
  const [selectedDate, setSelectedDate] = useState<Date>(getClinicNow());
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  // Walk-in Flow Hook - Pass current state IDs
  const walkIn = useWalkInFlow({ doctorId: selectedDoctor, clinicId });

  const handleWalkInOpen = () => {
    setBookingMode('walk-in');
    setIsBookingDrawerOpen(true);
    walkIn.setCurrentStep('identify');
  };

  const handleAdvancedOpen = () => {
    setBookingMode('advanced');
    setIsBookingDrawerOpen(true);
    setAdvancedStep('identify');
    
    // Reset identity state
    walkIn.setPhoneNumber('');
    walkIn.selectPatient(null);
    walkIn.setCurrentStep('identify'); 
  };

  const fetchSlots = async (date: Date) => {
    if (!selectedDoctor || !clinicId) return;
    setLoadingSlots(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const response = await apiRequest<any>(
        `/appointments/available-slots?doctorId=${selectedDoctor}&clinicId=${clinicId}&date=${encodeURIComponent(dateStr)}`
      );
      setSlots(response.slots || []);
      setSelectedSlot(null);
    } catch (error) {
      console.error("Error fetching slots:", error);
      toast({ variant: 'destructive', title: 'Slot Error', description: 'Could not load availability.' });
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleAdvancedBook = async () => {
    if (!selectedSlot || !walkIn.selectedPatient || !selectedDoctor || !clinicId) return;
    setIsBooking(true);
    try {
      const patientId = walkIn.selectedPatient?.id || walkIn.selectedPatient?._id;
      await apiRequest('/appointments/book', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: selectedDoctor,
          clinicId: clinicId,
          patientId,
          date: format(selectedDate, 'd MMMM yyyy'),
          slotTime: format(new Date(selectedSlot.time), 'hh:mm a'),
          time: format(new Date(selectedSlot.time), 'hh:mm a'),
          slotIndex: selectedSlot.slotIndex,
          sessionIndex: selectedSlot.sessionIndex,
          source: 'Tablet_Dashboard'
        })
      });
      setAdvancedStep('success');
      toast({ title: '✅ Appointment Booked', description: 'Slot locked. Queue will update in real-time.' });
      // Remove setIsBookingDrawerOpen(false); - let the success screen handle it
    } catch (error: any) {
      const isConflict = (error as any)?.status === 409;
      toast({
        variant: 'destructive',
        title: isConflict ? 'Slot Already Taken' : 'Booking Failed',
        description: isConflict ? 'Someone just grabbed this slot. Please pick another.' : error.message
      });
    } finally {
      setIsBooking(false);
    }
  };

  const nextDates = useMemo(() => {
    const today = getClinicNow();
    return Array.from({ length: 14 }, (_, i) => addDays(today, i));
  }, []);

  return {
    isBookingDrawerOpen,
    setIsBookingDrawerOpen,
    bookingMode,
    advancedStep,
    setAdvancedStep,
    selectedDate,
    setSelectedDate,
    slots,
    selectedSlot,
    setSelectedSlot,
    loadingSlots,
    isBooking,
    walkIn,
    handleWalkInOpen,
    handleAdvancedOpen,
    fetchSlots,
    handleAdvancedBook,
    nextDates,
  };
}
