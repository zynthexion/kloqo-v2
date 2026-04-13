import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/language-context';

interface ClinicLocation {
    latitude: number;
    longitude: number;
}

export function useClinicLocation(clinic: ClinicLocation | null) {
    const { t } = useLanguage();
    const [locationError, setLocationError] = useState<string | null>(null);
    const [isCheckingLocation, setIsCheckingLocation] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);

    // Calculate distance between two points in meters
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371e3; // Earth radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    };

    const checkLocation = async () => {
        if (!clinic) return { allowed: true };

        if (!navigator.geolocation) {
            return {
                allowed: false,
                error: 'Geolocation is not supported on this device'
            };
        }

        setIsCheckingLocation(true);
        setLocationError(null);

        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                });
            });

            const { latitude, longitude } = position.coords;
            const distance = calculateDistance(
                latitude,
                longitude,
                clinic.latitude,
                clinic.longitude
            );

            setIsCheckingLocation(false);

            // Check if within 150 meters
            if (distance > 150) {
                const distanceMeters = Math.round(distance);
                return {
                    allowed: false,
                    error: `You must be within 150 meters of the clinic. Current distance: ${distanceMeters}m away. Please try checking your location again or contact the clinic.`
                };
            }

            return { allowed: true, distance: Math.round(distance) };
        } catch (error: any) {
            setIsCheckingLocation(false);
            let errorMsg = t.consultToday.couldNotAccessLocation;

            const errorCode = (error as GeolocationPositionError)?.code ?? (error as { code?: number })?.code;

            if (errorCode === 1) {
                errorMsg = t.consultToday.locationDenied;
                console.error("Geolocation error: Permission denied");
            } else if (errorCode === 2) {
                errorMsg = t.consultToday.locationUnavailable;
                if (process.env.NODE_ENV === 'development') {
                    console.debug("Geolocation unavailable (normal in some situations):", {
                        code: errorCode,
                        note: "CoreLocation may report kCLErrorLocationUnknown when GPS cannot get a fix. This is expected behavior indoors or with poor signal."
                    });
                }
            } else if (errorCode === 3) {
                errorMsg = t.consultToday.locationRequestTimeout;
                console.warn("Geolocation timeout:", { code: errorCode });
            } else {
                console.error("Geolocation error (unknown):", {
                    code: errorCode,
                    error: error,
                    errorType: typeof error
                });
            }

            return { allowed: false, error: errorMsg };
        }
    };

    // Auto-check location when clinic is loaded
    useEffect(() => {
        if (clinic && !permissionGranted && !isCheckingLocation && !locationError) {
            const autoCheck = async () => {
                const result = await checkLocation();
                if (result.allowed) {
                    setPermissionGranted(true);
                }
            };
            autoCheck();
        }
    }, [clinic]); // Only run when clinic loads

    const handleManualEntry = async () => {
        setIsCheckingLocation(true);
        setLocationError(null);

        const result = await checkLocation();

        if (!result.allowed) {
            setLocationError(result.error || 'Location check failed');
            setIsCheckingLocation(false);
            return;
        }

        setPermissionGranted(true);
        setIsCheckingLocation(false);
    };

    return {
        locationError,
        setLocationError,
        isCheckingLocation,
        permissionGranted,
        setPermissionGranted,
        checkLocation,
        handleManualEntry
    };
}
