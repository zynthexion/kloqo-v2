import { useNurseDashboardContext } from '@/contexts/NurseDashboardContext';

export function useNurseDashboard(clinicId?: string | undefined) {
  return useNurseDashboardContext();
}
