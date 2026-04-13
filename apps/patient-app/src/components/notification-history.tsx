'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetDescription
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Bell, Clock, Info, CheckCircle2, User, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { useUser } from '@/hooks/api/use-user';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/contexts/language-context';
import { apiRequest } from '@/lib/api-client';
import { useRouter } from 'next/navigation';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Sub-component for Swipeable Notification
const SwipeableNotification = ({ note, onMarkRead, onDelete, getIcon, router }: any) => {
    const [startX, setStartX] = useState<number | null>(null);
    const [currentX, setCurrentX] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const handleTouchStart = (e: React.TouchEvent) => { setStartX(e.touches[0].clientX); };
    const handleTouchMove = (e: React.TouchEvent) => {
        if (startX === null) return;
        const diff = e.touches[0].clientX - startX;
        if (diff < 0) setCurrentX(diff);
    };
    const handleTouchEnd = () => {
        if (currentX < -100) { setIsDeleting(true); onDelete(note.id); }
        else { setCurrentX(0); }
        setStartX(null);
    };

    const handleMouseDown = (e: React.MouseEvent) => { setIsDragging(true); setStartX(e.clientX); };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || startX === null) return;
        const diff = e.clientX - startX;
        if (diff < 0) setCurrentX(diff);
    };
    const handleMouseUp = () => {
        setIsDragging(false);
        if (currentX < -100) { setIsDeleting(true); onDelete(note.id); }
        else { setCurrentX(0); }
        setStartX(null);
    };

    const handleClick = () => {
        if (Math.abs(currentX) < 10) {
            onMarkRead();
            const notificationType = note.data?.type || '';
            const notificationTitle = note.title || '';
            if (
                notificationTitle.includes('Upcoming Appointment') ||
                notificationType === 'appointment_reminder' ||
                notificationType === 'token_called' ||
                notificationType === 'doctor_consultation_started'
            ) {
                router.push('/live-token');
            } else {
                router.push('/appointments');
            }
        }
    };

    if (isDeleting) return null;

    return (
        <div className="relative overflow-hidden mb-3 rounded-lg">
            <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-4 rounded-lg">
                <Trash2 className="text-white h-5 w-5" />
            </div>
            <div
                className={`relative bg-white flex gap-3 p-3 rounded-lg border transition-transform duration-200 ease-out select-none cursor-pointer hover:bg-gray-50 ${!note.read ? 'bg-blue-50 border-blue-100' : 'border-gray-100'}`}
                style={{ transform: `translateX(${currentX}px)`, opacity: Math.max(0, 1 + currentX / 200) }}
                onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
                onMouseLeave={() => isDragging && handleMouseUp()}
                onClick={handleClick}
            >
                <div className="mt-1 flex-shrink-0">{getIcon(note.data?.type || 'default')}</div>
                <div className="flex-1 space-y-1">
                    <h4 className={`text-sm ${!note.read ? 'font-semibold text-blue-900' : 'font-medium text-gray-900'}`}>{note.title}</h4>
                    <p className="text-xs text-gray-600 leading-snug">{note.body}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</p>
                </div>
                {!note.read && <div className="mt-2 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />}
            </div>
        </div>
    );
};

