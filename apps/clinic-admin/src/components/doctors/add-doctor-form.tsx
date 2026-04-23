"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Loader2, User, Clock, ShieldCheck } from "lucide-react";
import type { Doctor, Department, AvailabilitySlot } from '@kloqo/shared';
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api-client";
import imageCompression from "browser-image-compression";
import { capitalizeFirstLetter, toUpperCase, capitalizeWords } from "@kloqo/shared-core";
import { parseTime } from "@/lib/utils";
import { format } from "date-fns";
import { SelectDepartmentDialog } from "../onboarding/select-department-dialog";
import { PersonalInfoTab } from "./form-tabs/PersonalInfoTab";
import { AvailabilityTab } from "./form-tabs/AvailabilityTab";
import { PermissionsTab, AVAILABLE_MENUS } from "./form-tabs/PermissionsTab";

const MALE_AVATAR = "https://firebasestorage.googleapis.com/v0/b/kloqo-nurse-dup-43384903-8d386.firebasestorage.app/o/doctor_male.webp?alt=media&token=b19d8fb5-1812-4eb5-a879-d48739eaa87e";
const FEMALE_AVATAR = "https://firebasestorage.googleapis.com/v0/b/kloqo-nurse-dup-43384903-8d386.firebasestorage.app/o/doctor_female.webp?alt=media&token=0726d154-7371-4db7-9006-0a82fc47f9fa";
const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const timeSlotSchema = z.object({
  from: z.string().min(1, "Required"),
  to: z.string().min(1, "Required"),
}).refine(data => data.from < data.to, { message: "End time must be after start time.", path: ["to"] });

const availabilitySlotSchema = z.object({
  day: z.string(),
  timeSlots: z.array(timeSlotSchema).min(1, "At least one time slot is required."),
}).refine(data => {
  const sorted = [...data.timeSlots].sort((a, b) => a.from.localeCompare(b.from));
  for (let i = 0; i < sorted.length - 1; i++) { if (sorted[i].to > sorted[i + 1].from) return false; }
  return true;
}, { message: "Time slots cannot overlap.", path: ["timeSlots"] });

const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, { message: "Name must be at least 2 characters." }).transform(capitalizeWords),
  specialty: z.string().min(2, { message: "Specialty must be at least 2 characters." }).transform(capitalizeWords),
  department: z.string().min(1, { message: "Please select a department." }),
  registrationNumber: z.string().optional().transform(v => v ? toUpperCase(v) : v),
  email: z.string().email("Please enter a valid email address.").optional().or(z.literal('')),
  bio: z.string().optional().transform(v => v ? capitalizeFirstLetter(v) : v),
  experience: z.coerce.number().min(0, "Years of experience cannot be negative."),
  consultationFee: z.coerce.number({ invalid_type_error: "Consultation fee is required." }).min(1, "Consultation fee must be greater than 0."),
  averageConsultingTime: z.coerce.number().min(5, "Must be at least 5 minutes."),
  availabilitySlots: z.array(availabilitySlotSchema).min(1, "At least one availability slot is required."),
  photo: z.any().optional(),
  freeFollowUpDays: z.coerce.number().min(0, "Cannot be negative.").optional(),
  advanceBookingDays: z.coerce.number().min(0, "Cannot be negative.").optional(),
  walkInReserveRatio: z.coerce.number().min(0).max(1).default(0.15),
  gracePeriodMinutes: z.coerce.number().min(5).max(60).default(15),
  tokenDistribution: z.enum(['classic', 'advanced']).default('advanced'),
  accessibleMenus: z.array(z.string()).optional(),
  roles: z.array(z.string()).default(['doctor']),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

type AddDoctorFormValues = z.infer<typeof formSchema>;
type AddDoctorFormProps = { onSave: (doctor: Doctor) => void; isOpen: boolean; setIsOpen: (isOpen: boolean) => void; doctor: Doctor | null; departments: Department[]; updateDepartments: (newDepartment: Department) => void; };

