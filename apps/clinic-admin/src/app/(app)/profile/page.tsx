"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ProfileHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api-client";
import type { User, Doctor } from '@kloqo/shared';
import { UserCircle, Building, Loader2, Clock, Settings, CreditCard } from "lucide-react";
import { capitalizeWords, toUpperCase } from "@kloqo/shared-core";
import { ProfileSettings } from "@/components/profile/ProfileSettings";
import { ClinicDetailsSettings } from "@/components/profile/ClinicDetailsSettings";
import { OperatingHoursSettings } from "@/components/profile/OperatingHoursSettings";
import { GlobalClinicSettings } from "@/components/profile/GlobalClinicSettings";
import { BillingSubscriptionSettings } from "@/components/profile/BillingSubscriptionSettings";
import { UpgradePlanModal } from "@/components/doctors/upgrade-plan-modal";

const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, "Required."),
  newPassword: z.string().min(6, "Min 6 characters."),
  confirmPassword: z.string().min(6, "Required."),
}).refine(data => data.newPassword === data.confirmPassword, { message: "Passwords do not match.", path: ["confirmPassword"] });

const profileFormSchema = z.object({
  name: z.string().min(2, "Required.").transform(capitalizeWords),
  phone: z.string().min(10, "Required."),
});

const clinicFormSchema = z.object({
  name: z.string().min(2, "Required.").transform(capitalizeWords),
  type: z.enum(['Single Doctor', 'Multi-Doctor']),
  numDoctors: z.coerce.number().min(1),
  clinicRegNumber: z.string().optional().transform(v => v ? toUpperCase(v) : v),
  addressLine1: z.string().min(1, "Required.").transform(capitalizeWords),
  addressLine2: z.string().optional().transform(v => v ? capitalizeWords(v) : v),
  city: z.string().min(1, "Required.").transform(capitalizeWords),
  district: z.string().optional().transform(v => v ? capitalizeWords(v) : v),
  state: z.string().min(1, "Required.").transform(capitalizeWords),
  pincode: z.string().min(1, "Required."),
  mapsLink: z.string().url().optional().or(z.literal('')),
});

const operatingHoursFormSchema = z.object({
  hours: z.array(z.object({ day: z.string(), timeSlots: z.array(z.object({ open: z.string(), close: z.string() })), isClosed: z.boolean() })),
});

const settingsFormSchema = z.object({
  walkInTokenAllotment: z.coerce.number().min(2),
  tokenDistribution: z.enum(['classic', 'advanced']),
  genderPreference: z.enum(['None', 'Men', 'Women']),
});

