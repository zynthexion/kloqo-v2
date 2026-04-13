'use client';

/**
 * useLocation
 *
 * Extracted from home/page.tsx (was ~250 lines of inline geolocation logic).
 * Centralizes all browser geolocation handling:
 * - Reads/writes location to localStorage (30-min cache)
 * - Resolves human-readable location name via Nominatim reverse geocoding
 * - Handles permission state gracefully (denied, prompt, granted)
 *
 * Benefits:
 * - home/page.tsx is ~250 lines shorter
 * - Location logic is independently testable
 * - Geolocation helpers are reusable (consult-today, book-appointment)
 */

import { useState, useEffect, useCallback } from 'react';

const CACHE_KEY_COORDS = 'kloqo_user_location';
const CACHE_KEY_NAME = 'kloqo_user_location_name';
const CACHE_KEY_TS = 'kloqo_user_location_timestamp';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

async function getLocationName(lat: number, lng: number): Promise<string> {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
        );
        if (!response.ok) throw new Error('Failed to fetch location');
        const data = await response.json();
        if (data?.address) {
            const addr = data.address;
            return addr.locality || addr.city || addr.town || addr.village || addr.state_district || addr.state || 'Location detected';
        }
        return 'Location detected';
    } catch {
        return 'Current Location';
    }
}

function getGeolocationErrorMessage(error: unknown): string {
    return (
        (error as GeolocationPositionError)?.message ??
        (error as { message?: string })?.message ??
        (error as Error)?.message ??
        `Geolocation error code: ${(error as GeolocationPositionError)?.code ?? 'unknown'}`
    );
}

interface UseLocationResult {
    location: string;
    userLocation: { lat: number; lng: number } | null;
    isLocationLoading: boolean;
    isRefreshingLocation: boolean;
    refreshLocation: () => Promise<void>;
}

interface UseLocationParams {
    activeTab?: string;
    detectingLabel: string;
    notSupportedLabel: string;
    notAvailableLabel: string;
    currentLocationLabel: string;
}

export function useLocation({
    activeTab,
    detectingLabel,
    notSupportedLabel,
    notAvailableLabel,
    currentLocationLabel,
}: UseLocationParams): UseLocationResult {
    const [location, setLocation] = useState(detectingLabel);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [isLocationLoading, setIsLocationLoading] = useState(false);
    const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);

    const handlePosition = useCallback(async (position: GeolocationPosition, silent = false) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLocation({ lat, lng });
        setIsLocationLoading(false);
        if (!silent) setIsRefreshingLocation(false);

        try {
            localStorage.setItem(CACHE_KEY_COORDS, JSON.stringify({ lat, lng }));
            localStorage.setItem(CACHE_KEY_TS, Date.now().toString());
        } catch { /* ignore */ }

        // Defer name fetch to not block UI
        const resolveNameAsync = async () => {
            try {
                const name = await getLocationName(lat, lng);
                setLocation(name || currentLocationLabel);
                try { localStorage.setItem(CACHE_KEY_NAME, name); } catch { /* ignore */ }
            } catch {
                if (!silent) setLocation(currentLocationLabel);
            }
        };

        if (silent) {
            setTimeout(resolveNameAsync, 0);
        } else {
            resolveNameAsync();
        }
    }, [currentLocationLabel]);

    const handleError = useCallback((error: unknown, silent = false) => {
        if (!silent) {
            console.warn('Geolocation error:', getGeolocationErrorMessage(error));
            setLocation(notAvailableLabel);
            setIsRefreshingLocation(false);
        }
        setIsLocationLoading(false);
    }, [notAvailableLabel]);

    const GEO_OPTIONS_HIGH: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
    const GEO_OPTIONS_LOW: PositionOptions = { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 };

    const refreshLocation = useCallback(async () => {
        setIsRefreshingLocation(true);
        setLocation(detectingLabel);

        if (!navigator.geolocation) {
            setLocation(notSupportedLabel);
            setIsRefreshingLocation(false);
            return;
        }

        try {
            navigator.geolocation.getCurrentPosition(
                (pos) => handlePosition(pos),
                (err) => handleError(err),
                GEO_OPTIONS_HIGH
            );
        } catch (err) {
            handleError(err);
        }
    }, [detectingLabel, notSupportedLabel, handlePosition, handleError]);

    useEffect(() => {
        setLocation(detectingLabel);

        if (!navigator.geolocation) {
            setLocation(notSupportedLabel);
            return;
        }

        // Load from cache first
        let hasValidCache = false;
        try {
            const cachedCoords = localStorage.getItem(CACHE_KEY_COORDS);
            const cachedTs = localStorage.getItem(CACHE_KEY_TS);
            const cachedName = localStorage.getItem(CACHE_KEY_NAME);

            if (cachedCoords && cachedTs) {
                const age = Date.now() - parseInt(cachedTs, 10);
                if (age < CACHE_DURATION_MS) {
                    const { lat, lng } = JSON.parse(cachedCoords);
                    setUserLocation({ lat, lng });
                    setIsLocationLoading(false);
                    if (cachedName) setLocation(cachedName);
                    hasValidCache = true;

                    // Silent refresh after 5 seconds if permission granted
                    setTimeout(async () => {
                        try {
                            if (navigator.permissions) {
                                const perm = await navigator.permissions.query({ name: 'geolocation' });
                                if (perm.state === 'granted') {
                                    navigator.geolocation.getCurrentPosition(
                                        (pos) => handlePosition(pos, true),
                                        () => { /* silent — ignore error */ },
                                        GEO_OPTIONS_LOW
                                    );
                                }
                            }
                        } catch { /* ignore */ }
                    }, 5000);
                }
            }
        } catch { /* ignore cache read errors */ }

        if (hasValidCache && activeTab !== 'all') return;

        // Request fresh location
        const requestFreshLocation = async () => {
            try {
                if (navigator.permissions) {
                    const perm = await navigator.permissions.query({ name: 'geolocation' });
                    if (perm.state === 'denied') {
                        setLocation(notAvailableLabel);
                        setIsLocationLoading(false);
                        return;
                    }
                }
                setIsLocationLoading(true);
                navigator.geolocation.getCurrentPosition(
                    (pos) => handlePosition(pos),
                    (err) => handleError(err),
                    GEO_OPTIONS_LOW
                );
            } catch {
                setLocation(notAvailableLabel);
                setIsLocationLoading(false);
            }
        };

        requestFreshLocation();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Track loading state when switching to "all" tab
    useEffect(() => {
        if (activeTab === 'all' && !userLocation) {
            try {
                const cachedTs = localStorage.getItem(CACHE_KEY_TS);
                if (cachedTs) {
                    const age = Date.now() - parseInt(cachedTs, 10);
                    setIsLocationLoading(age >= CACHE_DURATION_MS);
                } else {
                    setIsLocationLoading(true);
                }
            } catch {
                setIsLocationLoading(true);
            }
        } else {
            setIsLocationLoading(false);
        }
    }, [activeTab, userLocation]);

    return { location, userLocation, isLocationLoading, isRefreshingLocation, refreshLocation };
}
