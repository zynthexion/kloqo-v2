'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MapPin, Building2, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { Clinic } from '@kloqo/shared';

interface ClinicHeaderProps {
  clinic: Clinic | null;
  loading: boolean;
  doctorCount: number;
  t: any;
}

export function ClinicHeader({ clinic, loading, doctorCount, t }: ClinicHeaderProps) {
  if (loading || !clinic) {
    return (
      <Card className="mb-6 border-none shadow-2xl shadow-black/5 rounded-[2.5rem] bg-white">
        <CardContent className="p-8">
          <div className="flex gap-6">
            <Skeleton className="h-24 w-24 rounded-3xl" />
            <div className="flex-grow space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8 border-none shadow-2xl shadow-black/5 rounded-[2.5rem] bg-white relative overflow-hidden group">
      <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-theme-blue/5 rounded-full blur-3xl group-hover:bg-theme-blue/10 transition-colors" />
      
      {clinic.latitude && clinic.longitude && (
        <Button
          variant="default" size="icon"
          className="absolute bottom-6 right-6 h-16 w-16 rounded-3xl bg-theme-blue shadow-xl shadow-theme-blue/30 active:scale-95 transition-all z-10"
          onClick={() => window.open(`https://www.google.com/maps?q=${clinic.latitude},${clinic.longitude}`, '_blank')}
        >
          <MapPin className="h-7 w-7 text-white" strokeWidth={2.5} />
        </Button>
      )}

      <CardContent className="p-8 relative">
        <div className="flex flex-col md:flex-row gap-8">
          <Avatar className="h-24 w-24 rounded-3xl shadow-xl shadow-black/5 border-4 border-slate-50">
            {clinic.logoUrl && <AvatarImage src={clinic.logoUrl} alt={clinic.name} />}
            <AvatarFallback className="bg-slate-50 text-slate-300">
              <Building2 className="h-10 w-10 opacity-20" />
            </AvatarFallback>
          </Avatar>

          <div className="flex-grow space-y-4">
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-2">{clinic.name}</h2>
              <p className="text-xs font-black text-theme-blue uppercase tracking-widest leading-none">{clinic.type}</p>
            </div>

            {clinic.address && (
              <div className="flex items-start gap-2.5 text-sm font-bold text-slate-400 group/addr hover:text-slate-600 transition-colors cursor-default">
                <MapPin className="w-4 h-4 mt-0.5 text-slate-300 group-hover/addr:text-theme-blue transition-colors" />
                <span className="leading-relaxed">{clinic.address}</span>
              </div>
            )}

            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border-2 border-slate-100/50">
                <Users className="w-4 h-4 text-slate-400" strokeWidth={2.5} />
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                  {doctorCount} {doctorCount !== 1 ? t.clinics.doctorsPlural : t.clinics.doctors}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
