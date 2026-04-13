'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { Users, ChevronRight, Stethoscope, GraduationCap } from 'lucide-react';
import type { Doctor } from '@kloqo/shared';
import { getLocalizedDepartmentName } from '@/lib/department-utils';

interface PublicDoctorCardProps {
  doctor: Doctor;
  t: any;
  departments: any[];
  language: 'en' | 'ml';
}

export function PublicDoctorCard({ doctor, t, departments, language }: PublicDoctorCardProps) {
  const router = useRouter();

  const handleBook = () => {
    router.push(`/book-appointment?doctorId=${doctor.id}&clinicId=${doctor.clinicId}`);
  };

  return (
    <Card 
      className="mb-6 border-none shadow-2xl shadow-black/5 rounded-[2.5rem] bg-white cursor-pointer hover:shadow-theme-blue/10 active:scale-[0.98] transition-all group overflow-hidden"
      onClick={handleBook}
    >
      <CardContent className="p-8">
        <div className="flex gap-8 relative">
          <Avatar className="h-28 w-28 rounded-3xl border-4 border-slate-50 shadow-xl shadow-black/5 shrink-0 group-hover:scale-105 transition-transform duration-500">
            {doctor.avatar && <AvatarImage src={doctor.avatar} alt={doctor.name} />}
            <AvatarFallback className="bg-slate-50 text-slate-300">
              <Users className="h-10 w-10 opacity-20" />
            </AvatarFallback>
          </Avatar>

          <div className="flex-grow space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none mb-1 group-hover:text-theme-blue transition-colors">Dr. {doctor.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{doctor.specialty}</span>
                  {doctor.department && (
                    <Badge variant="secondary" className="bg-blue-50 text-theme-blue border-none px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-full">
                      {getLocalizedDepartmentName(doctor.department, language, departments)}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-2xl text-slate-300 group-hover:text-theme-blue group-hover:bg-theme-blue/5 transition-all">
                <ChevronRight className="h-5 w-5" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400 pt-1">
              {(doctor as any).education && (
                <div className="flex items-center gap-2 group/meta">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center group-hover/meta:bg-slate-100 transition-colors">
                    <GraduationCap className="h-4 w-4 text-slate-300" />
                  </div>
                  <span>{(doctor as any).education}</span>
                </div>
              )}
              {doctor.experienceYears && (
                <div className="flex items-center gap-2 group/meta">
                   <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center group-hover/meta:bg-slate-100 transition-colors">
                    <Stethoscope className="h-4 w-4 text-slate-300" />
                  </div>
                  <span>{doctor.experienceYears} Years Exp</span>
                </div>
              )}
            </div>

            <Button
              onClick={e => { e.stopPropagation(); handleBook(); }}
              className="w-full h-14 rounded-2xl bg-theme-blue text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-theme-blue/20 hover:scale-[1.01] active:scale-[0.98] transition-all mt-2"
            >
              {t.clinics.bookAppointment}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