export function AddDoctorForm({ onSave, isOpen, setIsOpen, doctor, departments, updateDepartments }: AddDoctorFormProps) {
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [defaultAvatar, setDefaultAvatar] = useState(MALE_AVATAR);
  const { toast } = useToast();
  const auth = useAuth();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [clinicDetails, setClinicDetails] = useState<any | null>(null);
  const [isSelectDepartmentOpen, setIsSelectDepartmentOpen] = useState(false);
  const [masterDepartments, setMasterDepartments] = useState<Department[]>([]);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [sharedTimeSlots, setSharedTimeSlots] = useState<Array<{ from: string; to: string }>>([{ from: "09:00", to: "17:00" }]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submittingDocIdRef = useRef<string | null>(null);
  const isEditMode = !!doctor;

  const form = useForm<AddDoctorFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", specialty: "", department: "", registrationNumber: "", bio: "", experience: 0, consultationFee: undefined, averageConsultingTime: 5, availabilitySlots: [], freeFollowUpDays: 7, advanceBookingDays: 7, walkInReserveRatio: 0.15, gracePeriodMinutes: 15, tokenDistribution: 'advanced', accessibleMenus: AVAILABLE_MENUS.map(m => m.id), roles: ['doctor'], latitude: undefined, longitude: undefined },
    mode: 'onBlur',
  });

  useEffect(() => {
    if (auth.currentUser) {
      (async () => {
        try {
          const clinicData = await apiRequest<any>('/clinic/me');
          setClinicId(clinicData.id);
          setClinicDetails(clinicData);
          
          // Fix 4: Fetch Master Departments to populate the SelectDepartmentDialog
          const masterResponse = await apiRequest<any>('/clinic/departments/master');
          const masterDepts = Array.isArray(masterResponse) ? masterResponse : (masterResponse?.data || []);
          setMasterDepartments(masterDepts);
        } catch (error) { console.error('Error fetching clinic/master data:', error); }
      })();
    }
  }, [auth.currentUser]);

  useEffect(() => {
    if (isOpen) {
      if (doctor) {
        const slots = doctor.availabilitySlots?.map(s => ({ ...s, timeSlots: s.timeSlots.map(ts => ({ from: format(parseTime(ts.from, new Date()), 'hh:mm a'), to: format(parseTime(ts.to, new Date()), 'hh:mm a') })) })) || [];
        const roles = doctor.roles && doctor.roles.length > 0 ? doctor.roles : (doctor.role ? [doctor.role] : ['doctor']);
        form.reset({ ...doctor as any, availabilitySlots: slots, registrationNumber: doctor.registrationNumber || "", email: doctor.email || "", bio: doctor.bio || "", experience: doctor.experience || 0, walkInReserveRatio: doctor.walkInReserveRatio || 0.15, gracePeriodMinutes: doctor.gracePeriodMinutes || 15, tokenDistribution: doctor.tokenDistribution || 'advanced', accessibleMenus: doctor.accessibleMenus || AVAILABLE_MENUS.map(m => m.id), roles });
        setPhotoPreview(doctor.avatar || MALE_AVATAR);
        setDefaultAvatar(doctor.avatar === FEMALE_AVATAR ? FEMALE_AVATAR : MALE_AVATAR);
        if (slots.length > 0) setSharedTimeSlots(slots[0].timeSlots);
      } else {
        form.reset({ name: "", specialty: "", department: "", registrationNumber: "", email: "", bio: "", experience: 0, consultationFee: undefined, averageConsultingTime: 5, availabilitySlots: [], freeFollowUpDays: 7, advanceBookingDays: 7, accessibleMenus: AVAILABLE_MENUS.map(m => m.id), roles: ['doctor'] });
        setPhotoPreview(MALE_AVATAR);
        setDefaultAvatar(MALE_AVATAR);
        setSharedTimeSlots([{ from: "09:00", to: "17:00" }]);
      }
    }
  }, [doctor, form, isOpen]);

  const applySharedSlotsToSelectedDays = () => {
    if (selectedDays.length === 0) return toast({ variant: "destructive", title: "No days selected" });
    const valid = sharedTimeSlots.filter(ts => ts.from && ts.to);
    if (valid.length === 0) return toast({ variant: "destructive", title: "No time slots defined" });

    const currentSlots = form.getValues('availabilitySlots') || [];
    const newSlotsMap = new Map(currentSlots.map((s: any) => [String(s.day), s]));
    selectedDays.forEach(day => newSlotsMap.set(day, { day, timeSlots: valid }));
    form.setValue('availabilitySlots', Array.from(newSlotsMap.values()), { shouldDirty: true, shouldValidate: true });
    toast({ title: "Time Slots Applied" });
    setSelectedDays([]);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      form.setValue('photo', file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = (values: AddDoctorFormValues) => {
    if (isSubmitting || isPending) return;
    setIsSubmitting(true);
    startTransition(async () => {
      try {
        if (!auth.currentUser || !clinicId) return setIsSubmitting(false);
        let photoUrl = photoPreview || doctor?.avatar || MALE_AVATAR;
        const photoFile = form.getValues('photo');
        if (photoFile instanceof File) {
          const compressed = await imageCompression(photoFile, { maxSizeMB: 0.5, maxWidthOrHeight: 800 });
          const formData = new FormData();
          formData.append('file', compressed);
          formData.append('clinicId', clinicId);
          formData.append('userId', (auth.currentUser as any).id);
          formData.append('documentType', 'profile_photo');
          const upload = await apiRequest<{ url: string }>('/storage/upload', { method: 'POST', body: formData });
          photoUrl = upload.url;
        }

        const docId = values.id || (isEditMode && doctor?.id ? doctor.id : `doc-${Date.now()}`);
        if (submittingDocIdRef.current === docId) return setIsSubmitting(false);
        submittingDocIdRef.current = docId;

        const doctorToSave: Doctor = { 
          ...doctor, 
          ...values as any, 
          id: docId, 
          clinicId, 
          avatar: photoUrl,
          role: 'doctor' as any, // Legacy Dual-Write: Doctors are always 'doctor' primarily
          roles: Array.from(new Set(['doctor', ...(values.roles || [])])) // Ensure 'doctor' is always included
        };
        await apiRequest('/clinic/doctors', { method: 'POST', body: JSON.stringify(doctorToSave) });
        onSave(doctorToSave);
        setIsOpen(false);
        toast({ title: `Doctor ${isEditMode ? "Updated" : "Added"}` });
      } catch (error: any) { toast({ variant: "destructive", title: "Save Failed", description: error.message }); }
      finally { setIsSubmitting(false); submittingDocIdRef.current = null; }
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={o => { if (!o) { setIsOpen(false); setIsSubmitting(false); } }}>
        <DialogContent className="max-w-4xl" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit Doctor" : "Add New Doctor"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <Tabs defaultValue="personal" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="personal" className="flex items-center gap-2"><User className="w-4 h-4" /> Personal Info</TabsTrigger>
                  <TabsTrigger value="availability" className="flex items-center gap-2"><Clock className="w-4 h-4" /> Availability</TabsTrigger>
                </TabsList>
                <ScrollArea className="h-[60vh] p-1 border rounded-lg bg-muted/5">
                  <TabsContent value="personal">
                    <PersonalInfoTab
                      form={form}
                      departments={departments}
                      photoPreview={photoPreview}
                      defaultAvatar={defaultAvatar}
                      setDefaultAvatar={setDefaultAvatar}
                      setPhotoPreview={setPhotoPreview}
                      fileInputRef={fileInputRef}
                      handlePhotoChange={handlePhotoChange}
                      handlePhotoDelete={() => { form.setValue('photo', null); setPhotoPreview(defaultAvatar); }}
                      setIsSelectDepartmentOpen={setIsSelectDepartmentOpen}
                      isDepartmentLimitReached={false}
                      maleAvatar={MALE_AVATAR}
                      femaleAvatar={FEMALE_AVATAR}
                    />
                  </TabsContent>
                  <TabsContent value="availability"><AvailabilityTab form={form} clinicDetails={clinicDetails} selectedDays={selectedDays} setSelectedDays={setSelectedDays} sharedTimeSlots={sharedTimeSlots} setSharedTimeSlots={setSharedTimeSlots} applySharedSlotsToSelectedDays={applySharedSlotsToSelectedDays} /></TabsContent>
                </ScrollArea>
              </Tabs>
              <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isPending || isSubmitting || !form.formState.isValid}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditMode ? "Save Changes" : "Save Doctor"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <SelectDepartmentDialog 
        isOpen={isSelectDepartmentOpen} 
        setIsOpen={setIsSelectDepartmentOpen} 
        departments={masterDepartments.filter(m => !departments.some(d => d.id === m.id))} 
        onDepartmentsSelect={async (depts) => {
        try {
          const ids = Array.from(new Set([...departments.map(d => d.id), ...depts.map(d => d.id)]));
          await apiRequest('/clinic', { method: 'PATCH', body: JSON.stringify({ departments: ids }) });
          // Fix 2: Sync parent state immediately after new department creation
          updateDepartments(depts[0]); 
          if (depts[0]) form.setValue('department', depts[0].name, { shouldValidate: true });
        } catch (e) {}
      }} />

    </>
  );
}