export function NotificationHistory() {
    const [open, setOpen] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const { user } = useUser();
    const { language } = useLanguage();
    const router = useRouter();

    const fetchNotifications = useCallback(async () => {
        if (!user?.uid) return;
        try {
            const res = await apiRequest(`/users/${user.uid}/notifications?type=list`);
            const list = res.notifications || [];
            setNotifications(list);
            setUnreadCount(list.filter((n: any) => !n.read).length);
        } catch (error) {
            console.error('[NotificationHistory] API Error:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.uid]);

    useEffect(() => {
        fetchNotifications();
        // Polling interval (2 minutes) as a replacement for onSnapshot
        const interval = setInterval(fetchNotifications, 120000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    const markAllAsRead = async () => {
        if (!user?.uid || notifications.length === 0) return;
        const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length === 0) return;

        try {
            await apiRequest(`/users/${user.uid}/notifications?action=markRead`, {
                method: 'PATCH',
                body: JSON.stringify({ ids: unreadIds })
            });
            // Optimistic update
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('[NotificationHistory] Failed to mark as read:', error);
        }
    };

    const handleConfirmClear = async () => {
        if (!user?.uid) return;
        setLoading(true);
        try {
            await apiRequest(`/users/${user.uid}/notifications?all=true`, { method: 'DELETE' });
            setNotifications([]);
            setUnreadCount(0);
        } catch (error) {
            console.error('[NotificationHistory] Failed to clear all:', error);
        } finally {
            setLoading(false);
            setShowClearConfirm(false);
        }
    };

    const handleDeleteOne = async (id: string) => {
        if (!user?.uid) return;
        try {
            await apiRequest(`/users/${user.uid}/notifications?id=${id}`, { method: 'DELETE' });
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error('[NotificationHistory] Failed to delete:', error);
        }
    };

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (isOpen) markAllAsRead();
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'appointment_confirmed': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
            case 'appointment_reminder': return <Clock className="h-5 w-5 text-blue-500" />;
            case 'appointment_cancelled': return <AlertCircle className="h-5 w-5 text-red-500" />;
            case 'token_called': return <User className="h-5 w-5 text-purple-500" />;
            case 'doctor_late': return <Clock className="h-5 w-5 text-orange-500" />;
            case 'appointment_rescheduled': return <RefreshCw className="h-5 w-5 text-yellow-500" />;
            default: return <Info className="h-5 w-5 text-gray-500" />;
        }
    };

    return (
        <Sheet open={open} onOpenChange={handleOpenChange}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-6 w-6" />
                    {unreadCount > 0 && <span className="absolute top-1 right-1 h-3 w-3 rounded-full bg-red-600 border-2 border-background" />}
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] sm:max-w-[400px] p-0 flex flex-col h-full bg-white">
                <SheetHeader className="p-4 border-b text-left">
                    <div className='flex justify-between items-center'>
                        <SheetTitle className="flex items-center gap-2">
                            <Bell className="h-5 w-5" />
                            {language === 'ml' ? 'അറിയിപ്പുകൾ' : 'Notifications'}
                        </SheetTitle>
                        {notifications.length > 0 && (
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-8 px-2" onClick={() => setShowClearConfirm(true)}>
                                {language === 'ml' ? 'എല്ലാം മായ്ക്കുക' : 'Clear All'}
                            </Button>
                        )}
                    </div>
                    <SheetDescription className="text-left text-xs text-muted-foreground">
                        {language === 'ml' ? 'നിങ്ങളുടെ സമീപകാല അപ്‌ഡേറ്റുകളും സന്ദേശങ്ങളും ഇവിടെ കാണാം' : 'View your recent updates and messages here'}
                    </SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        Array(3).fill(0).map((_, i) => (
                            <div key={i} className="flex gap-4 p-3 border rounded-lg mb-3">
                                <Skeleton className="h-10 w-10 rounded-full" /><div className="space-y-2 flex-1"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
                            </div>
                        ))
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground"><Bell className="h-12 w-12 mb-2 opacity-20" /><p>{language === 'ml' ? 'അറിയിപ്പുകളൊന്നും ഇല്ല' : 'No notifications yet'}</p></div>
                    ) : (
                        notifications.map((note) => (
                            <SwipeableNotification key={note.id} note={note} getIcon={getIcon} onMarkRead={() => { }} onDelete={handleDeleteOne} router={router} />
                        ))
                    )}
                </div>
            </SheetContent>

            <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{language === 'ml' ? 'എല്ലാ അറിയിപ്പുകളും മായ്ക്കണോ?' : 'Delete all notifications?'}</AlertDialogTitle>
                        <AlertDialogDescription>{language === 'ml' ? 'ഈ പ്രവർത്തനം പഴയപടിയാക്കാൻ കഴിയില്ല.' : 'This action cannot be undone.'}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{language === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmClear} className="bg-red-600"> {language === 'ml' ? 'മായ്ക്കുക' : 'Delete All'} </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Sheet>
    );
}

