'use client';

import React, { useState, useEffect } from 'react';
import { User, Briefcase, Settings, MapPin, Save, Loader2, Camera, BarChart3, LogOut, LocateFixed } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiRequest } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

interface DoctorProfileSettingsProps {
  initialData: any;
  onLogout: () => void;
}

export function DoctorProfileSettings({ initialData, onLogout }: DoctorProfileSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    bio: initialData?.bio || '',
    registrationNumber: initialData?.registrationNumber || '',
    specialty: initialData?.specialty || '',
    experience: initialData?.experience || '',
    avatar: initialData?.avatar || '',
    advanceBookingDays: initialData?.advanceBookingDays || 7,
    averageConsultingTime: initialData?.averageConsultingTime || 10,
    consultationFee: initialData?.consultationFee || 0,
    freeFollowUpDays: initialData?.freeFollowUpDays || 0,
    walkInReserveRatio: initialData?.walkInReserveRatio || 0.15,
    walkInTokenAllotment: initialData?.walkInTokenAllotment || 5,
    gracePeriodMinutes: initialData?.gracePeriodMinutes || 15,
    latitude: initialData?.latitude || 11.047077095607861,
    longitude: initialData?.longitude || 0,
  });

  const [locating, setLocating] = useState(false);

  const handleLocate = () => {
    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'Error', description: 'Geolocation is not supported by your browser' });
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }));
        setLocating(false);
        toast({ title: 'Success', description: 'Location updated' });
      },
      (error) => {
        setLocating(false);
        let message = error.message;
        if (error.code === 1) message = 'Location permission denied. Please enable location access in your browser settings.';
        if (error.code === 2) message = 'Position unavailable. Your device could not determine its location.';
        if (error.code === 3) message = 'Location request timed out.';
        
        toast({ variant: 'destructive', title: 'Location Error', description: message });
      }
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as any;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value
    }));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const uploadData = new FormData();
      uploadData.append('file', file);
      
      const response = await apiRequest<{ url: string }>('/storage/upload', {
        method: 'POST',
        body: uploadData,
      });

      setFormData(prev => ({ ...prev, avatar: response.url }));
      toast({ title: 'Success', description: 'Avatar updated successfully' });
    } catch (error: any) {
      toast({ 
        variant: 'destructive', 
        title: 'Upload Failed', 
        description: error.message 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest(`/doctors/${initialData.id}`, {
        method: 'PATCH',
        body: JSON.stringify(formData),
      });
      toast({ title: 'Success', description: 'Profile updated successfully' });
    } catch (error: any) {
      toast({ 
        variant: 'destructive', 
        title: 'Update Failed', 
        description: error.message 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header with Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2.5rem] shadow-premium border border-slate-50">
        <div className="flex items-center gap-6">
          <div className="relative group">
            <Avatar className="h-24 w-24 border-4 border-white shadow-xl">
              <AvatarImage src={formData.avatar} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-black">
                {formData.name?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              {uploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
              <input type="file" className="hidden" onChange={handleAvatarUpload} accept="image/*" />
            </label>
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dr. {formData.name}</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">{formData.specialty || 'Medical Professional'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Link href="/day-snapshot" className="flex-1 md:flex-none">
            <Button variant="outline" className="w-full h-12 rounded-2xl gap-2 font-bold border-slate-200">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
              Day Snapshot
            </Button>
          </Link>
          <Button 
            variant="ghost" 
            onClick={onLogout}
            className="flex-1 md:flex-none h-12 rounded-2xl gap-2 font-bold text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Identity & Bio Section */}
          <Card className="rounded-[2.5rem] border-none shadow-premium overflow-hidden">
            <CardHeader className="bg-slate-50/50 pb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xl font-black tracking-tight">Identity & Professional</CardTitle>
                  <CardDescription className="text-xs font-bold uppercase tracking-widest mt-0.5">Core professional details</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</Label>
                  <Input id="name" name="name" value={formData.name} onChange={handleChange} className="h-12 rounded-xl bg-slate-50 border-transparent focus:bg-white transition-all" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registrationNumber" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Reg. Number</Label>
                  <Input id="registrationNumber" name="registrationNumber" value={formData.registrationNumber} onChange={handleChange} className="h-12 rounded-xl bg-slate-50 border-transparent focus:bg-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="specialty" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Specialty</Label>
                  <Input id="specialty" name="specialty" value={formData.specialty} onChange={handleChange} className="h-12 rounded-xl bg-slate-50 border-transparent focus:bg-white transition-all" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experience" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Experience (Years)</Label>
                  <Input id="experience" name="experience" value={formData.experience} onChange={handleChange} className="h-12 rounded-xl bg-slate-50 border-transparent focus:bg-white transition-all" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Professional Bio</Label>
                <Textarea id="bio" name="bio" value={formData.bio} onChange={handleChange} rows={4} className="rounded-2xl bg-slate-50 border-transparent focus:bg-white transition-all resize-none" />
              </div>
            </CardContent>
          </Card>

          {/* Practice Configuration Section */}
          <Card className="rounded-[2.5rem] border-none shadow-premium overflow-hidden">
            <CardHeader className="bg-slate-50/50 pb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xl font-black tracking-tight">Practice Configuration</CardTitle>
                  <CardDescription className="text-xs font-bold uppercase tracking-widest mt-0.5">Booking and fee settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="advanceBookingDays" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Advance Booking (Days)</Label>
                  <Input id="advanceBookingDays" name="advanceBookingDays" type="number" value={formData.advanceBookingDays} onChange={handleChange} className="h-12 rounded-xl bg-slate-50 border-transparent focus:bg-white transition-all" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="averageConsultingTime" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Avg Consultation (Min)</Label>
                  <Input id="averageConsultingTime" name="averageConsultingTime" type="number" value={formData.averageConsultingTime} onChange={handleChange} className="h-12 rounded-xl bg-slate-50 border-transparent focus:bg-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="consultationFee" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Consultation Fee (₹)</Label>
                  <Input id="consultationFee" name="consultationFee" type="number" value={formData.consultationFee} onChange={handleChange} className="h-12 rounded-xl bg-slate-50 border-transparent focus:bg-white transition-all" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="freeFollowUpDays" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Free Follow-up (Days)</Label>
                  <Input id="freeFollowUpDays" name="freeFollowUpDays" type="number" value={formData.freeFollowUpDays} onChange={handleChange} className="h-12 rounded-xl bg-slate-50 border-transparent focus:bg-white transition-all" />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Clinic Coordinates</span>
                  </div>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm" 
                    onClick={handleLocate}
                    disabled={locating}
                    className="h-8 rounded-lg gap-2 text-[10px] font-black uppercase tracking-widest border-slate-200"
                  >
                    {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <LocateFixed className="h-3 w-3" />}
                    Locate Me
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Latitude</Label>
                    <Input id="latitude" name="latitude" type="number" step="any" value={formData.latitude} onChange={handleChange} className="h-12 rounded-xl bg-slate-50 border-transparent focus:bg-white transition-all" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Longitude</Label>
                    <Input id="longitude" name="longitude" type="number" step="any" value={formData.longitude} onChange={handleChange} className="h-12 rounded-xl bg-slate-50 border-transparent focus:bg-white transition-all" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Queue Dynamics Section */}
          <Card className="rounded-[2.5rem] border-none shadow-premium overflow-hidden lg:col-span-2">
            <CardHeader className="bg-slate-50/50 pb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-100 text-amber-600">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xl font-black tracking-tight">Queue & Token Dynamics</CardTitle>
                  <CardDescription className="text-xs font-bold uppercase tracking-widest mt-0.5">Manage walk-ins and skipping rules</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2">
                <div className="flex justify-between items-end mb-1">
                  <Label htmlFor="walkInReserveRatio" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Walk-in Reserve %</Label>
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Ratio: {formData.walkInReserveRatio}</span>
                </div>
                <Input id="walkInReserveRatio" name="walkInReserveRatio" type="number" step="0.01" min="0" max="1" value={formData.walkInReserveRatio} onChange={handleChange} className="h-12 rounded-xl bg-slate-50 border-transparent focus:bg-white transition-all" />
                <p className="text-[10px] text-slate-400 font-medium px-1">Ratio of total slots reserved for walk-ins (0.0 to 1.0)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="walkInTokenAllotment" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Classic Allotment (N)</Label>
                <Input id="walkInTokenAllotment" name="walkInTokenAllotment" type="number" value={formData.walkInTokenAllotment} onChange={handleChange} className="h-12 rounded-xl bg-slate-50 border-transparent focus:bg-white transition-all" />
                <p className="text-[10px] text-slate-400 font-medium px-1">Insert 1 walk-in every N appointments in Classic Mode</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gracePeriodMinutes" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Grace Period (Min)</Label>
                <Input id="gracePeriodMinutes" name="gracePeriodMinutes" type="number" value={formData.gracePeriodMinutes} onChange={handleChange} className="h-12 rounded-xl bg-slate-50 border-transparent focus:bg-white transition-all" />
                <p className="text-[10px] text-slate-400 font-medium px-1">Minutes before "No-show" auto-skip is triggered</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center pt-4">
          <Button 
            type="submit" 
            disabled={loading}
            className="h-16 px-12 rounded-3xl bg-slate-900 hover:bg-slate-800 text-white font-black text-lg shadow-2xl transition-all active:scale-95 gap-3"
          >
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
            Save Profile Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
