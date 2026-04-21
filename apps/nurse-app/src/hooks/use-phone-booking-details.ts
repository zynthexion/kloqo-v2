import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, addDays, subMinutes } from 'date-fns';
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

export type FormValues = {
  patientName: string;
  age: number;
  phone: string;
  communicationPhone?: string;
  place: string;
  sex: "Male" | "Female" | "Other";
};

export function usePhoneBookingDetails() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();

  const doctorId = searchParams.get('doctor');
  const clinicId = user?.clinicId || searchParams.get('clinicId') || searchParams.get('clinic');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [searchedPatients, setSearchedPatients] = useState<any[]>([]);
  const [linkPendingPatients, setLinkPendingPatients] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [primaryPatient, setPrimaryPatient] = useState<any | null>(null);
  const [relatives, setRelatives] = useState<any[]>([]);
  const [isAddRelativeDialogOpen, setIsAddRelativeDialogOpen] = useState(false);
  const [nextSlotHint, setNextSlotHint] = useState<{ date: string, time: string, reportingTime: string } | null>(null);

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

  // Fetch link-pending patients
  useEffect(() => {
    const fetchLinkPending = async () => {
      if (!clinicId) return;
      try {
        const data = await apiRequest<any[]>(`/patients/link-pending?clinicId=${clinicId}`);
        setLinkPendingPatients(data);
      } catch (error) {
        console.error("Error fetching link-pending patients:", error);
      }
    };
    fetchLinkPending();
  }, [clinicId]);

  // Fetch next available slot hint
  useEffect(() => {
    const fetchNextSlot = async () => {
      if (!doctorId || !clinicId) return;
      try {
        const today = new Date();
        for (let i = 0; i < 7; i++) {
          const dateStr = format(addDays(today, i), 'yyyy-MM-dd');
          const slots = await apiRequest<any[]>(
            `/appointments/available-slots?doctorId=${doctorId}&clinicId=${clinicId}&date=${encodeURIComponent(dateStr)}`
          );
          const firstAvailable = slots.find((s: any) => s.status === 'available');
          if (firstAvailable) {
            const slotTime = new Date(firstAvailable.time);
            const reportingTime = subMinutes(slotTime, 15);
            setNextSlotHint({
              date: i === 0 ? 'Today' : format(slotTime, 'd MMM'),
              time: format(slotTime, 'hh:mm a'),
              reportingTime: format(reportingTime, 'hh:mm a')
            });
            break;
          }
        }
      } catch (error) {
        console.error("Error fetching next slot:", error);
      }
    };
    fetchNextSlot();
  }, [doctorId, clinicId]);

  const handlePatientSearch = useCallback(async (phone: string) => {
    if (phone.length < 10 || !clinicId) return;
    setIsSearchingPatient(true);
    setSearchedPatients([]);
    setShowForm(false);
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
        setShowForm(true);
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

  const selectPatient = useCallback((patient: any) => {
    setSelectedPatient(patient);
    form.reset({
      patientName: patient.name || '',
      age: patient.age !== undefined ? Number(patient.age) : undefined,
      place: patient.place || '',
      sex: (['Male', 'Female', 'Other'].includes(patient.sex) ? patient.sex : "Male") as any,
      phone: (patient.phone || "").replace('+91', ''),
      communicationPhone: (patient.communicationPhone || "").replace('+91', ''),
    });
    setShowForm(true);
  }, [form]);

  const handleRelativeAdded = useCallback((newRelative: any) => {
    setRelatives(prev => [...prev, newRelative]);
    selectPatient(newRelative);
  }, [selectPatient]);

  const onSubmit = async (values: FormValues) => {
    if (!clinicId || !doctorId) return;
    setIsSubmitting(true);
    try {
      const { patientId } = await apiRequest<any>('/patients/manage', {
        method: 'POST',
        body: JSON.stringify({
          name: values.patientName,
          age: values.age,
          sex: values.sex,
          place: values.place,
          id: selectedPatient?.id,
          clinicId,
          phone: values.phone ? `+91${values.phone.replace(/\D/g, '')}` : '',
          communicationPhone: values.communicationPhone ? `+91${values.communicationPhone.replace(/\D/g, '')}` : ''
        })
      });

      router.push(`/appointments/book?doctor=${doctorId}&patientId=${patientId}&source=phone`);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendLink = useCallback(async () => {
    if (phoneNumber.length !== 10) {
      toast({ variant: 'destructive', title: 'Invalid Phone', description: 'Enter 10-digit phone number.' });
      return;
    }
    setIsSendingLink(true);
    try {
      await apiRequest('/notifications/send-link', {
        method: 'POST',
        body: JSON.stringify({
          phone: `+91${phoneNumber}`,
          clinicId,
          patientName: phoneNumber // Default to phone if name unknown
        })
      });

      toast({ title: 'Success', description: 'Booking link sent via WhatsApp.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not send link.' });
    } finally {
      setIsSendingLink(false);
    }
  }, [phoneNumber, clinicId, toast]);

  return {
    doctorId,
    clinicId,
    phoneNumber,
    setPhoneNumber,
    isSubmitting,
    isSearchingPatient,
    isSendingLink,
    searchedPatients,
    linkPendingPatients,
    showForm,
    setShowForm,
    selectedPatient,
    primaryPatient,
    relatives,
    isAddRelativeDialogOpen,
    setIsAddRelativeDialogOpen,
    nextSlotHint,
    form,
    handlePatientSearch,
    selectPatient,
    handleRelativeAdded,
    onSubmit,
    handleSendLink,
    router
  };
}
