'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Edit, Loader2, Save, Trash, X, CalendarDays } from 'lucide-react';
import { format, parse, isBefore, addMinutes } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { cn, parseTime } from '@/lib/utils';
import { Doctor } from '@kloqo/shared';
import { apiRequest } from '@/lib/api-client';

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayAbbreviations = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const timeSlotSchema = z.object({
  from: z.string().min(1, 'Required'),
  to: z.string().min(1, 'Required'),
});

const availabilitySlotSchema = z.object({
  day: z.string(),
  timeSlots: z.array(timeSlotSchema).min(1, 'At least one time slot is required.'),
});

const weeklyAvailabilityFormSchema = z.object({
  availabilitySlots: z.array(availabilitySlotSchema),
});

type WeeklyAvailabilityFormValues = z.infer<typeof weeklyAvailabilityFormSchema>;

import { useClinicalProfile } from '@/hooks/useClinicalProfile';
import { AvailabilityTab } from '@/components/profile/AvailabilityTab';

export default function AvailabilityPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile: clinicalProfile, loading: profileLoading } = useClinicalProfile();
  const { toast } = useToast();
  
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // 1. Fetch all doctors for the selector (for Nurses/Admins)
  useEffect(() => {
    if (!user?.clinicId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await apiRequest<any>(
          `/appointments/dashboard?clinicId=${user.clinicId}&date=today`
        );
        const fetchedDoctors = data.doctors || [];
        setDoctors(fetchedDoctors);
        
        const storedDoctorId = localStorage.getItem('selectedDoctorId');
        
        // 🛡️ DOCTOR AUTONOMY FIX: 
        // If we have a clinicalProfile (we are a doctor), prioritize that as the selected doctor
        // so that isSelf evaluates to true immediately.
        if (clinicalProfile) {
          setSelectedDoctor(clinicalProfile);
        } else if (storedDoctorId) {
          const doc = fetchedDoctors.find((d: Doctor) => d.id === storedDoctorId);
          if (doc) setSelectedDoctor(doc);
        } else if (fetchedDoctors.length > 0) {
          setSelectedDoctor(fetchedDoctors[0]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch doctors.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user?.clinicId, clinicalProfile, toast]);

  const handleUpdate = async (field: keyof Doctor, value: any) => {
    if (!selectedDoctor) return;
    setIsUpdating(true);
    try {
      await apiRequest(`/doctors/${selectedDoctor.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value })
      });
      
      const updated = { ...selectedDoctor, [field]: value };
      setSelectedDoctor(updated);
      setDoctors(prev => prev.map(d => d.id === selectedDoctor.id ? updated : d));
      
      toast({ title: "Success", description: "Schedule updated successfully." });
    } catch (err: any) {
      toast({ variant: 'destructive', title: "Update Failed", description: err.message });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading || profileLoading) {
    return (
      <AppFrameLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-slate-800" />
        </div>
      </AppFrameLayout>
    );
  }

  // IDENTITY GATING:
  // Are we a doctor looking at our own profile?
  const isSelf = selectedDoctor?.id === clinicalProfile?.id || selectedDoctor?.userId === user?.id;
  
  // Tactical Mode vs Full Mode
  // Doctor managing themselves = FULL
  // Admin managing anyone = FULL
  // Nurse managing anyone = TACTICAL
  const isAdmin = user?.role === 'clinicAdmin' || user?.role === 'superAdmin';
  const mode = (isSelf || isAdmin) ? 'full' : 'tactical';

  return (
    <AppFrameLayout>
      <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
        <header className="flex items-center gap-4 p-8 bg-white border-b border-slate-100 shrink-0">
          <Button variant="ghost" size="icon" onClick={() => router.push('/settings')} className="rounded-2xl hover:bg-slate-50 h-12 w-12">
            <ArrowLeft className="h-5 w-5 text-slate-400" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Doctor Schedule</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Manage clinic availability and overrides</p>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* 1. Doctor Selector (Visible to all, but default to self for Doctors) */}
            <Card className="border-none shadow-xl shadow-black/5 rounded-[2rem] bg-white overflow-hidden p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                   <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-2">Select Practitioner</Label>
                   <Select 
                      value={selectedDoctor?.id} 
                      onValueChange={(id) => {
                        const doc = doctors.find(d => d.id === id);
                        if (doc) {
                          setSelectedDoctor(doc);
                          localStorage.setItem('selectedDoctorId', id);
                        }
                      }}
                    >
                    <SelectTrigger className="w-full md:w-[320px] h-14 rounded-2xl border-2 border-slate-100 bg-slate-50/30 text-slate-700 font-black uppercase text-xs tracking-widest focus:ring-0 focus:border-slate-800 transition-all">
                      <SelectValue placeholder="Select a doctor" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-2 border-slate-100 shadow-2xl">
                      {doctors.map(doc => (
                        <SelectItem key={doc.id} value={doc.id} className="font-black uppercase text-[10px] tracking-widest py-3 focus:bg-slate-50 rounded-xl">
                          Dr. {doc.name} {doc.id === clinicalProfile?.id && "(You)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {isSelf && (
                  <div className="px-6 py-4 bg-emerald-50 rounded-3xl border-2 border-emerald-100/50 flex items-center gap-4 animate-in zoom-in-95 duration-300">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-black text-xs">OK</div>
                    <div>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Identity Verified</p>
                      <p className="text-sm font-black text-slate-800 tracking-tight">Full Autonomy Granted</p>
                    </div>
                  </div>
                )}
                {!isSelf && mode === 'tactical' && (
                  <div className="px-6 py-4 bg-amber-50 rounded-3xl border-2 border-amber-100/50 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white font-black text-xs px-2">READ</div>
                    <div>
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none mb-1">Staff Access</p>
                      <p className="text-sm font-black text-slate-800 tracking-tight">Tactical Controls Only</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* 2. High-Fidelity Availability Tab */}
            {selectedDoctor && (
              <AvailabilityTab 
                doctor={selectedDoctor} 
                onUpdate={handleUpdate} 
                isPending={isUpdating} 
                mode={mode} 
              />
            )}
           
          </div>
        </main>
      </div>
    </AppFrameLayout>
  );
}
