'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppointments } from '@/hooks/use-appointments';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, subMinutes, isBefore, isAfter } from 'date-fns';
import { getClinicNow, getClinicISOString, getClinicDateString, getClinicDayOfWeek } from '@kloqo/shared-core';
import { parseTime } from '@/lib/utils';
import type { Doctor, Patient } from '@kloqo/shared';

const formSchema = z.object({
  patientName: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  age: z.string().min(1, { message: 'Age is required.' }),
  place: z.string().min(2, { message: 'Place is required.' }),
  sex: z.string().min(1, { message: 'Sex is required.' }),
  phone: z.string().length(10, { message: "Please enter exactly 10 digits for the phone number." }),
});

export type WalkInFormValues = z.infer<typeof formSchema>;

export function useWalkInRegistration() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const doctorIdFromParams = searchParams.get('doctor');

  const { 
    appointments: allAppointments, 
    doctors: allDoctors, 
    refresh: refreshQueue, 
    getWalkInEstimate, 
    createWalkIn, 
    searchPatients: apiSearchPatients 
  } = useAppointments();
  const { currentUser } = useAuth();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('manual');
  const [currentTime, setCurrentTime] = useState(getClinicNow());
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [estimatedConsultationTime, setEstimatedConsultationTime] = useState<Date | null>(null);
  const [patientsAhead, setPatientsAhead] = useState(0);
  const [loading, setLoading] = useState(true);
  const [appointmentToSave, setAppointmentToSave] = useState<any | null>(null);

  // Force booking states
  const [showForceBookDialog, setShowForceBookDialog] = useState(false);
  const [pendingForceBookData, setPendingForceBookData] = useState<WalkInFormValues | null>(null);

  // States for patient search
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);
  const [searchedPatients, setSearchedPatients] = useState<Patient[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const form = useForm<WalkInFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { patientName: '', age: '', place: '', sex: '', phone: '' },
  });

  // Derived state: active counts and arrived appointments
  const activeAppointmentsCount = useMemo(() => {
    const counts: Record<number, number> = {};
    if (!doctor) return counts;
    allAppointments
      .filter(a => a.doctorId === doctor.id && ['Pending', 'Confirmed', 'Skipped', 'No-show'].includes(a.status))
      .forEach(a => {
        if (typeof a.sessionIndex === 'number') {
          counts[a.sessionIndex] = (counts[a.sessionIndex] || 0) + 1;
        }
      });
    return counts;
  }, [allAppointments, doctor]);

  const arrivedAppointments = useMemo(() => {
    if (!doctor) return [];
    return allAppointments.filter(a => a.doctorId === doctor.id && ['Arrived', 'Confirmed'].includes(a.status));
  }, [allAppointments, doctor]);

  const isDoctorConsultingNow = useMemo(() => {
    if (!doctor?.availabilitySlots) return false;

    const todayDay = getClinicDayOfWeek(currentTime);
    const todaysAvailability = doctor.availabilitySlots.find(s => s.day === todayDay);
    if (!todaysAvailability || !todaysAvailability.timeSlots) return false;

    return todaysAvailability.timeSlots.some((slot, index) => {
      const startTime = parseTime(slot.from, currentTime);
      const openTime = subMinutes(startTime, 30);
      if (isBefore(currentTime, openTime)) return false;

      const endTime = parseTime(slot.to, currentTime);
      if (!isAfter(currentTime, endTime)) return true;

      const activeCount = activeAppointmentsCount[index] || 0;
      return activeCount > 0;
    });
  }, [doctor, currentTime, activeAppointmentsCount]);

  useEffect(() => {
    if (!currentUser?.clinicId) {
      router.push('/login');
      return;
    }
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${baseUrl}/patient-form?clinicId=${currentUser.clinicId}`;
    setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`);

    const timer = setInterval(() => setCurrentTime(getClinicNow()), 60000);
    return () => clearInterval(timer);
  }, [router, currentUser]);

  useEffect(() => {
    const doctorId = doctorIdFromParams || localStorage.getItem('selectedDoctorId');
    if (!doctorId) {
      setLoading(false);
      return;
    }
    
    if (allDoctors.length > 0) {
      const foundDoctor = allDoctors.find(d => d.id === doctorId);
      if (foundDoctor) {
        setDoctor(foundDoctor);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Doctor not found.' });
      }
      setLoading(false);
    }
  }, [doctorIdFromParams, allDoctors, toast]);

  const handlePatientSearch = useCallback(async (phone: string) => {
    if (phone.length < 10) {
      setSearchedPatients([]);
      setShowForm(false);
      return;
    };
    setIsSearchingPatient(true);
    setShowForm(false);
    setSelectedPatientId(null);
    form.reset({ patientName: '', age: '', place: '', sex: '', phone: '' });

    try {
      const results = await apiSearchPatients(phone);
      setSearchedPatients(results);

      if (results.length === 0) {
        setShowForm(true);
        form.setValue('phone', phone);
      }
    } catch (error) {
      console.error("Error searching patient:", error);
      toast({ variant: 'destructive', title: 'Search Error', description: 'Could not perform patient search.' });
    } finally {
      setIsSearchingPatient(false);
    }
  }, [apiSearchPatients, toast, form]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (phoneNumber && phoneNumber.length === 10) {
        handlePatientSearch(phoneNumber);
      } else {
        setSearchedPatients([]);
        setShowForm(false);
        setSelectedPatientId(null);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [phoneNumber, handlePatientSearch]);

  const selectPatient = useCallback((patient: Patient) => {
    setSelectedPatientId(patient.id);
    form.reset({
      patientName: patient.name,
      age: patient.age ? String(patient.age) : '',
      place: patient.place,
      sex: patient.sex,
      phone: patient.phone.replace('+91', ''),
    });
    setShowForm(true);
  }, [form]);

  const onSubmit = useCallback(async (values: WalkInFormValues) => {
    if (!doctor) {
      toast({ variant: 'destructive', title: 'Error', description: 'Doctor not identified.' });
      return;
    }
    setIsSubmitting(true);

    try {
      const todayStr = getClinicISOString();
      const estimate = await getWalkInEstimate(doctor.id, todayStr);
      
      if (estimate.unavailable) {
        setPendingForceBookData(values);
        setShowForceBookDialog(true);
        return;
      }

      setAppointmentToSave({
        ...values,
        phone: values.phone.startsWith('+91') ? values.phone : `+91${values.phone}`,
        doctorId: doctor.id,
        doctor: doctor.name,
        slotIndex: estimate.slotIndex,
        sessionIndex: estimate.sessionIndex,
        numericToken: estimate.numericToken,
        tokenNumber: estimate.tokenNumber,
        time: estimate.time,
        date: getClinicDateString(),
        status: 'Confirmed',
        bookedVia: 'Walk-in',
        clinicId: currentUser?.clinicId || '',
        createdAt: getClinicNow(),
      });

      setGeneratedToken(estimate.tokenNumber);
      setEstimatedConsultationTime(parseTime(estimate.time, new Date()));
      setPatientsAhead(estimate.patientsAhead);
      setIsEstimateModalOpen(true);
    } catch (error: any) {
      console.error("Error getting walk-in estimate:", error);
      toast({
        variant: 'destructive',
        title: 'Walk-in Error',
        description: error.message || 'Could not calculate walk-in details.'
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [doctor, getWalkInEstimate, currentUser?.clinicId, toast]);

  const handleForceBook = useCallback(async () => {
    if (!doctor || !pendingForceBookData) return;
    setIsSubmitting(true);
    setShowForceBookDialog(false);

    try {
      const todayStr = getClinicISOString();
      const estimate = await getWalkInEstimate(doctor.id, todayStr, true);
      
      if (estimate.unavailable) {
        throw new Error(estimate.reason || 'Failed to force book walk-in');
      }

      setAppointmentToSave({
        ...pendingForceBookData,
        phone: pendingForceBookData.phone.startsWith('+91') ? pendingForceBookData.phone : `+91${pendingForceBookData.phone}`,
        doctorId: doctor.id,
        doctor: doctor.name,
        slotIndex: estimate.slotIndex,
        sessionIndex: estimate.sessionIndex,
        numericToken: estimate.numericToken,
        tokenNumber: estimate.tokenNumber,
        time: estimate.time,
        date: getClinicDateString(),
        status: 'Confirmed',
        bookedVia: 'Walk-in',
        clinicId: currentUser?.clinicId || '',
        createdAt: getClinicNow(),
      });

      setGeneratedToken(estimate.tokenNumber);
      setEstimatedConsultationTime(parseTime(estimate.time, new Date()));
      setPatientsAhead(estimate.patientsAhead);
      setIsEstimateModalOpen(true);
    } catch (error: any) {
      console.error("Error during force book estimate:", error);
      toast({
        variant: 'destructive',
        title: 'Force Book Error',
        description: error.message || 'Could not calculate force book details.'
      });
    } finally {
      setIsSubmitting(false);
      setPendingForceBookData(null);
    }
  }, [doctor, pendingForceBookData, getWalkInEstimate, currentUser?.clinicId, toast]);

  const handleProceedToToken = useCallback(async () => {
    if (!appointmentToSave || !doctor) return;
    setIsSubmitting(true);

    try {
      const result = await createWalkIn({
        patientName: appointmentToSave.patientName,
        age: parseInt(appointmentToSave.age) || 0,
        place: appointmentToSave.place,
        sex: appointmentToSave.sex,
        phone: appointmentToSave.phone,
        doctorId: doctor.id,
        tokenNumber: appointmentToSave.tokenNumber,
        numericToken: appointmentToSave.numericToken,
        slotIndex: appointmentToSave.slotIndex,
        sessionIndex: appointmentToSave.sessionIndex,
        time: appointmentToSave.time,
        date: appointmentToSave.date,
      });

      if (result && (result as any).success) {
        setIsEstimateModalOpen(false);
        setIsTokenModalOpen(true);
        refreshQueue();
      } else {
        throw new Error((result as any)?.message || 'Failed to create walk-in');
      }
    } catch (error: any) {
      console.error("Error creating walk-in:", error);
      toast({
        variant: 'destructive',
        title: 'Booking Error',
        description: error.message || 'Failed to complete walk-in registration.'
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [appointmentToSave, doctor, createWalkIn, refreshQueue, toast]);

  const isWithin15MinutesOfClosing = useCallback((doc: Doctor, time: Date) => {
    if (!doc?.availabilitySlots) return false;
    const todayDay = getClinicDayOfWeek(time);
    const todaysAvailability = doc.availabilitySlots.find(s => s.day === todayDay);
    if (!todaysAvailability || !todaysAvailability.timeSlots) return false;

    return todaysAvailability.timeSlots.some((slot) => {
      const endTime = parseTime(slot.to, time);
      const limit = subMinutes(endTime, 15);
      return isAfter(time, limit) && !isAfter(time, endTime);
    });
  }, []);

  return {
    doctor,
    isSubmitting,
    activeTab,
    setActiveTab,
    qrCodeUrl,
    isEstimateModalOpen,
    setIsEstimateModalOpen,
    isTokenModalOpen,
    setIsTokenModalOpen,
    generatedToken,
    estimatedConsultationTime,
    patientsAhead,
    loading,
    form,
    phoneNumber,
    setPhoneNumber,
    isSearchingPatient,
    searchedPatients,
    showForm,
    selectedPatientId,
    selectPatient,
    isDoctorConsultingNow,
    onSubmit,
    handleForceBook,
    handleProceedToToken,
    showForceBookDialog,
    setShowForceBookDialog,
    isWithin15MinutesOfClosing,
  };
}
