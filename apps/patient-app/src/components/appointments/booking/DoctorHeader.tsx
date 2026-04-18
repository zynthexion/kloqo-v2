'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { getLocalizedDepartmentName } from '@/lib/department-utils';
import type { Doctor } from '@kloqo/shared';
import { useLanguage } from '@/contexts/language-context';
import { useMasterDepartments } from '@/hooks/use-master-departments';

interface DoctorHeaderProps {
  doctor: Doctor | null;
  loading: boolean;
}

export function DoctorHeader({ doctor, loading }: DoctorHeaderProps) {
  const { language } = useLanguage();
  const { departments } = useMasterDepartments();

  if (loading || !doctor) {
    return (
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-grow space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16 shadow-lg shadow-black/5">
        {doctor.avatar && <AvatarImage src={doctor.avatar} alt={doctor.name} />}
        <AvatarFallback className="bg-slate-100 text-slate-400 font-bold">
          {(doctor.name || '??').split(' ').map(n => n[0]).join('').slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-grow">
        <h3 className="font-black text-lg text-slate-900 tracking-tight">Dr. {doctor.name}</h3>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-loose">
          {getLocalizedDepartmentName(doctor.department, language, departments)}
        </p>
        {doctor.specialty && (
          <p className="text-[10px] font-black text-theme-blue uppercase tracking-widest mt-0.5">
            {doctor.specialty}
          </p>
        )}
      </div>
    </div>
  );
}
