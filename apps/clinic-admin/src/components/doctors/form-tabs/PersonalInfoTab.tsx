"use client";

import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Edit, Trash2, Upload, Activity, PlusCircle as PlusCircleIcon, Shield, UserCog, FlaskConical, Smartphone, ShieldCheck, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import type { Department } from '@kloqo/shared';
import { cn } from "@/lib/utils";
import { capitalizeWords, toUpperCase } from "@kloqo/shared-core";
import { Checkbox } from "@/components/ui/checkbox";

interface PersonalInfoTabProps {
  form: UseFormReturn<any>;
  departments: Department[];
  photoPreview: string | null;
  defaultAvatar: string;
  setDefaultAvatar: (url: string) => void;
  setPhotoPreview: (url: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handlePhotoDelete: () => void;
  setIsSelectDepartmentOpen: (open: boolean) => void;
  isDepartmentLimitReached: boolean;
  maleAvatar: string;
  femaleAvatar: string;
}

export function PersonalInfoTab({
  form,
  departments,
  photoPreview,
  defaultAvatar,
  setDefaultAvatar,
  setPhotoPreview,
  fileInputRef,
  handlePhotoChange,
  handlePhotoDelete,
  setIsSelectDepartmentOpen,
  isDepartmentLimitReached,
  maleAvatar,
  femaleAvatar,
}: PersonalInfoTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
      <div className="space-y-4">
        <FormItem>
          <FormLabel>Doctor's Photo</FormLabel>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {photoPreview ? (
                <Image src={photoPreview} alt="Doctor's Photo" width={96} height={96} className="object-cover w-full h-full" unoptimized={true} />
              ) : (
                <Upload className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} size="sm">
                <Edit className="mr-2 h-4 w-4" />
                Upload
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={handlePhotoDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
            <FormControl>
              <Input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" ref={fileInputRef} />
            </FormControl>
          </div>
          <div className="mt-4">
            <Label className="text-xs text-muted-foreground mb-2 block">Choose default avatar</Label>
            <ToggleGroup
              type="single"
              value={defaultAvatar}
              onValueChange={(v) => { if (v) { setDefaultAvatar(v); if (!form.getValues('photo')) setPhotoPreview(v); } }}
              className="justify-start"
            >
              <ToggleGroupItem value={maleAvatar} className="flex items-center gap-2 px-3 py-1 h-auto">
                <div className="w-6 h-6 rounded-full overflow-hidden border">
                  <Image src={maleAvatar} alt="Male" width={24} height={24} unoptimized={true} />
                </div>
                <span className="text-xs">Male</span>
              </ToggleGroupItem>
              <ToggleGroupItem value={femaleAvatar} className="flex items-center gap-2 px-3 py-1 h-auto">
                <div className="w-6 h-6 rounded-full overflow-hidden border">
                  <Image src={femaleAvatar} alt="Female" width={24} height={24} unoptimized={true} />
                </div>
                <span className="text-xs">Female</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </FormItem>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input placeholder="Dr. John Doe" {...field} onChange={(e) => {
                  const val = e.target.value;
                  field.onChange(capitalizeWords(val));
                }} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input placeholder="doctor@kloqo.com" {...field} />
              </FormControl>
              <FormDescription>Used for login credentials.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="registrationNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Registration Number</FormLabel>
              <FormControl>
                <Input placeholder="e.g., IMA/12345" {...field} onChange={(e) => {
                   const val = e.target.value;
                   field.onChange(toUpperCase(val));
                }} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="specialty"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Specialty <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input placeholder="Cardiology" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="department"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Department <span className="text-red-500">*</span></FormLabel>
              <Select onValueChange={(value) => {
                if (value === 'add_new') {
                  if (isDepartmentLimitReached) return;
                  setIsSelectDepartmentOpen(true);
                } else {
                  field.onChange(value);
                }
              }} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Select a department" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                  ))}
                  <Separator />
                  <SelectItem value="add_new" className="text-primary">
                    <div className="flex items-center gap-2">
                      <PlusCircleIcon className="h-4 w-4" />
                      Add New Department
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="space-y-4">
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea placeholder=" Expertise and background..." className="min-h-[100px]" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="experience"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Years of Experience <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input type="number" min="0" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="consultationFee"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Consultation Fee (₹) <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input type="number" min="0" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="averageConsultingTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Avg. Consulting Time (min) <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input type="number" min="5" {...field} />
              </FormControl>
              {field.value > 0 && (
                <p className="text-sm text-green-600 flex items-center gap-1 font-medium mt-1">
                  <Activity className="w-4 h-4" />
                  Capacity: ~{Math.floor(60 / field.value)} appointments/hour
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="freeFollowUpDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Free Follow-up Period (Days)</FormLabel>
              <FormControl>
                <Input type="number" min="0" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="advanceBookingDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Advance Booking (Days)</FormLabel>
              <FormControl>
                <Input type="number" min="0" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="pt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" />
            <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Queue Optimization</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="walkInReserveRatio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest">Walk-in Buffer (%)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" max="1" {...field} value={field.value} onChange={(e) => field.onChange(Number(e.target.value))} />
                  </FormControl>
                  <FormDescription className="text-[9px]">e.g. 0.15 = 15%</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gracePeriodMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest">Skip Grace (min)</FormLabel>
                  <FormControl>
                    <Input type="number" min="5" max="60" {...field} />
                  </FormControl>
                  <FormDescription className="text-[9px]">Auto-skip after arrival</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex flex-col gap-4">
           <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-theme-blue" />
              <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Identity & Additional Roles</Label>
           </div>
           
           <div className="space-y-4">
             <div className="flex items-center space-x-3 opacity-50 px-4 py-3 rounded-2xl bg-white border-2 border-dashed border-slate-200">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <div>
                   <Label className="text-[10px] font-black uppercase tracking-widest opacity-80 block">Primary Identity</Label>
                   <Label className="text-sm font-bold opacity-80">Medical Doctor</Label>
                </div>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: "nurse", label: "Nurse", icon: Activity, desc: "Vitals & Clinical Ops" },
                  { id: "pharmacist", label: "Pharmacist", icon: FlaskConical, desc: "Dispensary Access" },
                  { id: "receptionist", label: "Receptionist", icon: UserCog, desc: "Front Desk & Payments" },
                  { id: "clinicAdmin", label: "Clinic Admin", icon: ShieldCheck, desc: "Full System Analytics" },
                ].map((role) => (
                  <FormField
                    key={role.id}
                    control={form.control}
                    name="roles"
                    render={({ field }) => {
                      const isSelected = field.value?.includes(role.id);
                      return (
                        <FormItem>
                          <FormControl>
                            <div 
                              onClick={() => {
                                const current = field.value || ['doctor'];
                                const updated = isSelected
                                  ? current.filter((val: string) => val !== role.id)
                                  : [...current, role.id];
                                field.onChange(updated);
                              }}
                              className={cn(
                                "relative flex items-center gap-3 p-3 rounded-2xl border-2 transition-all cursor-pointer group",
                                isSelected 
                                  ? "border-theme-blue bg-theme-blue/5 shadow-md shadow-theme-blue/10" 
                                  : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
                              )}
                            >
                               <div className={cn(
                                 "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                 isSelected ? "bg-theme-blue text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                               )}>
                                  <role.icon className="h-5 w-5" />
                               </div>
                               <div className="flex-1">
                                  <p className={cn("text-sm font-bold transition-colors", isSelected ? "text-theme-blue" : "text-slate-700")}>{role.label}</p>
                                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{role.desc}</p>
                               </div>
                               {isSelected && (
                                 <div className="absolute top-2 right-2">
                                    <CheckCircle2 className="h-4 w-4 text-theme-blue" />
                                 </div>
                               )}
                            </div>
                          </FormControl>
                        </FormItem>
                      );
                    }}
                  />
                ))}
             </div>
           </div>
           
           <p className="text-[10px] text-muted-foreground px-2 italic font-medium">
             Assign secondary roles to allow this medical professional to cover other clinical or administrative functions.
           </p>
        </div>
      </div>
    </div>
  );
}
