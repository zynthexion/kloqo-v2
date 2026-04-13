'use client';

/**
 * useUser (V2 - Firebase Free Replacement)
 * This hook is left for backward compatibility during the purge. 
 * Any component using useUser should be migrated to use useAuth from context.
 */

import { useAuth } from '@/contexts/AuthContext';

export function useUser() {
    const { user, loading, logout } = useAuth();
    return {
        user, 
        loading,
        error: null,
        signOut: logout,
        checkUser: async () => {},
    };
}

export function UserProvider({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
