'use client';

import { useEffect } from 'react';

export function LocationOnboard() {
    useEffect(() => {
        // Trigger location permission request on mount if not already granted/denied
        if ('geolocation' in navigator) {
            navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
                if (result.state === 'prompt') {
                    // This will trigger the native browser prompt
                    navigator.geolocation.getCurrentPosition(
                        () => console.log('📍 Location permission granted'),
                        () => console.warn('📍 Location permission denied'),
                        { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
                    );
                }
            });
        }
    }, []);

    return null;
}
