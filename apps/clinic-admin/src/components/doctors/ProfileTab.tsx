'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, BriefcaseMedical, Trophy, Star, Edit, Save, X, Upload, Loader2, Shield, Activity, FlaskConical, UserCog, ShieldCheck, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Doctor, Department, Role } from '@kloqo/shared';
import imageCompression from 'browser-image-compression';
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from '@/lib/api-client';

interface ProfileTabProps {
  doctor: Doctor;
  departments: Department[];
  onUpdate: (updates: Partial<Doctor>) => Promise<void>;
  isPending: boolean;
}

export function ProfileTab({ doctor, departments, onUpdate, isPending }: ProfileTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [form, setForm] = useState({
    name: doctor.name,
    specialty: doctor.specialty || '',
    department: doctor.department || '',
    experience: doctor.experience || 0,
    registrationNumber: doctor.registrationNumber || '',
    bio: doctor.bio || '',
    roles: doctor.roles && doctor.roles.length > 0 ? doctor.roles : (doctor.role ? [doctor.role] : ['doctor'])
  });
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(doctor.avatar || null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    let photoUrl = doctor.avatar;
    if (newPhoto) {
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: true };
      const compressedFile = await imageCompression(newPhoto, options);
      
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('clinicId', doctor.clinicId);
      formData.append('userId', doctor.id);
      formData.append('documentType', 'profile_photo');

      const res = await apiRequest<{url: string}>('/storage/upload', { 
        method: 'POST', 
        body: formData 
      });
      photoUrl = res.url;
    }
    
    await onUpdate({
      name: form.name,
      specialty: form.specialty,
      department: form.department,
      experience: Number(form.experience),
      registrationNumber: form.registrationNumber,
      avatar: photoUrl
    });
    
    setIsEditing(false);
  };

  const handleBioSave = async () => {
    await onUpdate({ bio: form.bio });
    setIsEditingBio(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Card className="border-none shadow-2xl shadow-black/5 rounded-[2rem] bg-white overflow-hidden">
        <CardHeader className="p-8 border-b border-slate-50 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-theme-blue/10 flex items-center justify-center">
                <User className="h-6 w-6 text-theme-blue" />
              </div>
              <div>
                <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Doctor Profile</CardTitle>
                <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Public clinical identity management</CardDescription>
              </div>
            </div>
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} variant="ghost" className="rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-theme-blue hover:bg-theme-blue/5">
                <Edit className="h-4 w-4 mr-2" /> Edit Details
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button onClick={() => setIsEditing(false)} variant="ghost" className="rounded-xl text-red-500 font-black uppercase text-[10px] tracking-widest">
                  <X className="h-4 w-4 mr-2" /> Cancel
                </Button>
                <Button onClick={handleSave} disabled={isPending} className="rounded-xl bg-theme-blue font-black uppercase text-[10px] tracking-widest text-white shadow-lg shadow-theme-blue/20">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save Changes
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
           <div className="flex flex-col md:flex-row gap-10">
            <div className="relative group shrink-0">
              <div className="h-32 w-32 rounded-3xl overflow-hidden border-4 border-slate-50 shadow-xl shadow-black/5 group-hover:scale-105 transition-transform duration-500">
                <Image src={photoPreview || doctor.avatar || '/default-doctor.png'} alt={doctor.name} width={128} height={128} className="object-cover h-full w-full" />
              </div>
              {isEditing && (
                <label className="absolute inset-0 bg-black/40 backdrop-blur-[2px] rounded-3xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Upload className="h-8 w-8 text-white mb-2" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Change Photo</span>
                  <input type="file" className="hidden" onChange={handlePhotoChange} accept="image/*" />
                </label>
              )}
            </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
               <div className="space-y-2">
                 <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Full Name</Label>
                 {isEditing ? (
                   <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="rounded-xl border-2 border-slate-100 bg-white font-black text-sm text-slate-800" />
                 ) : (
                   <p className="font-black text-lg text-slate-800">{doctor.name}</p>
                 )}
               </div>

               <div className="space-y-2">
                 <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Medical Specialty</Label>
                 {isEditing ? (
                   <Input value={form.specialty} onChange={e => setForm({...form, specialty: e.target.value})} className="rounded-xl border-2 border-slate-100 bg-white font-black text-sm text-slate-800" />
                 ) : (
                   <p className="font-black text-lg text-slate-800">{doctor.specialty || '--'}</p>
                 )}
               </div>

               <div className="space-y-2">
                 <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Department</Label>
                 {isEditing ? (
                   <Select value={form.department} onValueChange={val => setForm({...form, department: val})}>
                     <SelectTrigger className="rounded-xl border-2 border-slate-100 bg-white font-black text-sm text-slate-800 h-11">
                       <SelectValue placeholder="Select Department" />
                     </SelectTrigger>
                     <SelectContent className="rounded-2xl border-none shadow-2xl">
                       {departments.map(d => <SelectItem key={d.id} value={d.name} className="font-black text-xs uppercase tracking-widest hover:bg-slate-50">{d.name}</SelectItem>)}
                     </SelectContent>
                   </Select>
                 ) : (
                    <p className="font-black text-lg text-slate-800">{doctor.department || '--'}</p>
                 )}
               </div>

               <div className="space-y-2">
                 <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Registration Number</Label>
                 {isEditing ? (
                   <Input value={form.registrationNumber} onChange={e => setForm({...form, registrationNumber: e.target.value})} className="rounded-xl border-2 border-slate-100 bg-white font-black text-sm text-slate-800" />
                 ) : (
                   <p className="font-black text-lg text-slate-800">{doctor.registrationNumber || '--'}</p>
                 )}
               </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-2xl shadow-black/5 rounded-[2rem] bg-white overflow-hidden">
        <CardHeader className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <BriefcaseMedical className="h-6 w-6 text-slate-400" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Doctor Bio</CardTitle>
              <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Experience, education and patients orientation</CardDescription>
            </div>
          </div>
          {!isEditingBio ? (
            <Button onClick={() => setIsEditingBio(true)} variant="ghost" className="rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-theme-blue hover:bg-theme-blue/5">
              <Edit className="h-4 w-4 mr-2" /> Update Bio
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={() => setIsEditingBio(false)} variant="ghost" className="rounded-xl text-red-500 font-black uppercase text-[10px] tracking-widest">Cancel</Button>
              <Button onClick={handleBioSave} disabled={isPending} className="rounded-xl bg-theme-blue font-black uppercase text-[10px] tracking-widest text-white px-6">Save</Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-8">
           {isEditingBio ? (
            <Textarea 
              value={form.bio} onChange={e => setForm({...form, bio: e.target.value})}
              className="rounded-2xl border-2 border-slate-100 bg-white font-bold text-sm text-slate-800 min-h-[150px] p-6 focus:border-theme-blue transition-all" 
              placeholder="Provide a detailed bio for the doctor..."
            />
          ) : (
            <p className={cn(
              "text-sm font-bold text-slate-500 leading-loose",
              !doctor.bio && "italic opacity-40 uppercase tracking-widest text-[10px] font-black"
            )}>
              {doctor.bio || 'Doctor bio has not been provided yet.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
