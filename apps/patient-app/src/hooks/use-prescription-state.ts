'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/api-client';
import { Appointment } from '@kloqo/shared';

export type Tab = 'queue' | 'search';

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val?.toDate) return val.toDate();
  return new Date(val);
}

/**
 * usePrescriptionState
 * Logic for managing pharmacist prescription workflows, including live queue
 * polling, searching patient history, and handling dispense/abandon actions.
 */
export function usePrescriptionState() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('queue');
  const [queue, setQueue] = useState<Appointment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Appointment[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  // Dispense modal state
  const [dispenseTarget, setDispenseTarget] = useState<Appointment | null>(null);
  const [billValue, setBillValue] = useState('');
  const [dispensing, setDispensing] = useState(false);

  // Abandon modal state
  const [abandonTarget, setAbandonTarget] = useState<Appointment | null>(null);
  const [abandonReason, setAbandonReason] = useState('');
  const [abandoning, setAbandoning] = useState(false);

  const clinicId = user?.clinicId;

  const fetchQueue = useCallback(async () => {
    if (!clinicId) return;
    setLoadingQueue(true);
    try {
      const data = await apiRequest<Appointment[]>(`/clinic/prescriptions?clinicId=${clinicId}&pharmacyStatus=pending`);
      setQueue((data || []).sort((a, b) => {
        const aTime = toDate(a.completedAt)?.getTime() ?? 0;
        const bTime = toDate(b.completedAt)?.getTime() ?? 0;
        return aTime - bTime;
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingQueue(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const confirmDispense = async () => {
    if (!dispenseTarget) return;
    setDispensing(true);
    try {
      await apiRequest(`/prescriptions/${dispenseTarget.id}/dispense`, {
        method: 'PATCH',
        body: JSON.stringify({ billValue: billValue ? Number(billValue) : undefined }),
      });
      setQueue(prev => prev.filter(a => a.id !== dispenseTarget.id));
      setDispenseTarget(null);
      setBillValue('');
    } catch (e) {
      console.error(e);
    } finally {
      setDispensing(false);
    }
  };

  const confirmAbandon = async () => {
    if (!abandonTarget || !abandonReason) return;
    setAbandoning(true);
    try {
      await apiRequest(`/prescriptions/${abandonTarget.id}/abandon`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: abandonReason }),
      });
      setQueue(prev => prev.filter(a => a.id !== abandonTarget.id));
      setAbandonTarget(null);
      setAbandonReason('');
    } catch (e) {
      console.error(e);
    } finally {
      setAbandoning(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !clinicId) return;
    setLoadingSearch(true);
    try {
      const data = await apiRequest<Appointment[]>(`/clinic/prescriptions?clinicId=${clinicId}`);
      const q = searchQuery.toLowerCase();
      setSearchResults((data || []).filter(a => a.patientName?.toLowerCase().includes(q)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSearch(false);
    }
  };

  return {
    activeTab, setActiveTab,
    queue, searchResults,
    loadingQueue, loadingSearch,
    searchQuery, setSearchQuery,
    viewerUrl, setViewerUrl,
    dispenseTarget, setDispenseTarget, billValue, setBillValue, dispensing,
    abandonTarget, setAbandonTarget, abandonReason, setAbandonReason, abandoning,
    handleSearch, confirmDispense, confirmAbandon,
    clinicId
  };
}
