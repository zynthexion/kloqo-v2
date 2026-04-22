'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api-client';

const formSchema = z.object({
  patientName: z.string()
    .min(3, { message: "Name must be at least 3 characters." })
    .regex(/^[a-zA-Z\s\.\-]+$/, { message: "Name can only contain alphabets, spaces, dots, and hyphens." }),
  age: z.coerce.number({ required_error: "Age is required.", invalid_type_error: "Age must be a number." })
    .min(0, { message: "Age must be a positive number." })
    .max(120, { message: "Age must be less than 120." }),
  phone: z.string().optional().refine(val => !val || val.replace(/\D/g, '').length === 10, "Invalid 10-digit number"),
  communicationPhone: z.string().optional().refine(val => !val || val.replace(/\D/g, '').length === 10, "Invalid communication phone"),
  place: z.string().min(2, { message: "Location is required." }),
  sex: z.enum(["Male", "Female", "Other"], { required_error: "Please select a gender." }),
});

export type FormValues = z.infer<typeof formSchema>;

export type WalkInStep = 'identify' | 'preview' | 'confirm';

export function useWalkInFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();

  const doctorId = searchParams.get('doctor');
  const clinicId = user?.clinicId || searchParams.get('clinicId');

  const [currentStep, setCurrentStep] = useState<WalkInStep>('identify');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);
  const [searchedPatients, setSearchedPatients] = useState<any[]>([]);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [primaryPatient, setPrimaryPatient] = useState<any | null>(null);
  const [relatives, setRelatives] = useState<any[]>([]);
  const [isAddRelativeDialogOpen, setIsAddRelativeDialogOpen] = useState(false);
  
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [walkInPreview, setWalkInPreview] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedAppointment, setConfirmedAppointment] = useState<any>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      patientName: '',
      age: 0,
      phone: '',
      place: '',
      sex: 'Male',
    },
  });

  // 🔍 Step 1: Patient Search Logic
  const handlePatientSearch = useCallback(async (phone: string) => {
    if (phone.length < 10 || !clinicId) return;
    setIsSearchingPatient(true);
    setSearchedPatients([]);
    setShowRegistrationForm(false);
    setSelectedPatient(null);
    setPrimaryPatient(null);
    setRelatives([]);

    try {
      const { patient, relatedProfiles } = await apiRequest<{ patient: any, relatedProfiles: any[] }>(
        `/patients/profile?phone=${encodeURIComponent(phone)}&clinicId=${clinicId}`
      );
      
      const allMatches = patient ? [patient, ...relatedProfiles] : relatedProfiles;
      setSearchedPatients(allMatches);
      setPrimaryPatient(patient);
      setRelatives(relatedProfiles);

      if (allMatches.length === 0) {
        setShowRegistrationForm(true);
        form.setValue('phone', phone);
      }
    } catch (error) {
      console.error("Error searching patient:", error);
      toast({ variant: 'destructive', title: 'Search Error', description: 'Could not perform patient search.' });
    } finally {
      setIsSearchingPatient(false);
    }
  }, [clinicId, toast, form]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (phoneNumber && phoneNumber.length === 10) {
        handlePatientSearch(phoneNumber);
      }
    }, 500);
    return () => clearTimeout(debounceTimer);
  }, [phoneNumber, handlePatientSearch]);

  const selectPatient = useCallback((patient: any, skipPreview = false) => {
    if (!patient) {
      setSelectedPatient(null);
      form.reset({
        patientName: '',
        age: undefined,
        place: '',
        sex: 'Male' as any,
        phone: '',
        communicationPhone: '',
      });
      return;
    }

    setSelectedPatient(patient);
    form.reset({
      patientName: patient.name || '',
      age: patient.age !== undefined ? Number(patient.age) : undefined,
      place: patient.place || '',
      sex: (['Male', 'Female', 'Other'].includes(patient.sex) ? patient.sex : "Male") as any,
      phone: (patient.phone || "").replace('+91', ''),
      communicationPhone: (patient.communicationPhone || "").replace('+91', ''),
    });
    // For existing patients, we go straight to preview once selected (unless skipped)
    if (!skipPreview) {
      proceedToPreview({
        ...patient,
        patientName: patient.name,
        age: Number(patient.age),
        phone: patient.phone,
      });
    }
  }, [form]);

  // 🕒 Step 2: Preview Logic
  const proceedToPreview = async (patientInfo: any, skipStepChange = false) => {
    if (!doctorId || !clinicId) return;
    setSelectedPatient(patientInfo);
    setIsPreviewLoading(true);
    if (!skipStepChange) {
      setCurrentStep('preview');
    }
    
    try {
      const dateStr = new Date().toLocaleDateString('en-CA'); // yyyy-mm-dd
      const preview = await apiRequest<any>(
        `/appointments/walk-in-preview?doctorId=${doctorId}&clinicId=${clinicId}&date=${dateStr}`
      );
      setWalkInPreview(preview);
      return preview;
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Preview Error', description: error.message });
      if (!skipStepChange) {
        setCurrentStep('identify');
      }
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // 📝 Registration Form Submission (if new patient)
  const onRegistrationSubmit = async (values: FormValues, skipPreview = false) => {
    if (!clinicId || !doctorId) return;
    setIsSubmitting(true);
    try {
      // First manage the patient
      const { patientId } = await apiRequest<any>('/patients/manage', {
        method: 'POST',
        body: JSON.stringify({
          name: values.patientName,
          age: values.age,
          sex: values.sex,
          place: values.place,
          id: selectedPatient?.id || selectedPatient?._id,
          clinicId,
          phone: values.phone ? `+91${values.phone.replace(/\D/g, '')}` : '',
          communicationPhone: values.communicationPhone ? `+91${values.communicationPhone.replace(/\D/g, '')}` : ''
        })
      });

      const patientResult = { ...values, id: patientId };
      // Then proceed to preview (unless skipped)
      if (!skipPreview) {
        await proceedToPreview(patientResult);
      } else {
        setSelectedPatient(patientResult);
      }
      return patientResult;
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ Step 3: Final Confirmation
  // Returns the appointment on success, or null on failure.
  // skipConfirmStep=true lets the caller (e.g. drawer) close immediately
  // rather than showing the in-drawer success screen.
  const confirmBooking = async (skipConfirmStep = false) => {
    if (!doctorId || !clinicId || !selectedPatient) return null;
    setIsSubmitting(true);
    try {
      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const apt = await apiRequest<any>('/appointments/walk-in', {
        method: 'POST',
        body: JSON.stringify({
          patientName: selectedPatient.patientName || selectedPatient.name,
          age: selectedPatient.age,
          sex: selectedPatient.sex,
          place: selectedPatient.place,
          phone: selectedPatient.phone,
          patientId: selectedPatient.id,
          doctorId,
          clinicId,
          date: dateStr
        })
      });

      setConfirmedAppointment(apt);
      if (!skipConfirmStep) {
        setCurrentStep('confirm');
      }
      toast({ title: '✅ Walk-in Registered', description: `Token ${apt.tokenNumber} allotted successfully.` });
      return apt;
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Booking Failed', description: error.message });
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    doctorId,
    clinicId,
    currentStep,
    setCurrentStep,
    phoneNumber,
    setPhoneNumber,
    isSearchingPatient,
    searchedPatients,
    showRegistrationForm,
    setShowRegistrationForm,
    selectedPatient,
    primaryPatient,
    relatives,
    isAddRelativeDialogOpen,
    setIsAddRelativeDialogOpen,
    isPreviewLoading,
    walkInPreview,
    isSubmitting,
    confirmedAppointment,
    form,
    handlePatientSearch,
    selectPatient,
    onRegistrationSubmit,
    confirmBooking,
    router
  };
}
