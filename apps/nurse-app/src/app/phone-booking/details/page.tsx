'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, UserPlus, Search, Link as LinkIcon, Clock, Phone } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format, addDays, isSameDay, subMinutes } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { AddRelativeDialog } from '@/components/patients/AddRelativeDialog';
import { cn } from '@/lib/utils';

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

type FormValues = {
  patientName: string;
  age: number;
  phone: string;
  communicationPhone?: string;
  place: string;
  sex: "Male" | "Female" | "Other";
};

function Content() {
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

  const selectPatient = (patient: any) => {
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
  };

  const handleRelativeAdded = (newRelative: any) => {
    setRelatives(prev => [...prev, newRelative]);
    selectPatient(newRelative);
  };

  const onSubmit = async (values: FormValues) => {
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

  const handleSendLink = async () => {
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
  };

  if (!doctorId) {
    return (
      <AppFrameLayout>
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <h2 className="text-xl font-semibold">Doctor Not Selected</h2>
          <Button onClick={() => router.push('/')} className="mt-4">Go Back</Button>
        </div>
      </AppFrameLayout>
    );
  }

  return (
    <AppFrameLayout>
      <div className="flex flex-col h-full bg-slate-50">
        <header className="flex items-center gap-4 p-4 bg-white border-b sticky top-0 z-10">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Phone Booking</h1>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
              Find or Create Patient
            </p>
          </div>
        </header>

        <main className="flex-1 p-4 space-y-6 overflow-y-auto">
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-theme-blue/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-theme-blue/10 transition-colors" />
              
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 block">Search Patient</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400 border-r border-slate-200 pr-3">+91</span>
                    <Input
                      type="tel"
                      placeholder="Phone number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      onKeyDown={(e) => e.key === 'Enter' && handlePatientSearch(phoneNumber)}
                      className="pl-16 bg-slate-50 border-slate-100 h-14 rounded-2xl text-xl font-black placeholder:text-slate-300 focus:ring-theme-blue/20"
                      maxLength={10}
                    />
                    {isSearchingPatient && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-5 w-5 animate-spin text-theme-blue" />
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={handleSendLink}
                    variant="outline"
                    disabled={isSendingLink || phoneNumber.length !== 10}
                    className="h-14 w-14 rounded-2xl border-theme-blue text-theme-blue hover:bg-theme-blue hover:text-white transition-all shadow-sm"
                    title="Send WhatsApp Link"
                  >
                    {isSendingLink ? <Loader2 className="h-5 w-5 animate-spin" /> : <LinkIcon className="h-6 w-6" />}
                  </Button>
                </div>

                {!phoneNumber && nextSlotHint && (
                  <div className="mt-6 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100/50 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="bg-emerald-500 shadow-lg shadow-emerald-200 p-3 rounded-2xl">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-widest leading-none mb-1.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Next Available
                      </p>
                      <p className="text-base font-black text-emerald-900 leading-tight">
                        {nextSlotHint.date} @ {nextSlotHint.time}
                      </p>
                      <p className="text-[10px] text-emerald-600/70 font-bold mt-1 uppercase tracking-tight">Report by {nextSlotHint.reportingTime}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Primary Matches Section */}
              {searchedPatients.filter(p => (p.phone === `+91${phoneNumber}` || p.phone === phoneNumber)).length > 0 && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      Primary Members
                    </label>
                    <div className="h-[2px] flex-1 bg-slate-100 ml-4 rounded-full" />
                  </div>
                  
                  <div className="grid gap-3">
                    {searchedPatients.filter(p => (p.phone === `+91${phoneNumber}` || p.phone === phoneNumber)).map((p, idx) => (
                      <button
                        key={p.id}
                        onClick={() => selectPatient(p)}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 bg-white border-2 rounded-3xl transition-all text-left group relative overflow-hidden",
                          selectedPatient?.id === p.id 
                            ? "border-theme-blue bg-blue-50/30 ring-4 ring-theme-blue/5" 
                            : "border-slate-50 hover:border-theme-blue/30 hover:bg-slate-50/50"
                        )}
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <Avatar className="h-14 w-14 border-2 border-white shadow-md ring-1 ring-slate-100">
                          <AvatarFallback className="bg-gradient-to-br from-theme-blue to-blue-600 text-white font-black text-xl">
                            {p.name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-lg font-black text-slate-900 leading-none">{p.name || 'Unknown'}</p>
                            <span className="text-[10px] font-black bg-theme-blue/10 text-theme-blue px-2 py-0.5 rounded-full uppercase">Account</span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-bold tracking-tight uppercase flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded-md text-slate-700">{p.sex || 'N/A'}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span>{p.age || '?'} Years</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span>{p.place || 'No location'}</span>
                          </p>
                        </div>
                        {selectedPatient?.id === p.id && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-theme-blue p-1.5 rounded-full shadow-lg shadow-theme-blue/20">
                            <Clock className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Relatives Match Section */}
              {(searchedPatients.filter(p => (p.phone !== `+91${phoneNumber}` && p.phone !== phoneNumber)).length > 0 || primaryPatient) && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 pt-2">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      Family & Relatives
                    </label>
                    <div className="h-[2px] flex-1 bg-slate-100 ml-4 rounded-full" />
                  </div>
                  
                  <div className="grid gap-3">
                    {searchedPatients.filter(p => (p.phone !== `+91${phoneNumber}` && p.phone !== phoneNumber)).map((p, idx) => (
                      <button
                        key={p.id}
                        onClick={() => selectPatient(p)}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 bg-white border-2 rounded-3xl transition-all text-left group relative overflow-hidden",
                          selectedPatient?.id === p.id 
                            ? "border-theme-blue bg-blue-50/30 ring-4 ring-theme-blue/5" 
                            : "border-slate-50 hover:border-theme-blue/30 hover:bg-slate-50/50"
                        )}
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <Avatar className="h-12 w-12 border-2 border-white shadow-sm ring-1 ring-slate-100 opacity-80">
                          <AvatarFallback className="bg-slate-100 text-slate-400 font-black text-lg">
                            {p.name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-base font-black text-slate-900">{p.name || 'Unknown'}</p>
                            <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-tighter">Family</span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-bold tracking-tight uppercase flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded-md">{p.sex || 'N/A'}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span>{p.age || '?'} Years</span>
                          </p>
                        </div>
                        {selectedPatient?.id === p.id && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-theme-blue p-1 rounded-full">
                            <Clock className="h-2 w-2 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                    
                    {primaryPatient && (
                      <button 
                        onClick={() => setIsAddRelativeDialogOpen(true)}
                        className="w-full flex items-center gap-4 p-4 border-2 border-dashed border-slate-200 rounded-3xl hover:border-theme-blue hover:bg-blue-50/30 transition-all group"
                      >
                        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-theme-blue/10 transition-colors">
                          <UserPlus className="h-6 w-6 text-slate-400 group-hover:text-theme-blue" />
                        </div>
                        <p className="text-sm font-black text-slate-500 group-hover:text-theme-blue uppercase tracking-widest">
                          Add Family Member
                        </p>
                      </button>
                    )}
                  </div>
                </div>
              )}
          </div>

          {!showForm && linkPendingPatients.length > 0 && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between px-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Awaiting Booking ({linkPendingPatients.length})
                </label>
                <div className="h-[2px] flex-1 bg-slate-100 ml-4 rounded-full" />
              </div>
              <div className="grid gap-3">
                {linkPendingPatients.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-3xl shadow-sm">
                    <div>
                      <p className="text-sm font-black text-slate-900">{p.phone}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Link sent - No appointment</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-emerald-100 text-emerald-600 hover:bg-emerald-50"
                      onClick={() => window.location.href = `tel:${p.phone}`}
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showForm && (
            <Form {...(form as any)}>
              <form 
                onSubmit={form.handleSubmit(onSubmit, (errors) => {
                  console.error("Form Validation Errors:", errors);
                  const firstError = Object.values(errors)[0] as any;
                  if (firstError?.message) {
                    toast({ variant: 'destructive', title: 'Form Error', description: firstError.message });
                  }
                })} 
                className="space-y-4 pb-10 animate-in fade-in slide-in-from-bottom-4"
              >
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
                  {(!primaryPatient || selectedPatient) && (
                    <>
                      <div className="flex items-center justify-between">
                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">
                          {selectedPatient ? 'Edit Selected Profile' : 'Register New Patient'}
                        </h2>
                        <span className="text-[10px] font-black bg-theme-blue/10 text-theme-blue px-2 py-1 rounded-full uppercase tracking-tight">
                          Verify Details
                        </span>
                      </div>

                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="patientName"
                          render={({ field }) => (
                            <FormItem>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                              <FormControl>
                                <Input placeholder="Patient's full name" {...field} className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold" />
                              </FormControl>
                              <FormMessage className="text-[10px]" />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4 border-y border-slate-50 py-4 my-2">
                          <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                            <FormItem>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                  Account Phone <span className="text-slate-300 normal-case font-normal">(optional for relatives)</span>
                                </label>
                                <FormControl>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">+91</span>
                                    <Input placeholder="Blank ok for relatives" {...field} className="h-12 pl-10 rounded-xl bg-slate-50 border-slate-100 font-bold" />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-[10px]" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="communicationPhone"
                            render={({ field }) => (
                              <FormItem>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp No.</label>
                                <FormControl>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">+91</span>
                                    <Input placeholder="Same as primary" {...field} className="h-12 pl-10 rounded-xl bg-slate-50 border-slate-100 font-bold" />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-[10px]" />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="age"
                        render={({ field }) => (
                          <FormItem>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Age (Years)</label>
                            <FormControl>
                              <Input type="number" placeholder="Years" {...field} className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold" />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="sex"
                        render={({ field }) => (
                          <FormItem>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                            <Select onValueChange={field.onChange} defaultValue={field.value} key={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                                <SelectItem value="Male" className="font-bold">Male</SelectItem>
                                <SelectItem value="Female" className="font-bold">Female</SelectItem>
                                <SelectItem value="Other" className="font-bold">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-[10px]" />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="place"
                      render={({ field }) => (
                        <FormItem>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">City / Area</label>
                          <FormControl>
                            <Input placeholder="Location" {...field} className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold" />
                          </FormControl>
                          <FormMessage className="text-[10px]" />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}
            </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-16 rounded-3xl bg-theme-blue hover:bg-theme-blue/90 text-white font-black text-lg shadow-xl shadow-theme-blue/20 transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-3"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <span>Proceed to Selection</span>
                      <ArrowLeft className="h-5 w-5 rotate-180" />
                    </>
                  )}
                </Button>
              </form>
            </Form>
          )}
        </main>

        <AddRelativeDialog 
          isOpen={isAddRelativeDialogOpen}
          setIsOpen={setIsAddRelativeDialogOpen}
          primaryPatientPhone={primaryPatient?.phone || phoneNumber}
          clinicId={clinicId}
          onRelativeAdded={handleRelativeAdded}
        />
      </div>
    </AppFrameLayout>
  );
}

export default function PhoneBookingDetailsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-gray-50 font-pt-sans">
        <Loader2 className="h-12 w-12 animate-spin text-theme-blue" />
        <p className="text-slate-500 font-medium tracking-tight">Loading Patient Scanner...</p>
      </div>
    }>
      <Content />
    </Suspense>
  );
}
