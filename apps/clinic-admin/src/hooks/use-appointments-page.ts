'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { 
  format, 
  getDay, 
  isToday, 
  isBefore, 
  isAfter, 
  startOfDay, 
  addDays,
  addMinutes,
  subMinutes,
  parse,
  isSameDay
} from 'date-fns';
import { 
  getClinicNow,
  getClinicISOString,
  getClinic12hTimeString,
  parseClinicDate,
  isSlotBlockedByLeave,
  isDoctorAdvanceCapacityReachedOnDate,
  computeQueues
} from '@kloqo/shared-core';
import { apiRequest } from '@/lib/api-client';
import type { Appointment, Patient } from '@kloqo/shared';
import { DateRange } from "react-day-picker";
import { useAppointmentSSE } from './appointments/useAppointmentSSE';
import { useAppointmentMutations, useAppointmentQueue } from '@kloqo/shared';

const formSchema = z.object({
  id: z.string().optional(),
  patientName: z.string().min(3).regex(/^[a-zA-Z\s]+$/),
  sex: z.enum(["Male", "Female", "Other"]),
  phone: z.string().optional().refine(val => !val || val.replace(/\D/g, '').length === 10, "Invalid 10-digit number"),
  communicationPhone: z.string().optional().refine(val => !val || val.replace(/\D/g, '').length === 10, "Invalid communication phone"),
  age: z.coerce.number().min(1).max(120),
  doctorId: z.string().min(1, "Doctor is required"),
  department: z.string().min(1),
  date: z.date().optional(),
  time: z.string().optional(),
  slotIndex: z.number().optional(),
  sessionIndex: z.number().optional(),
  place: z.string().min(2),
  bookedVia: z.enum(["Advanced Booking", "Walk-in"]),
}).refine(data => data.bookedVia === 'Advanced Booking' ? !!data.date && !!data.time : true, { path: ["time"] });

