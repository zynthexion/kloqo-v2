'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/language-context';
import { usePwa } from '@/lib/pwa';
import { Users, MapPin, FileText, Shield, Download, HelpCircle } from 'lucide-react';

/**
 * useProfileState
 * Logic for user profile management, PWA installation prompts, 
 * and modal state orchestration.
 */
export function useProfileState() {
    const { t } = useLanguage();
    const { user, logout, loading: userLoading } = useAuth();
    const { isIOS, isStandalone, isInstallable, promptInstall } = usePwa();

    // Dialog States
    const [showTerms, setShowTerms] = useState(false);
    const [showPrivacy, setShowPrivacy] = useState(false);
    const [showComingSoon, setShowComingSoon] = useState(false);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [isAndroidDevice, setIsAndroidDevice] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsAndroidDevice(/Android/i.test(navigator.userAgent));
        }
    }, []);

    const getUserInitials = useCallback(() => {
        const name = user?.name || user?.email || '';
        if (!name) return 'AD';
        const parts = name.trim().split(' ');
        return parts.length >= 2 
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() 
            : name.substring(0, 2).toUpperCase();
    }, [user]);

    const handleAllowLocation = () => {
        if (!navigator.geolocation) {
            alert(t.consultToday.geolocationNotSupported || 'Geolocation not supported');
            return;
        }
        navigator.geolocation.getCurrentPosition(() => {}, (error) => {
            if (error.code === error.PERMISSION_DENIED) alert(t.consultToday.locationDenied);
        }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
    };

    const handleInstallAction = async () => {
        if (isStandalone) {
            window.location.href = window.location.origin;
            return;
        }
        if (isAndroidDevice && isInstallable) {
            await promptInstall();
        }
        setShowInstallPrompt(false);
    };

    const menuItems = useMemo(() => [
        { icon: Users, label: t.profile?.friendsAndFamily || 'Your Friends and Family', href: '/profile/relatives' },
        { icon: MapPin, label: t.profile?.allowLocation || 'Allow Location', onClick: handleAllowLocation },
        { icon: FileText, label: t.profile.terms, onClick: () => setShowTerms(true) },
        { icon: Shield, label: t.profile.privacyPolicy, onClick: () => setShowPrivacy(true) },
        { icon: Download, label: t.profile.installAppMenu, onClick: () => setShowInstallPrompt(true) },
        { icon: HelpCircle, label: t.profile.help, href: '/contact' },
    ], [t]);

    return {
        user, userLoading, logout,
        getUserInitials,
        menuItems,
        dialogs: {
            showTerms, setShowTerms,
            showPrivacy, setShowPrivacy,
            showComingSoon, setShowComingSoon,
            showInstallPrompt, setShowInstallPrompt
        },
        pwa: { isIOS, isStandalone, isInstallable, isAndroidDevice, handleInstallAction },
        t
    };
}
