'use client';

import { useState, useCallback, useEffect } from 'react';
import { subDays } from 'date-fns';
import { apiRequest } from '@/lib/api-client';
import { getClinicNow } from '@kloqo/shared-core';
import type { DateRange } from 'react-day-picker';

export function useDashboard() {
  const now = getClinicNow();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(now, 6),
    to: now,
  });
  const [selectedDate, setSelectedDate] = useState<Date>(now);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setDataLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append('startDate', dateRange.from.toISOString());
      if (dateRange?.to) params.append('endDate', dateRange.to.toISOString());

      const data = await apiRequest(`/clinic/dashboard?${params.toString()}`);
      setDashboardData(data);
    } catch (error: any) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setDataLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleDateSelect = useCallback((date: Date | undefined) => {
    if (date) setSelectedDate(date);
  }, []);

  return {
    dateRange,
    setDateRange,
    selectedDate,
    setSelectedDate,
    dashboardData,
    dataLoading,
    isPrinting,
    setIsPrinting,
    isPrintMode,
    setIsPrintMode,
    handleDateSelect,
    fetchDashboardData
  };
}
