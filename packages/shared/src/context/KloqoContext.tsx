'use client';

import React, { createContext, useContext, useMemo } from 'react';

// ─── Contract ────────────────────────────────────────────────────────────────
/**
 * KloqoIntegrator — The standardized integration interface.
 *
 * Every app (clinic-admin, nurse-app, patient-app) must provide these
 * capabilities at the provider level. The shared hooks read them via
 * the `useKloqo()` context hook, keeping logic hooks completely
 * decoupled from app-specific auth, network clients, and UI libraries.
 */
export interface KloqoIntegrator {
  /**
   * The app's HTTP client, adapted to a standard signature.
   * Maps to `adminApiRequest`, `nurseApiRequest`, or `patientApiRequest` via
   * the Adapter Pattern at the provider level.
   */
  apiRequest: <T>(url: string, options?: RequestInit) => Promise<T>;

  /**
   * The app's toast notification function.
   * Maps to the local `useToast()` or `toast()` implementation.
   */
  toast: (props: {
    title: string;
    description?: string;
    variant?: 'default' | 'destructive';
  }) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const KloqoContext = createContext<KloqoIntegrator | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

interface KloqoProviderProps {
  config: KloqoIntegrator;
  children: React.ReactNode;
}

/**
 * KloqoProvider
 *
 * Wrap your app root with this provider and inject the app-specific
 * adapter implementations. Shared hooks will automatically discover
 * the correct `apiRequest` and `toast` via `useKloqo()`.
 *
 * @example
 * // apps/clinic-admin/src/app/layout.tsx
 * <KloqoProvider config={{
 *   apiRequest: (url, opts) => adminApiRequest(url, opts),
 *   toast: (p) => toast({ title: p.title, variant: p.variant }),
 * }}>
 *   {children}
 * </KloqoProvider>
 */
export function KloqoProvider({ config, children }: KloqoProviderProps) {
  // Memoize so consumers don't re-render on every parent render
  const value = useMemo(() => config, [config]);
  return <KloqoContext.Provider value={value}>{children}</KloqoContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useKloqo
 *
 * Consumes the KloqoIntegrator from the nearest KloqoProvider.
 * Must be used inside a KloqoProvider — throws if the context is missing.
 */
export function useKloqo(): KloqoIntegrator {
  const ctx = useContext(KloqoContext);
  if (!ctx) {
    throw new Error(
      '[KloqoContext] useKloqo() must be called inside a <KloqoProvider>. ' +
      'Wrap your app root with <KloqoProvider config={...}>.'
    );
  }
  return ctx;
}