export type AppointmentFormValues = z.infer<typeof formSchema>;
const SWIPE_COOLDOWN_MS = 30 * 1000;
const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function useAppointmentsPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const sse = useAppointmentSSE();
  
  const [drawerSearchTerm, setDrawerSearchTerm] = useState("");
  const [selectedDrawerDoctor, setSelectedDrawerDoctor] = useState<string | null>(null);
  const [patientSearchTerm, setPatientSearchTerm] = useState("");
  const [patientSearchResults, setPatientSearchResults] = useState<Patient[]>([]);
  const [isPatientPopoverOpen, setIsPatientPopoverOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [primaryPatient, setPrimaryPatient] = useState<Patient | null>(null);
  const [hasSelectedOption, setHasSelectedOption] = useState(false);
  const [activeTab, setActiveTab] = useState("arrived");
  const [currentTime, setCurrentTime] = useState(getClinicNow());
  const [swipeCooldownUntil, setSwipeCooldownUntil] = useState<number | null>(null);
  const [walkInEstimate, setWalkInEstimate] = useState<any>(null);
  const [isCalculatingEstimate, setIsCalculatingEstimate] = useState(false);
  const [isForceBookedState, setIsForceBookedState] = useState(false);
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'registration' | 'monitoring' | 'records'>('registration');
  const [bookingFor, setBookingFor] = useState<'member' | 'relative'>('member');
  const [relatives, setRelatives] = useState<Patient[]>([]);
  const [isAddRelativeDialogOpen, setIsAddRelativeDialogOpen] = useState(false);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [appointmentToAddToQueue, setAppointmentToAddToQueue] = useState<Appointment | null>(null);
  const [appointmentToComplete, setAppointmentToComplete] = useState<Appointment | null>(null);
  const [appointmentToPrioritize, setAppointmentToPrioritize] = useState<Appointment | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [showVisualView, setShowVisualView] = useState(false);
  const [walkInEstimateUnavailable, setWalkInEstimateUnavailable] = useState(false);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [drawerDateRange, setDrawerDateRange] = useState<DateRange | undefined>({ 
    from: startOfDay(getClinicNow()), 
    to: addDays(getClinicNow(), 30) 
  });
  const [sessionSlots, setSessionSlots] = useState<any[]>([]);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);

  const patientInputRef = useRef<HTMLInputElement>(null);

  const queue = useAppointmentQueue({ 
    appointments: sse.appointments, 
    doctors: sse.doctors, 
    clinicId: currentUser?.clinicId || "", 
    drawerSearchTerm, 
    selectedDrawerDoctor,
    // Add the injection for queue algorithms
    computeQueues: (appointments, doctorName, doctorId, clinicId, dateStr, delay) => 
      computeQueues(appointments, doctorName, doctorId, clinicId, dateStr, delay)
  });

  const mutations = useAppointmentMutations({ 
    updateStatus: sse.updateStatus, 
    bookAppointment: sse.bookAppointment, 
    deleteAppointment: sse.deleteAppointment, 
    sendBookingLink: sse.sendBookingLink,
  });


  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      patientName: "", 
      phone: "", 
      doctorId: "", // Initial empty, will be populated by effect
      department: "", 
      bookedVia: "Advanced Booking" 
    },
  });

  // 🏥 DOCTOR SYNC FIX: Auto-initialize form when doctors load
  useEffect(() => {
    if (sse.doctors.length > 0 && !form.getValues('doctorId')) {
      const firstDoc = sse.doctors[0];
      form.setValue('doctorId', firstDoc.id);
      form.setValue('department', firstDoc.department || "");
    }
  }, [sse.doctors, form]);

  const watchedPatientName = useWatch({ control: form.control, name: 'patientName' });
  const watchedDoctorId = useWatch({ control: form.control, name: 'doctorId' });
  const selectedDate = useWatch({ control: form.control, name: 'date' });
  const appointmentType = useWatch({ control: form.control, name: 'bookedVia' });
  
  // 🏥 DOCTOR SYNC FIX: Ensure selectedDoctor always follows the form, but falls back to doctors[0] for safety
  const selectedDoctor = useMemo(() => {
    if (!watchedDoctorId && sse.doctors.length > 0) return sse.doctors[0];
    return sse.doctors.find(d => d.id === watchedDoctorId) || null;
  }, [sse.doctors, watchedDoctorId]);

  const availableDaysOfWeek = useMemo(() => {
    if (!selectedDoctor?.availabilitySlots) return [];
    return selectedDoctor.availabilitySlots.map(s => daysOfWeek.indexOf(s.day)).filter(i => i !== -1);
  }, [selectedDoctor]);

  const leaveDates = useMemo(() => [] as Date[], []);

  const isDateDisabled = useCallback((date: Date) => {
    if (!selectedDoctor) return true;
    
    // Principal SRE Catch: Sync baseline with IST
    const baseline = getClinicNow();
    const todayAtMidnight = startOfDay(baseline);

    if (appointmentType === 'Walk-in') return !isSameDay(date, baseline);
    
    const isPastDate = isBefore(date, todayAtMidnight);
    const isTodaySelected = isSameDay(date, baseline);
    
    const isNotAvailableDay = !availableDaysOfWeek.includes(getDay(date));
    const isOnLeave = leaveDates.some(ld => isSameDay(date, ld));
    
    // Standardized logic: advanceBookingDays = Today + N more days (Total N+1 days)
    const advanceBookingDays = (selectedDoctor as any).advanceBookingDays ?? 7;
    const cutoffDate = addDays(todayAtMidnight, advanceBookingDays);
    const isBeyondLimit = isAfter(date, cutoffDate);

    // FIX: Allow Today even if getClinicNow() is slightly ahead of local midnight
    if (isTodaySelected) return isNotAvailableDay || isOnLeave;

    return isPastDate || isNotAvailableDay || isOnLeave || isBeyondLimit;
  }, [selectedDoctor, appointmentType, availableDaysOfWeek, leaveDates]);

  const isAdvanceCapacityReached = useMemo(() => {
    if (!selectedDoctor || appointmentType !== 'Advanced Booking' || !selectedDate) return false;
    return isDoctorAdvanceCapacityReachedOnDate(selectedDoctor, selectedDate, sse.appointments);
  }, [selectedDoctor, selectedDate, sse.appointments, appointmentType]);

  const isBookingButtonDisabled = useMemo(() => {
    if (mutations.isPending) return true;
    if (appointmentType === 'Walk-in') return !watchedPatientName || !walkInEstimate || isCalculatingEstimate;
    return !form.formState.isValid || isAdvanceCapacityReached || !form.watch('time');
  }, [mutations.isPending, appointmentType, watchedPatientName, walkInEstimate, isCalculatingEstimate, form.formState.isValid, isAdvanceCapacityReached, form.watch('time')]);

  useEffect(() => {
    if (watchedDoctorId && selectedDate && appointmentType === 'Advanced Booking') {
      const fetchSlots = async () => {
        setIsSlotsLoading(true);
        try {
          const dateStr = getClinicISOString(selectedDate);
          const clinicId = sse.clinicDetails?.id;
          let url = `/api/doctors/${watchedDoctorId}/slots?date=${dateStr}`;
          if (clinicId) url += `&clinicId=${clinicId}`;
          
          const response = await apiRequest<any>(url);
          const slots = response.slots || [];
          
          // ENFORCE STRICT SINGLE SLOT POLICY:
          // Find the absolute FIRST available slot for the entire day.
          // Discard all other future sessions to maximize booking density.
          const firstAvailable = slots.find((s: any) => s.status === 'available' && s.isAvailable);
          
          if (firstAvailable) {
            setSessionSlots([{
              title: `Session ${firstAvailable.sessionIndex + 1}`,
              slots: [{
                time: getClinic12hTimeString(subMinutes(new Date(firstAvailable.time), 15)),
                status: firstAvailable.status,
                tokenNumber: firstAvailable.tokenNumber,
                slotIndex: firstAvailable.slotIndex,
                sessionIndex: firstAvailable.sessionIndex
              }]
            }]);
          } else {
            setSessionSlots([]);
          }
        } catch (error) {
          console.error('[Slots] Fetch failed:', error);
          toast({
            title: "Slot Fetch Error",
            description: error instanceof Error ? error.message : "Possible doctor availability issue",
            variant: "destructive"
          });
          setSessionSlots([]);
        } finally {
          setIsSlotsLoading(false);
        }
      };
      fetchSlots();
    } else {
      setSessionSlots([]);
    }
  }, [watchedDoctorId, selectedDate, appointmentType]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getClinicNow()), 60000);
    return () => clearInterval(timer);
  }, []);

  const resetForm = useCallback(() => {
    form.reset({ 
      patientName: "", 
      phone: "", 
      communicationPhone: "",
      doctorId: sse.doctors[0]?.id || "", 
      department: sse.doctors[0]?.department || "", 
      bookedVia: "Advanced Booking" 
    });
    setPatientSearchTerm("");
    setSelectedPatient(null);
    setPrimaryPatient(null);
    setRelatives([]);
    setBookingFor('member');
    setHasSelectedOption(false);
    setEditingAppointment(null);
  }, [form, sse.doctors]);

  useEffect(() => {
    if (appointmentType === 'Walk-in' && selectedDoctor && selectedDate) {
      setIsCalculatingEstimate(true);
      const dateStr = `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}-${selectedDate.getDate().toString().padStart(2, '0')}`;
      sse.getWalkInEstimate(selectedDoctor.id, dateStr, isForceBookedState)
        .then(details => setWalkInEstimate(details))
        .catch(() => setWalkInEstimateUnavailable(true))
        .finally(() => setIsCalculatingEstimate(false));
    }
  }, [appointmentType, selectedDoctor, selectedDate, isForceBookedState, sse]);

  const handlePatientSelect = useCallback((p: Patient) => {
    setSelectedPatient(p);
    setPrimaryPatient(p);
    setHasSelectedOption(true);
    form.setValue('patientName', p.name);
    form.setValue('phone', (p.phone || "").replace('+91', ''));
    form.setValue('communicationPhone', (p.communicationPhone || "").replace('+91', ''));
    form.setValue('age', p.age || 0);
    form.setValue('sex', (p.sex ? p.sex.charAt(0).toUpperCase() + p.sex.slice(1).toLowerCase() : "Male") as any);
    form.setValue('place', p.place || "");
    setIsPatientPopoverOpen(false);
  }, [form]);

  const [isSearchingPatients, setIsSearchingPatients] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // 1. Patient Search Effect (Debounced)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    // If we are currently editing an appointment, don't trigger search
    if (editingAppointment) return;

    if (patientSearchTerm.length < 3) {
      setPatientSearchResults([]);
      setRelatives([]);
      setPrimaryPatient(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingPatients(true);
      try {
        // Special Case: 10-digit exact lookup for profile & relatives
        if (patientSearchTerm.length === 10) {
          const profile = await sse.getPatientProfile(patientSearchTerm);
          const primaryData = (profile as any).patient || (profile as any).primary;
          const relativesData = (profile as any).relatedProfiles || (profile as any).relatives || [];
          
          setPrimaryPatient(primaryData || null);
          setRelatives(relativesData);
          
          if (primaryData) {
            // Populate results with BOTH primary and relatives for the UI cards
            setPatientSearchResults([primaryData, ...relativesData]);
            
            toast({
              title: "Member Found",
              description: `Showing ${primaryData.name}${relativesData.length > 0 ? ` and ${relativesData.length} family member(s)` : ''}.`
            });
          } else {
            setPatientSearchResults([]);
          }
          setIsSearchingPatients(false);
          return;
        }

        // Default Case: Generic search for popover/list
        const results = await sse.searchPatients(patientSearchTerm);
        setPatientSearchResults(results);
      } catch (error) {
        console.error('[Patient Search] Error:', error);
      } finally {
        setIsSearchingPatients(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [patientSearchTerm, sse.getPatientProfile, sse.searchPatients, toast, editingAppointment]);

  const state = useMemo(() => ({
    ...sse, ...queue, ...mutations,
    drawerSearchTerm, selectedDrawerDoctor, patientSearchTerm, patientSearchResults,
    isPatientPopoverOpen, selectedPatient, primaryPatient, hasSelectedOption,
    activeTab, currentTime, walkInEstimate, isCalculatingEstimate, isForceBookedState,
    isDrawerExpanded, bookingFor, relatives, isAddRelativeDialogOpen, isTokenModalOpen,
    generatedToken, appointmentToCancel, appointmentToAddToQueue, appointmentToComplete,
    appointmentToPrioritize, editingAppointment, showVisualView, walkInEstimateUnavailable,
    isSendingLink, drawerDateRange, selectedDoctor, appointmentType, watchedPatientName,
    isDateDisabled, availableDaysOfWeek, leaveDates, isAdvanceCapacityReached,
    isBookingButtonDisabled, todayDateStr: queue.todayDateStr, swipeCooldownUntil,
    sessionSlots, layoutMode, isSlotsLoading,
    isPending: sse.loading || mutations.isPending || isSearchingPatients // Aggregated pending state
  }), [
    sse, queue, mutations, drawerSearchTerm, selectedDrawerDoctor, patientSearchTerm, 
    patientSearchResults, isPatientPopoverOpen, selectedPatient, primaryPatient, 
    hasSelectedOption, activeTab, currentTime, walkInEstimate, isCalculatingEstimate, 
    isForceBookedState, isDrawerExpanded, bookingFor, relatives, isAddRelativeDialogOpen, 
    isTokenModalOpen, generatedToken, appointmentToCancel, appointmentToAddToQueue, 
    appointmentToComplete, appointmentToPrioritize, editingAppointment, showVisualView, 
    walkInEstimateUnavailable, isSendingLink, drawerDateRange, selectedDoctor, 
    appointmentType, watchedPatientName, isDateDisabled, availableDaysOfWeek, 
    leaveDates, isAdvanceCapacityReached, isBookingButtonDisabled, swipeCooldownUntil, 
    sessionSlots, layoutMode, isSlotsLoading, isSearchingPatients
  ]);

  const handleComplete = useCallback((apt: Appointment) => { 
    mutations.handleComplete(apt, () => setSwipeCooldownUntil(Date.now() + SWIPE_COOLDOWN_MS)); 
    setAppointmentToComplete(null); 
  }, [mutations]);

  const handleAddToQueue = useCallback((apt: Appointment) => { 
    mutations.handleAddToQueue(apt); 
    setAppointmentToAddToQueue(null); 
  }, [mutations]);

  const onSubmit = useCallback((v: any) => {
    const payload = {
      ...v,
      date: v.date ? getClinicISOString(v.date) : undefined,
      patientId: selectedPatient?.id
    };
    mutations.onMutationSubmit(payload, resetForm);
  }, [mutations, selectedPatient, resetForm]);

  const handleRelativeSelect = useCallback((p: Patient) => { 
    setBookingFor('relative'); 
    setSelectedPatient(p); 
    form.setValue('patientName', p.name); 
  }, [form]);

  const handlePatientSearchChange = useCallback((e: any) => {
    const val = e.target.value.replace(/\D/g, '');
    setPatientSearchTerm(val);
    if (val.length > 0 && !isPatientPopoverOpen) setIsPatientPopoverOpen(true);
  }, [isPatientPopoverOpen]);

  const handleSendLink = useCallback(async () => { 
    setIsSendingLink(true); 
    try { 
      await sse.sendBookingLink(patientSearchTerm); 
      toast({ title: "Link Sent" }); 
    } catch (e) {} finally { 
      setIsSendingLink(false); 
    } 
  }, [sse, patientSearchTerm, toast]);

  const handleForceBookEstimate = useCallback(async () => { 
    setIsForceBookedState(true); 
  }, []);

  const isAppointmentOnLeave = useCallback((apt: Appointment) => { 
    const doc = sse.doctors.find(d => d.name === apt.doctor); 
    if (!doc) return false; 
    return isSlotBlockedByLeave(doc, parseClinicDate(apt.date)); 
  }, [sse.doctors]);

  const handleRejoinQueue = useCallback(async (apt: Appointment) => { 
    try { 
      await sse.updateStatus(apt.id, 'Confirmed'); 
      toast({ title: "Rejoined Queue" }); 
    } catch (e) {} 
  }, [sse, toast]);

  const onDoctorChange = useCallback((id: string) => { 
    const d = sse.doctors.find(doc => doc.id === id); 
    if (d) { 
      form.setValue('doctorId', d.id); 
      form.setValue('department', d.department || ""); 
    } 
  }, [sse.doctors, form]);

  const handlePrioritize = useCallback(async () => { 
    if (appointmentToPrioritize) { 
      try { 
        await sse.updateStatus(appointmentToPrioritize.id, appointmentToPrioritize.status, undefined, !appointmentToPrioritize.isPriority); 
        toast({ title: "Updated Priority" }); 
      } finally { 
        setAppointmentToPrioritize(null); 
      } 
    } 
  }, [sse, appointmentToPrioritize, toast]);

  const handleNewRelativeAdded = useCallback((p: Patient) => { 
    setRelatives(prev => [...prev, p]); 
    handlePatientSelect(p); 
  }, [handlePatientSelect]);

  const actions = useMemo(() => ({
    setDrawerSearchTerm, setSelectedDrawerDoctor, setPatientSearchTerm, setIsPatientPopoverOpen,
    setSelectedPatient, setPrimaryPatient, setHasSelectedOption, setActiveTab, setIsDrawerExpanded,
    setBookingFor, setIsAddRelativeDialogOpen, setIsTokenModalOpen, setAppointmentToCancel,
    setAppointmentToAddToQueue, setAppointmentToComplete, setAppointmentToPrioritize,
    setEditingAppointment, setShowVisualView, setDrawerDateRange, resetForm,
    setLayoutMode,
    handleCancel: mutations.handleCancel,
    handleComplete,
    handleAddToQueue,
    onSubmit,
    handlePatientSelect,
    handleRelativeSelect,
    handlePatientSearchChange,
    handleSendLink,
    handlePatientSearch: sse.searchPatients,
    handleForceBookEstimate,
    isAppointmentOnLeave,
    getDisplayTimeForAppointment: (apt: Appointment) => apt.time || "",
    handleRejoinQueue,
    onDoctorChange,
    handleSkip: mutations.handleSkip,
    handlePrioritize,
    handleNewRelativeAdded
  }), [
    resetForm, mutations.handleCancel, mutations.handleSkip, handleComplete, 
    handleAddToQueue, onSubmit, handlePatientSelect, handleRelativeSelect, 
    handlePatientSearchChange, handleSendLink, sse.searchPatients, 
    handleForceBookEstimate, isAppointmentOnLeave, handleRejoinQueue, 
    onDoctorChange, handlePrioritize, handleNewRelativeAdded
  ]);

  return useMemo(() => ({ state, actions, form, patientInputRef }), [state, actions, form]);
}
