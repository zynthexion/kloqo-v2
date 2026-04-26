'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/api-client';
import { format, subDays, startOfMonth, startOfYear, endOfDay } from 'date-fns';

export type DateRangeType = 'today' | '7days' | 'monthly' | 'yearly';

interface AnalyticsData {
  current: {
    totalPatients: number;
    completedAppointments: number;
    cancelledAppointments: number;
    upcomingAppointments: number;
    noShowAppointments: number;
    totalRevenue: number;
    totalDoctors: number;
  };
  comparison: {
    patientsChange: string;
    appointmentsChange: string;
    revenueChange: string;
    cancelledChange: string;
  };
  timeSeries: Array<{
    label: string;
    newPatients: number;
    revenue: number;
    appointments: number;
  }>;
  hourlyStats: Array<{
    hour: number;
    count: number;
  }>;
}

export function useAnalytics(doctorId?: string) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DateRangeType>('7days');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      
      let start: Date;
      const end = new Date();

      switch (range) {
        case 'today':
          start = new Date();
          break;
        case '7days':
          start = subDays(new Date(), 6);
          break;
        case 'monthly':
          start = startOfMonth(new Date());
          break;
        case 'yearly':
          start = startOfYear(new Date());
          break;
        default:
          start = subDays(new Date(), 6);
      }

      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      
      let url = `/clinics/dashboard?start=${startStr}&end=${endStr}`;
      if (doctorId) {
        url += `&doctorId=${doctorId}`;
      }

      console.log('📡 [Analytics Request]:', url);
      const res = await apiRequest<AnalyticsData>(url);
      setData(res);
      setError(null);
    } catch (err: any) {
      console.error('[Analytics] Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [range, doctorId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    data,
    loading,
    error,
    range,
    setRange,
    refresh: fetchAnalytics
  };
}
