'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, addDays, isSameDay, subMinutes } from 'date-fns';
import { apiRequest } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

import { getClinicNow } from '@kloqo/shared-core';

/**
 * useBookAppointmentState
 * Logic for fetching doctor/patient details, slot retrieval, and booking orchestration.
 */
export function useBookAppointmentState() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const doctorId = searchParams.get('doctor');
  const patientId = searchParams.get('patientId');
  const clinicId = user?.clinicId;

  // Dubai Patient Trap: Initialize with IST time
  const [selectedDate, setSelectedDate] = useState<Date>(getClinicNow());
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [step, setStep] = useState<'selection' | 'summary'>('selection');
  const [patient, setPatient] = useState<any>(null);
  const [doctor, setDoctor] = useState<any>(null);
  const [fetchingDoctor, setFetchingDoctor] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isWalkInEligible, setIsWalkInEligible] = useState(false);

  // 1. Resolve Available Dates
  const dates = useMemo(() => {
    // Principal SRE Catch: Total synchronization with IST baseline
    const nowIst = getClinicNow();
    const limit = doctor?.advanceBookingDays ?? 7;
    
    // logic: advanceBookingDays = Total unique dates selectable starting from Today
    // 0 means only Today.
    const displayLimit = Math.max(1, limit);
    const allDates = Array.from({ length: displayLimit }, (_, i) => addDays(nowIst, i));
    
    if (!doctor || !doctor.availabilitySlots) return allDates;
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const availableDayIndices = doctor.availabilitySlots.map((s: any) => 
      typeof s.day === 'number' ? s.day : dayNames.indexOf(s.day)
    );

    const overriddenDates = doctor.dateOverrides ? Object.keys(doctor.dateOverrides) : [];

    return allDates.filter(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        if (overriddenDates.includes(dateStr)) {
          return (doctor.dateOverrides[dateStr] || []).length > 0;
        }
        return availableDayIndices.includes(date.getDay());
    });
  }, [doctor]);

  // 2. Data Fetching
  useEffect(() => {
    const fetchMeta = async () => {
      if (!doctorId) return;
      setFetchingDoctor(true);
      try {
        const d = await apiRequest<any>(`/doctors/${doctorId}`);
        setDoctor(d);
        
        if (patientId && clinicId) {
            const pData = await apiRequest<any>(`/patients/search?id=${patientId}&clinicId=${clinicId}`);
            setPatient(Array.isArray(pData) ? pData[0] : pData);
        }
      } catch (error) {
        console.error("Meta fetch error:", error);
      } finally {
        setFetchingDoctor(false);
      }
    };
    fetchMeta();
  }, [doctorId, patientId, clinicId]);

  // 2.5 Geolocation Detection (Once on mount)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => console.warn('[Booking] Location denied or error:', err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, []);

  // 3. Slot Retrieval
  const fetchSlots = useCallback(async () => {
    if (!doctorId || !clinicId || !selectedDate) return;
    setLoading(true);
    setSelectedSlot(null);
    try {
      const dateStr = format(selectedDate, 'd MMMM yyyy');
      const query = new URLSearchParams({
        doctorId: doctorId!,
        clinicId: clinicId!,
        date: dateStr,
        source: 'patient'
      });
      
      if (userLocation) {
        query.append('userLat', userLocation.lat.toString());
        query.append('userLon', userLocation.lng.toString());
      }

      const data = await apiRequest<any[]>(`/appointments/available-slots?${query.toString()}`);
      setSlots(data);

      // Check if the backend promoted us to 'walkin' (which happens if distance <= 150m)
      // Since decorateSlots returns individual slots, we check the first available one's logic if possible,
      // or simply rely on the fact that 'available' slots appearing in the current buffer means we are 'nearby'.
      // A more robust check: see if any slot that would be 'past' for a standard patient is now 'available'.
      const nearby = data.some((s: any) => s.reason === 'Walk-in Gap' || s.status === 'available'); 
      // Actually, let's just track if we successfully hit the 'walkin' source logic in the backend. 
      // For now, if userLocation exists, the backend handles the distance math.
      
      const firstAvailable = data.find((s: any) => s.status === 'available');
      if (firstAvailable) setSelectedSlot(firstAvailable);
    } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'Could not load availability.' });
    } finally {
      setLoading(false);
    }
  }, [doctorId, clinicId, selectedDate, toast]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  // 4. Booking Command
  const handleBook = async () => {
    if (!selectedSlot || !patientId || !clinicId || !doctorId) return;
    setBooking(true);
    try {
      // Determine if we are booking an 'Advanced' or 'Walk-in' appointment
      // based on proximity (the backend already has the doctor coordinates).
      // We'll resend coordinates to CreateWalkIn for strict enforcement.
      
      // logic: If a patient books a slot starting < 45m from now, it MUST be a walk-in.
      const now = getClinicNow();
      const slotTime = new Date(selectedSlot.time);
      const diffMs = slotTime.getTime() - now.getTime();
      const isInstant = diffMs < (45 * 60 * 1000); // Less than 45 min buffer

      if (isInstant && isSameDay(selectedDate, now)) {
        // BOOK AS WALK-IN (W-TOKEN)
        await apiRequest('/appointments/walk-in', {
          method: 'POST',
          body: JSON.stringify({
            doctorId,
            clinicId,
            patientId,
            patientName: patient?.name,
            date: format(selectedDate, 'd MMMM yyyy'),
            userLat: userLocation?.lat,
            userLon: userLocation?.lng,
            place: patient?.place || 'Patient App'
          })
        });
      } else {
        // BOOK AS ADVANCED (A-TOKEN)
        await apiRequest('/appointments/advanced', {
          method: 'POST',
          body: JSON.stringify({
            doctorId,
            clinicId,
            patientId,
            date: format(selectedDate, 'd MMMM yyyy'),
            slotTime: format(new Date(selectedSlot.time), 'HH:mm'),
            time: format(new Date(selectedSlot.time), 'HH:mm'),
            slotIndex: selectedSlot.slotIndex,
            sessionIndex: selectedSlot.sessionIndex,
            source: 'Patient App'
          })
        });
      }

      toast({ title: 'Success', description: 'Appointment booked successfully.' });
      router.push('/appointments');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setBooking(false);
    }
  };

  return {
    doctor, patient, slots, dates,
    selectedDate, setSelectedDate,
    selectedSlot, setSelectedSlot,
    loading, fetchingDoctor, booking,
    step, setStep,
    handleBook,
    router, doctorId, patientId
  };
}
