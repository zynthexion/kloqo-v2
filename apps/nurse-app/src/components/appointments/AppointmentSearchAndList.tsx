import React from 'react';
import { Search, CalendarDays, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Appointment } from '@kloqo/shared';
import AppointmentList from '@/components/clinic/AppointmentList';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface AppointmentSearchAndListProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  isLoading: boolean;
  appointments: Appointment[];
  onUpdateStatus: (id: string, status: string) => void;
  selectedDate: Date;
  isTablet?: boolean;
  consultationStatus?: string;
  onViewPrescription?: (url: string) => void;
  page?: number;
  setPage?: (p: number) => void;
  totalCount?: number;
  hasMore?: boolean;
  limit?: number;
}

export const AppointmentSearchAndList: React.FC<AppointmentSearchAndListProps> = ({
  searchTerm,
  onSearchChange,
  isLoading,
  appointments,
  onUpdateStatus,
  selectedDate,
  isTablet = false,
  consultationStatus = 'Out',
  onViewPrescription,
  page = 1,
  setPage,
  totalCount = 0,
  hasMore = false,
  limit = 10
}) => {
  console.log('[AppointmentSearchAndList] Rendering with:', { 
    searchTerm, 
    appointmentsCount: appointments.length,
    isLoading 
  });
  const content = (
    <div className={cn("flex flex-col h-full", isTablet && "bg-white shadow-premium rounded-[2.5rem] border border-slate-50 overflow-hidden min-h-[600px]")}>
      {isTablet && (
        <div className="p-8 border-b border-slate-50 bg-slate-50/30">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Appointments List</h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Found {appointments.length} patients</p>
        </div>
      )}

      {!isTablet && (
        <div className="px-4 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search patients..."
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              className="pl-9 rounded-xl bg-slate-50 border-slate-200"
            />
          </div>
        </div>
      )}

      {isTablet && (
         <div className="px-8 pt-6">
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                <Input
                    placeholder="Quickly search by name..."
                    value={searchTerm}
                    onChange={e => onSearchChange(e.target.value)}
                    className="pl-11 h-12 bg-slate-50 border-none rounded-2xl placeholder:font-medium placeholder:text-slate-400 focus-visible:ring-primary/20"
                />
            </div>
         </div>
      )}

      <div className={cn("flex-1 overflow-y-auto", !isTablet && "pb-20")}>
        {isLoading ? (
          <div className="flex justify-center items-center h-48 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-theme-blue" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-300 py-10 opacity-60">
            <CalendarDays className="h-16 w-16 mb-4 opacity-10" />
            <p className={cn("text-lg font-black uppercase tracking-widest", !isTablet && "text-sm")}>No appointments found</p>
            <p className="text-xs font-bold mt-1 opacity-50 uppercase tracking-tighter">
              {searchTerm ? `Search: "${searchTerm}" across all dates` : format(selectedDate, 'MMMM d, yyyy')}
            </p>
          </div>
        ) : (
          <div className={cn("px-2", !isTablet && "px-0")}>
            <AppointmentList
              appointments={appointments}
              onUpdateStatus={onUpdateStatus as any}
              showStatusBadge={true}
              showTopRightActions={false}
              clinicStatus={consultationStatus as 'In' | 'Out'}
              onViewPrescription={onViewPrescription}
            />
          </div>
        )}
      </div>

      {totalCount > limit && setPage && (
        <div className="p-4 border-t bg-slate-50/50 flex items-center justify-between">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Showing {((page - 1) * limit) + 1}-{Math.min(page * limit, totalCount)} of {totalCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest border-slate-200"
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore}
              onClick={() => setPage(page + 1)}
              className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest border-slate-200"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return content;
};
