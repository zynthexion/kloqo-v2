import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { requestNotificationPermission, getFCMToken } from '@/lib/firebase-messaging';
import { useUser } from '@/hooks/api/use-user';
import { useLanguage } from '@/contexts/language-context';
import { apiRequest } from '@/lib/api-client';
import useSWR, { mutate } from 'swr';

export function NotificationSettings() {
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [primaryUserId, setPrimaryUserId] = useState<string | null>(null);
    const { toast } = useToast();
    const { user } = useUser();
    const { t } = useLanguage();
    const notifTexts = t.profile.notificationToasts;

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Get primaryUserId from profile sync
    useEffect(() => {
        if (!user) return;
        
        const resolvePrimaryId = async () => {
            try {
                // If the AppUser already has dbUserId, that's our primary anchor for notifications
                // In Kloqo V2, primaryUserId usually equals the patient's User UID
                if (user.dbUserId) {
                    setPrimaryUserId(user.dbUserId);
                } else {
                     // Fallback: fetch from backend if needed
                     const profile = await apiRequest('/auth/me');
                     if (profile?.user?.id) setPrimaryUserId(profile.user.id);
                }
            } catch (error) {
                console.error('[NotificationSettings] Resolve ID Error:', error);
            }
        };

        resolvePrimaryId();
    }, [user]);

    const { data: userResponse } = useSWR(
        isMounted && primaryUserId ? `/users/${primaryUserId}/notifications` : null,
        (url) => apiRequest(url),
        { revalidateOnFocus: false, shouldRetryOnError: false }
    );

    useEffect(() => {
        if (userResponse) {
            setNotificationsEnabled(userResponse.notificationsEnabled === true);
        }
    }, [userResponse]);

    const handleToggle = async (checked: boolean) => {
        if (!primaryUserId) return;
        setLoading(true);
        
        try {
            if (checked) {
                const permissionGranted = await requestNotificationPermission();
                if (!permissionGranted) {
                    toast({ title: notifTexts.permissionDeniedTitle, variant: 'destructive' });
                    setLoading(false);
                    return;
                }

                const token = await getFCMToken();
                const isLocal = window.location.hostname === 'localhost';
                
                await apiRequest(`/users/${primaryUserId}/notifications`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        fcmToken: token || null,
                        notificationsEnabled: true,
                        notificationPermissionGranted: true,
                        fcmTokenUpdatedAt: new Date().toISOString(),
                    })
                });

                if (!token && !isLocal) {
                   toast({ title: notifTexts.failedTitle, variant: 'destructive' });
                } else {
                   setNotificationsEnabled(true);
                   toast({ title: notifTexts.enabledTitle });
                }
            } else {
                await apiRequest(`/users/${primaryUserId}/notifications`, {
                    method: 'PATCH',
                    body: JSON.stringify({ notificationsEnabled: false })
                });
                setNotificationsEnabled(false);
                toast({ title: notifTexts.disabledTitle });
            }
            mutate(`/users/${primaryUserId}/notifications`);
        } catch (error) {
            console.error('Error toggling notifications:', error);
            toast({ title: notifTexts.errorTitle, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    if (!isMounted) return null;

    return (
        <div className="flex items-center justify-between p-4 border-b last:border-b-0">
            <div className="flex items-center gap-4 flex-1">
                {notificationsEnabled ? (
                    <Bell className="h-6 w-6 text-primary" />
                ) : (
                    <BellOff className="h-6 w-6 text-muted-foreground" />
                )}
                <div className="flex-1">
                    <p className="font-semibold">{t.profile.notificationsTitle}</p>
                    <p className="text-sm text-muted-foreground">
                        {loading ? 'Updating...' : (notificationsEnabled 
                            ? t.profile.notificationsEnabledDesc
                            : t.profile.notificationsDisabledDesc)}
                    </p>
                </div>
            </div>
            <Switch
                checked={notificationsEnabled}
                onCheckedChange={handleToggle}
                disabled={loading || !primaryUserId}
            />
        </div>
    );
}


