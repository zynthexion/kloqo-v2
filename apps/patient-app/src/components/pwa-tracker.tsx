'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePwa } from '@/lib/pwa';
import { apiRequest } from '@/lib/api-client';

/**
 * PwaTracker
 * Automatically syncs the "isStandalone" status to the user profile 
 * via the REST API when the app is installed.
 */
export function PwaTracker() {
    const { user } = useAuth();
    const { isStandalone } = usePwa();

    useEffect(() => {
        // Only proceed if:
        // 1. User is logged in (has a valid ID)
        // 2. App is running in standalone mode (PWA installed)
        // 3. We haven't already marked them as installed in the current session data
        if (user?.id && isStandalone && !user.pwaInstalled) {
            const trackPwaUsage = async () => {
                try {
                    // Update user profile via standard REST API
                    await apiRequest(`/users/${user.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                            pwaInstalled: true,
                            lastPwaAccess: new Date().toISOString()
                        })
                    });
                    console.log('📱 User marked as PWA user via API');
                } catch (error) {
                    console.error('Error updating PWA status via API:', error);
                }
            };

            trackPwaUsage();
        }
    }, [user?.id, user?.pwaInstalled, isStandalone]);

    return null; // Side-effect only component
}

