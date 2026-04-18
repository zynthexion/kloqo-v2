'use client';

import { KloqoProvider, type KloqoIntegrator } from '@kloqo/shared';
import { apiRequest } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

/**
 * KloqoIntegrationProvider — Nurse App Adapter
 *
 * Maps this app's local dependencies to the shared KloqoIntegrator contract.
 * Note: nurse-app uses 'token' key in localStorage (vs clinic-admin's 'kloqo_token').
 * The adapter pattern means the shared hooks never need to know this difference.
 */
export function KloqoIntegrationProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();

  const config: KloqoIntegrator = {
    // Adapter: nurse-app uses 'token' in localStorage (handled in api-client.ts)
    apiRequest: <T,>(url: string, options?: RequestInit) => apiRequest<T>(url, options),
    // Adapter: map shared toast shape to this app's Radix toast
    toast: (p) => toast({ title: p.title, description: p.description, variant: p.variant }),
  };

  return <KloqoProvider config={config}>{children}</KloqoProvider>;
}
