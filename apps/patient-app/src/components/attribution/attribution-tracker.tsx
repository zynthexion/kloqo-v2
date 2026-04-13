'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/api-client';

const ATTRIBUTION_STORAGE_KEY = 'kloqo_attribution_ref';

/**
 * AttributionLogic
 * Extracts marketing "ref" from URL parameters and persists it to the user profile
 * using the standard REST API once the user is authenticated.
 */
function AttributionLogic() {
    const searchParams = useSearchParams();
    const { user, loading } = useAuth();

    useEffect(() => {
        // 1. Extract and store marketing ref from URL locally
        const ref = searchParams.get('ref');
        if (ref) {
            console.log(`[Attribution] 🎯 Storing ref from URL: ${ref}`);
            localStorage.setItem(ATTRIBUTION_STORAGE_KEY, ref);
        }

        // 2. Sync to Backend if user is logged in
        const syncAttributionToBackend = async () => {
            if (loading || !user?.id) return;

            const storedRef = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);

            // If we have a stored ref AND the user profile doesn't have an acquisition source yet
            if (storedRef && !(user as any).acquisitionSource) {
                console.log(`[Attribution] 🚀 Syncing source '${storedRef}' to user profile...`);

                try {
                    // Update user via standard API PATCH
                    await apiRequest(`/users/${user.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                            acquisitionSource: storedRef,
                            acquisitionTimestamp: new Date().toISOString()
                        })
                    });
                    console.log('[Attribution] ✅ Sync successful');
                } catch (error) {
                    console.error('[Attribution] ❌ Error syncing via API:', error);
                }
            }
        };

        syncAttributionToBackend();
    }, [searchParams, user?.id, (user as any)?.acquisitionSource, loading]);

    return null;
}

export function AttributionTracker() {
    return (
        <Suspense fallback={null}>
            <AttributionLogic />
        </Suspense>
    );
}

