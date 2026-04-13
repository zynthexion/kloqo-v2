import { useActiveIdentityInternal } from '@/contexts/ActiveIdentityContext';

/**
 * useActiveIdentity Hook
 * 
 * Now a simple wrapper around the global ActiveIdentityContext.
 * Ensures a single source of truth for the active role across the app.
 */
export function useActiveIdentity() {
  return useActiveIdentityInternal();
}
