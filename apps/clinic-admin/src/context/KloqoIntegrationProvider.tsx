'use client';

import { KloqoProvider, type KloqoIntegrator } from '@kloqo/shared';
import { apiRequest } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

/**
 * KloqoIntegrationProvider — Clinic Admin Adapter
 *
 * Maps this app's local dependencies to the shared KloqoIntegrator contract.
 * This is the ONLY place where app-specific auth tokens and UI libraries
 * are wired into the shared logic layer.
 */
export function KloqoIntegrationProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();

  const config: KloqoIntegrator = {
    // Adapter: clinic-admin uses 'kloqo_token' in localStorage
    apiRequest: <T,>(url: string, options?: RequestInit) => apiRequest<T>(url, options),
    // Adapter: map shared toast shape to this app's Radix toast
    toast: (p) => toast({ title: p.title, description: p.description, variant: p.variant }),
  };

  return <KloqoProvider config={config}>{children}</KloqoProvider>;
}
