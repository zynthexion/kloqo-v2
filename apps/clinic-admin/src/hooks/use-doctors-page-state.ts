'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { subDays, format } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
import type { Doctor, Appointment, Department } from '@kloqo/shared';
import { parseTime } from '@kloqo/shared-core';

const timeSlotSchema = z.object({
  from: z.string().min(1, "Required"),
  to: z.string().min(1, "Required"),
});

const availabilitySlotSchema = z.object({
  day: z.string(),
  timeSlots: z.array(timeSlotSchema).min(1, "At least one time slot is required."),
});

const weeklyAvailabilityFormSchema = z.object({
  availableDays: z.array(z.string()).default([]),
  availabilitySlots: z.array(availabilitySlotSchema),
});

export type WeeklyAvailabilityFormValues = z.infer<typeof weeklyAvailabilityFormSchema>;

/**
 * useDoctorsPageState
 * Specialized hook for managing the complex doctors dashboard state.
 * Handles meta-orchestration of doctor profiles, clinical availability,
 * session management, access control, and appointment integrations.
 */
export function useDoctorsPageState() {
  const auth = useAuth();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const doctorIdFromUrl = searchParams.get('doctorId');

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [clinicDepartments, setClinicDepartments] = useState<Department[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clinicDetails, setClinicDetails] = useState<any | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [activeTab, setActiveTab] = useState("details");
  const [dateRange, setDateRange] = useState({ from: subDays(new Date(), 29), to: new Date() });
  const [leaveCalDate, setLeaveCalDate] = useState<Date>(new Date());
  const [allBookedSlots, setAllBookedSlots] = useState<number[]>([]);

  // Permission state
  const [tempAccessibleMenus, setTempAccessibleMenus] = useState<string[]>([]);
  const [isSavingAccess, setIsSavingAccess] = useState(false);
  const [isRevokingAccess, setIsRevokingAccess] = useState(false);

  const form = useForm<WeeklyAvailabilityFormValues>({
    resolver: zodResolver(weeklyAvailabilityFormSchema),
    defaultValues: { availableDays: [], availabilitySlots: [] },
    mode: "onBlur",
  });

  const fetchAllData = useCallback(async () => {
    try {
      const [doctorsList, appointmentsList, masterDepartmentsList, clinicData] = await Promise.all([
        apiRequest<Doctor[]>('/clinic/doctors'),
        apiRequest<Appointment[]>('/clinic/appointments'),
        apiRequest<Department[]>('/clinic/departments/master'),
        apiRequest<any>('/clinic/me')
      ]);

      setClinicDetails(clinicData);
      if (clinicData) {
        const departmentIds: string[] = clinicData.departments || [];
        const safeMasterDepts = Array.isArray(masterDepartmentsList) ? masterDepartmentsList : ((masterDepartmentsList as any)?.data || []);
        setClinicDepartments(safeMasterDepts.filter((masterDept: any) => departmentIds.includes(masterDept.id)));
      }

      setDoctors(doctorsList);
      setAppointments(appointmentsList);

      if (!selectedDoctor && doctorsList.length > 0) {
        if (doctorIdFromUrl) {
          setSelectedDoctor(doctorsList.find(d => d.id === doctorIdFromUrl) || doctorsList[0]);
        } else {
          setSelectedDoctor(doctorsList[0]);
        }
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load clinic data.' });
    }
  }, [toast, selectedDoctor, doctorIdFromUrl]);

  useEffect(() => {
    if (auth.currentUser) fetchAllData();
  }, [auth.currentUser, fetchAllData]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedDoctor && leaveCalDate) {
      const dateStr = format(leaveCalDate, "d MMMM yyyy");
      const apptsOnDate = appointments.filter(a => a.doctor === selectedDoctor.name && a.date === dateStr);
      setAllBookedSlots(apptsOnDate.map(a => parseTime(a.time, leaveCalDate).getTime()));
    }
  }, [selectedDoctor, leaveCalDate, appointments]);

  useEffect(() => {
    if (selectedDoctor) {
      setTempAccessibleMenus(selectedDoctor.accessibleMenus || []);
      form.reset({ availabilitySlots: selectedDoctor.availabilitySlots || [] });
    }
  }, [selectedDoctor, form]);

  const handleSaveAccess = async () => {
    if (!selectedDoctor) return;
    setIsSavingAccess(true);
    try {
      await apiRequest(`/clinic/doctors/${selectedDoctor.id}/access`, {
        method: "PUT",
        body: JSON.stringify({ accessibleMenus: tempAccessibleMenus }),
      });
      setSelectedDoctor(prev => prev ? { ...prev, accessibleMenus: tempAccessibleMenus } : null);
      setDoctors(prev => prev.map(d => d.id === selectedDoctor.id ? { ...d, accessibleMenus: tempAccessibleMenus } : d));
      toast({ title: "Access Updated" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsSavingAccess(false);
    }
  };

  const handleRevokeAccess = async () => {
    if (!selectedDoctor) return;
    setIsRevokingAccess(true);
    try {
      await apiRequest(`/clinic/doctors/${selectedDoctor.id}/access`, { method: "DELETE" });
      setSelectedDoctor(prev => prev ? { ...prev, accessibleMenus: [] } : null);
      setDoctors(prev => prev.map(d => d.id === selectedDoctor.id ? { ...d, accessibleMenus: [] } : d));
      setTempAccessibleMenus([]);
      toast({ title: "Access Revoked" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsRevokingAccess(false);
    }
  };

  const updateDoctorField = async (field: keyof Doctor, value: any) => {
    await updateDoctorFields({ [field]: value });
  };

  const updateDoctorFields = async (updates: Partial<Doctor>) => {
    if (!selectedDoctor) return;
    startTransition(async () => {
      try {
        const updatedDoctor = { ...selectedDoctor, ...updates };
        await apiRequest('/clinic/doctors', { method: 'POST', body: JSON.stringify(updatedDoctor) });
        setSelectedDoctor(updatedDoctor);
        setDoctors(prev => prev.map(d => d.id === selectedDoctor.id ? updatedDoctor : d));
        toast({ title: "Updated successfully" });
      } catch (e) {
        toast({ variant: 'destructive', title: 'Update Failed' });
      }
    });
  };

  return {
    doctors, selectedDoctor, setSelectedDoctor,
    clinicDepartments, appointments, clinicDetails, currentTime,
    activeTab, setActiveTab,
    dateRange, setDateRange,
    leaveCalDate, setLeaveCalDate, allBookedSlots,
    tempAccessibleMenus, setTempAccessibleMenus,
    isSavingAccess, isRevokingAccess, handleSaveAccess, handleRevokeAccess,
    updateDoctorField, updateDoctorFields,
    form, isPending,
    fetchAllData
  };
}
