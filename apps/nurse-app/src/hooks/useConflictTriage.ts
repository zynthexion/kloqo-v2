import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiRequest } from '@/lib/api-client';
import { Appointment } from '@kloqo/shared';
import { useAuth } from '@/contexts/AuthContext';
import { useSSE } from './use-sse';
import { useToast } from './use-toast';
import { getClinicISOString } from '@kloqo/shared-core';

export interface ConflictWithSuggestion extends Appointment {
  suggestedSlot?: {
    date: string;
    time: string;
    slotIndex: number;
    sessionIndex: number;
  };
}

export function useConflictTriage() {
  const { user } = useAuth();
  const clinicId = user?.clinicId;
  const [conflicts, setConflicts] = useState<ConflictWithSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchConflicts = useCallback(async () => {
    if (!clinicId) return;
    try {
      setLoading(true);
      const data = await apiRequest<Appointment[]>('/conflicts/pending');
      
      // For each conflict, we want to try and find a suggestion
      // To optimize, we group by doctor/date to avoid redundant slot fetches
      setConflicts(data as ConflictWithSuggestion[]);
      
      // Auto-suggest slots for each unique (doctorId, originalDate)
      const uniqueContexts = Array.from(new Set(data.map(c => `${c.doctorId}_${c.date}`)));
      
      for (const context of uniqueContexts) {
        const [doctorId, originalDate] = context.split('_');
        let foundSuggestion = false;
        
        // Search current day and next 7 days for an available slot
        for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
          if (foundSuggestion) break;
          
          try {
            const searchDate = new Date(originalDate);
            searchDate.setDate(searchDate.getDate() + dayOffset);
            const dateStr = searchDate.toISOString().split('T')[0];
            
            const slotsRes = await apiRequest<any>(`/appointments/available-slots?doctorId=${doctorId}&date=${dateStr}`);
            const availableSlots = (slotsRes.slots || []).filter((s: any) => s.status === 'available');
            
            if (availableSlots.length > 0) {
              setConflicts(prev => {
                let slotPtr = 0;
                return prev.map(c => {
                  if (c.doctorId === doctorId && c.date === originalDate && !c.suggestedSlot) {
                    const suggestion = availableSlots[slotPtr++];
                    if (suggestion) {
                      foundSuggestion = true;
                      return {
                        ...c,
                        suggestedSlot: {
                          date: dateStr,
                          time: new Date(suggestion.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          slotIndex: suggestion.slotIndex,
                          sessionIndex: suggestion.sessionIndex
                        }
                      };
                    }
                  }
                  return c;
                });
              });
            }
          } catch (e) {
            console.warn(`[Triage] Could not fetch suggestions for ${doctorId} on offset ${dayOffset}`);
          }
        }
      }

    } catch (error: any) {
      console.error('[Triage] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  // SSE: Listen for new conflicts
  useSSE({
    clinicId,
    onEvent: useCallback((data: any) => {
      if (data.type === 'appointment_status_changed') {
        const p = data.payload || {};
        if (p.conflictStatus === 'PENDING' || data.type === 'DOCTOR_AVAILABILITY_CHANGED') {
          fetchConflicts();
        }
      }
    }, [fetchConflicts])
  });

  useEffect(() => {
    fetchConflicts();
  }, [fetchConflicts]);

  const resolveConflict = async (id: string, action: 'CONFIRM' | 'RESCHEDULE' | 'CANCEL', payload: any = {}) => {
    try {
      await apiRequest(`/conflicts/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ action, ...payload })
      });
      
      setConflicts(prev => prev.filter(c => c.id !== id));
      
      toast({
        title: action === 'CONFIRM' ? "Confirmed" : "Cancelled",
        description: "Conflict resolved successfully."
      });
      
      // Refresh suggestions for the remaining patients of this doctor/date
      // because one slot is now taken
      fetchConflicts();
    } catch (error: any) {
      toast({
        title: "Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return {
    conflicts,
    loading,
    refresh: fetchConflicts,
    resolveConflict
  };
}
