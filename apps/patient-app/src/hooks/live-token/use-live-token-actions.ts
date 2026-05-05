'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { registerFCMToken } from '@/lib/register-fcm-token';
import type { Appointment } from '@kloqo/shared';
import { useAuth } from '@/contexts/AuthContext';

export function useLiveTokenActions(yourAppointment: Appointment | null) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [isConfirmingInline, setIsConfirmingInline] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [inlineError, setInlineError] = useState<string | null>(null);
 
    const handleConfirmArrivalInline = async () => {
        if (!yourAppointment) return;
        setIsConfirmingInline(true);
        setInlineError(null);
        try {
            await apiRequest(`/appointments/${yourAppointment.id}/confirm`, {
                method: 'POST'
            });
 
            // Trigger notification permission (Satisfies iOS user-interaction rule)
            const token = localStorage.getItem('token');
            if (token && user?.id) registerFCMToken(token, user.id);

            toast({ title: 'Arrival Confirmed' });
        } catch (e: any) {
            setInlineError(e.message);
            toast({ variant: 'destructive', title: 'Confirmation Error', description: e.message });
        } finally {
            setIsConfirmingInline(false);
        }
    };

    const handleCancelAppointment = async () => {
        if (!yourAppointment) return;
        setIsCancelling(true);
        try {
            await apiRequest(`/appointments/${yourAppointment.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'Cancelled' })
            });
            toast({ title: 'Appointment Cancelled' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Cancellation Error', description: e.message });
        } finally {
            setIsCancelling(false);
        }
    };

    return {
        isConfirmingInline,
        isCancelling,
        inlineError,
        handleConfirmArrivalInline,
        handleCancelAppointment
    };
}