type PasswordFormValues = z.infer<typeof passwordFormSchema>;
type ProfileFormValues = z.infer<typeof profileFormSchema>;
type ClinicFormValues = z.infer<typeof clinicFormSchema>;
type OperatingHoursFormValues = z.infer<typeof operatingHoursFormSchema>;
type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export default function ProfilePage() {
  const auth = useAuth() as any;
  const { toast } = useToast();
  const [activeView, setActiveView] = useState("profile");
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [clinicDetails, setClinicDetails] = useState<any | null>(null);
  const [currentDoctorCount, setCurrentDoctorCount] = useState(0);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingClinic, setIsEditingClinic] = useState(false);
  const [isEditingHours, setIsEditingHours] = useState(false);
  const [isEditingSettings, setIsEditingSettings] = useState(false);

  const passwordForm = useForm<PasswordFormValues>({ resolver: zodResolver(passwordFormSchema), defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });
  const profileForm = useForm<ProfileFormValues>({ resolver: zodResolver(profileFormSchema), defaultValues: { name: "", phone: "" } });
  const clinicForm = useForm<ClinicFormValues>({ resolver: zodResolver(clinicFormSchema), defaultValues: { name: "", type: "Single Doctor", numDoctors: 1, clinicRegNumber: "", addressLine1: "", addressLine2: "", city: "", district: "", state: "", pincode: "", mapsLink: "" } });
  const hoursForm = useForm<OperatingHoursFormValues>({ resolver: zodResolver(operatingHoursFormSchema), defaultValues: { hours: [] } });
  const settingsForm = useForm<SettingsFormValues>({ resolver: zodResolver(settingsFormSchema), defaultValues: { walkInTokenAllotment: 5, tokenDistribution: 'classic', genderPreference: 'None' } });

  const { fields, update } = useFieldArray({ control: hoursForm.control, name: "hours" });

  useEffect(() => {
    (async () => {
      if (!auth.currentUser) return setLoading(false);
      try {
        const user = auth.currentUser;
        setUserProfile(user);
        profileForm.reset({ name: user.name, phone: user.phone?.replace('+91', '') || '' });

        if (user.clinicId) {
          const clinic = await apiRequest<any>('/clinic/me');
          setClinicDetails(clinic);
          hoursForm.reset({ hours: clinic.operatingHours || [] });
          settingsForm.reset({ walkInTokenAllotment: clinic.walkInTokenAllotment || 5, tokenDistribution: clinic.tokenDistribution || 'classic', genderPreference: clinic.genderPreference || 'None' });
          clinicForm.reset({ name: clinic.name || '', type: clinic.type || 'Single Doctor', numDoctors: clinic.numDoctors || 1, clinicRegNumber: clinic.clinicRegNumber || '', addressLine1: clinic.addressDetails?.line1 || '', addressLine2: clinic.addressDetails?.line2 || '', city: clinic.addressDetails?.city || '', district: clinic.addressDetails?.district || '', state: clinic.addressDetails?.state || '', pincode: clinic.addressDetails?.pincode || '', mapsLink: clinic.mapsLink || '' });
          const doctors = await apiRequest<Doctor[]>('/clinic/doctors');
          setCurrentDoctorCount(doctors.length);
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, [auth.currentUser, auth.clinicId]);

  const onProfileSubmit = async (v: ProfileFormValues) => {
    startTransition(async () => {
      try {
        const phone = v.phone.startsWith('+91') ? v.phone : `+91${v.phone}`;
        await auth.updateProfile({ name: v.name, phone });
        setUserProfile(p => p ? { ...p, name: v.name, phone } : null);
        toast({ title: "Profile Updated" });
        setIsEditingProfile(false);
      } catch (e) { toast({ variant: "destructive", title: "Update Failed" }); }
    });
  };

  const onClinicSubmit = async (v: ClinicFormValues) => {
    if (v.type === 'Single Doctor' && currentDoctorCount > 1) return toast({ variant: "destructive", title: "Limit Error", description: "Multiple doctors exist." });
    startTransition(async () => {
      try {
        await apiRequest('/clinic/me', { method: 'PATCH', body: JSON.stringify({ ...v, addressDetails: { line1: v.addressLine1, line2: v.addressLine2, city: v.city, district: v.district, state: v.state, pincode: v.pincode } }) });
        setClinicDetails((p: any) => p ? { ...p, ...v } : null);
        toast({ title: "Clinic Updated" });
        setIsEditingClinic(false);
      } catch (e) { toast({ variant: "destructive", title: "Update Failed" }); }
    });
  };

  const onHoursSubmit = async (v: OperatingHoursFormValues) => {
    startTransition(async () => {
      try {
        await apiRequest('/clinic/me', { method: 'PATCH', body: JSON.stringify({ operatingHours: v.hours }) });
        setClinicDetails((p: any) => p ? { ...p, operatingHours: v.hours } : null);
        toast({ title: "Hours Updated" });
        setIsEditingHours(false);
      } catch (e) { toast({ variant: "destructive", title: "Update Failed" }); }
    });
  };

  const onSettingsSubmit = async (v: SettingsFormValues) => {
    startTransition(async () => {
      try {
        await apiRequest('/clinic/me', { method: 'PATCH', body: JSON.stringify(v) });
        setClinicDetails((p: any) => p ? { ...p, ...v } : null);
        toast({ title: "Settings Updated" });
        setIsEditingSettings(false);
      } catch (e) { toast({ variant: "destructive", title: "Update Failed" }); }
    });
  };

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleUpgradeRequest = () => {
    setShowUpgradeModal(true);
  };

  return (
    <>
      <UpgradePlanModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        clinicDetails={clinicDetails}
      />
      <ProfileHeader />
      <main className="flex-1 p-6 bg-background">
        <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-6 items-start">
          <div className="md:col-span-1">
            <Card><CardContent className="p-2">
              <nav className="flex flex-col gap-1">
                <Button variant={activeView === 'profile' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => setActiveView('profile')}><UserCircle className="mr-2 h-4 w-4" /> Your Profile</Button>
                <Button variant={activeView === 'clinic' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => setActiveView('clinic')}><Building className="mr-2 h-4 w-4" /> Clinic Details</Button>
                <Button variant={activeView === 'hours' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => setActiveView('hours')}><Clock className="mr-2 h-4 w-4" /> Operating Hours</Button>
                <Button variant={activeView === 'settings' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => setActiveView('settings')}><Settings className="mr-2 h-4 w-4" /> Settings</Button>
                <Button variant={activeView === 'billing' ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => setActiveView('billing')}><CreditCard className="mr-2 h-4 w-4" /> Billing & Plan</Button>
              </nav>
            </CardContent></Card>
          </div>
          <div className="md:col-span-3">
            {loading ? (
              <Card><CardContent className="p-10 flex items-center justify-center"><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading profile...</CardContent></Card>
            ) : (
              <>
                {activeView === 'profile' && <ProfileSettings userProfile={userProfile} isEditingProfile={isEditingProfile} setIsEditingProfile={setIsEditingProfile} isPending={isPending} profileForm={profileForm} passwordForm={passwordForm} onProfileSubmit={onProfileSubmit} onPasswordSubmit={async (v) => { try { await auth.changePassword(v.currentPassword, v.newPassword); toast({ title: "Updated" }); passwordForm.reset(); } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); } }} handleCancelProfile={() => { if (userProfile) profileForm.reset({ name: userProfile.name, phone: userProfile.phone?.replace('+91', '') || '' }); setIsEditingProfile(false); }} />}
                {activeView === 'clinic' && <ClinicDetailsSettings clinicDetails={clinicDetails} isEditingClinic={isEditingClinic} setIsEditingClinic={setIsEditingClinic} isPending={isPending} clinicForm={clinicForm} onClinicSubmit={onClinicSubmit} handleCancelClinic={() => { if (clinicDetails) clinicForm.reset({ name: clinicDetails.name, type: clinicDetails.type, numDoctors: clinicDetails.numDoctors, clinicRegNumber: clinicDetails.clinicRegNumber, addressLine1: clinicDetails.addressDetails?.line1, city: clinicDetails.addressDetails?.city, pincode: clinicDetails.addressDetails?.pincode, mapsLink: clinicDetails.mapsLink }); setIsEditingClinic(false); }} currentDoctorCount={currentDoctorCount} />}
                {activeView === 'hours' && <OperatingHoursSettings clinicDetails={clinicDetails} isEditingHours={isEditingHours} setIsEditingHours={setIsEditingHours} isPending={isPending} hoursForm={hoursForm} fields={fields} update={update} onHoursSubmit={onHoursSubmit} handleCancelHours={() => { if (clinicDetails) hoursForm.reset({ hours: clinicDetails.operatingHours }); setIsEditingHours(false); }} />}
                {activeView === 'settings' && <GlobalClinicSettings clinicDetails={clinicDetails} isEditingSettings={isEditingSettings} setIsEditingSettings={setIsEditingSettings} isPending={isPending} settingsForm={settingsForm} onSettingsSubmit={onSettingsSubmit} handleCancelSettings={() => { if (clinicDetails) settingsForm.reset({ walkInTokenAllotment: clinicDetails.walkInTokenAllotment, tokenDistribution: clinicDetails.tokenDistribution, genderPreference: clinicDetails.genderPreference }); setIsEditingSettings(false); }} />}
                {activeView === 'billing' && <BillingSubscriptionSettings clinicDetails={clinicDetails} currentDoctorCount={currentDoctorCount} onUpgrade={handleUpgradeRequest} />}
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
