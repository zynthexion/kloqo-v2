'use client';

import type { Appointment } from '@kloqo/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusBadgeProps = {
  status: Appointment['status'];
  cancellationReason?: string;
  isRescheduled?: boolean;
  theme?: string;
};

export function StatusBadge({ status, cancellationReason, isRescheduled, theme }: StatusBadgeProps) {
  const isModern = theme === 'modern';
  
  switch (status) {
    case 'No-show':
      return <Badge variant="destructive" className={cn(isModern && "bg-red-500/10 text-red-600 border-none rounded-full px-3")}>No-show</Badge>
    case 'Pending':
      return <Badge variant="secondary" className={cn(isModern && "bg-slate-500/10 text-slate-600 border-none rounded-full px-3")}>Pending</Badge>
    case 'Confirmed':
      return <Badge variant="default" className={cn(isModern && "bg-primary/10 text-primary border-none rounded-full px-3")}>Confirmed</Badge>
    case 'Cancelled':
      if (cancellationReason === 'DOCTOR_LEAVE') {
        return <Badge variant="destructive" className={cn("bg-orange-500 text-white", isModern && "bg-orange-500/10 text-orange-600 border-none rounded-full px-3")}>Doctor Leave</Badge>;
      }
      if (isRescheduled) {
        return (
          <Badge
            variant="outline"
            className={cn("bg-orange-100 text-orange-800 border-orange-200", isModern && "bg-amber-500/10 text-amber-600 border-none rounded-full px-3")}
          >
            Rescheduled
          </Badge>
        );
      }
      return <Badge variant="secondary" className={cn(isModern && "bg-slate-400/10 text-slate-500 border-none rounded-full px-3")}>Cancelled</Badge>
    case 'Completed':
      return <Badge variant="default" className={cn("bg-green-600", isModern && "bg-green-500/10 text-green-600 border-none rounded-full px-3")}>Completed</Badge>
    case 'InConsultation':
      return <Badge variant="default" className={cn("bg-blue-600 animate-pulse", isModern && "bg-blue-500/10 text-blue-600 border-none rounded-full px-3 font-black")}>In Room</Badge>
    case 'Skipped':
      return <Badge variant="destructive" className={cn("bg-yellow-500 text-white", isModern && "bg-yellow-500/10 text-yellow-600 border-none rounded-full px-3")}>Skipped</Badge>;
    default:
      return null;
  }
}
