'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth as useV2Auth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/language-context';
import { apiRequest } from '@/lib/api-client';

/**
 * useLoginFlow (V2 - Firebase Free)
 * Encapsulates the multi-step phone + OTP authentication logic 
 * using the V2 Backend API exclusively.
 */
export function useLoginFlow() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const { t } = useLanguage();
    const { user, loading: userLoading, checkAuth } = useV2Auth();

    // 1. Core States
    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [phoneNumber, setPhoneNumber] = useState('+91');
    const [otp, setOtp] = useState(new Array(6).fill(''));
    const [isLoading, setIsLoading] = useState(false);
    const [isMagicLoading, setIsMagicLoading] = useState(false);

    const otpInputRefs = useRef<HTMLInputElement[]>([]);
    const magicLoginAttemptedRef = useRef(false);

    // 2. Web OTP API Integration (Optional but nice)
    useEffect(() => {
        if (step === 'otp' && 'OTPCredential' in window) {
            const abortController = new AbortController();
            navigator.credentials.get({
                otp: { transport: ['sms'] },
                signal: abortController.signal,
            } as any).then((cred: any) => {
                if (cred?.code?.length === 6) {
                    setOtp(cred.code.split(''));
                    toast({ title: 'OTP Auto-detected!' });
                }
            }).catch(() => {});
            return () => abortController.abort();
        }
    }, [step, toast]);

    // 3. Magic Link Handler (V2 REST Version)
    useEffect(() => {
        const magicToken = searchParams.get('magicToken') || searchParams.get('token');
        if (magicToken && !magicLoginAttemptedRef.current) {
            magicLoginAttemptedRef.current = true;
            
            const handleMagicLogin = async () => {
                setIsMagicLoading(true);
                try {
                    const res = await apiRequest('/auth/magic-login', {
                        method: 'POST',
                        body: JSON.stringify({ magicToken })
                    });

                    if (res.token) {
                        localStorage.setItem('token', res.token);
                        await checkAuth();
                    }

                    const target = searchParams.get('redirect') || res.redirectPath || '/live-token';
                    router.push(target);
                } catch (e) {
                    toast({ variant: 'destructive', title: 'Login Failed', description: 'Link expired or invalid.' });
                } finally {
                    setIsMagicLoading(false);
                }
            };
            
            handleMagicLogin();
        }
    }, [searchParams, checkAuth, router, toast]);

    // 4. Auth Success Redirection
    useEffect(() => {
        if (!userLoading && user?.patientId) {
            const redirectUrl = searchParams.get('redirect') || '/live-token';
            localStorage.removeItem('redirectAfterLogin');
            if (window.location.pathname === '/login') {
                router.replace(redirectUrl);
            }
        }
    }, [user, userLoading, router, searchParams]);

    // 5. Action Handlers (V2 API)
    const handleGenerateOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        const fullPhone = phoneNumber.trim().replace(/\s/g, '');
        if (fullPhone.length <= 3) {
            toast({ variant: 'destructive', title: t.login.phoneRequired });
            return;
        }
        setIsLoading(true);
        try {
            await apiRequest('/auth/send-otp', {
                method: 'POST',
                body: JSON.stringify({ phone: fullPhone })
            });
            setStep('otp');
            toast({ title: 'OTP Sent', description: 'Please check your phone.' });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Failed to send OTP', description: err.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const finalOtp = otp.join('');
        const fullPhone = phoneNumber.trim().replace(/\s/g, '');

        if (finalOtp.length !== 6) {
            toast({ variant: 'destructive', title: 'Invalid OTP' });
            setIsLoading(false);
            return;
        }

        try {
            // Verify OTP via V2 Backend (which now returns { user, token })
            const res = await apiRequest('/auth/verify-otp', {
                method: 'POST',
                body: JSON.stringify({ phone: fullPhone, otp: finalOtp })
            });

            if (res.token) {
                localStorage.setItem('token', res.token);
                await checkAuth();
                const target = searchParams.get('redirect') || '/live-token';
                router.push(target);
            } else {
                 throw new Error('Failed to establish session.');
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Verification Failed', description: err.message });
        } finally {
            setIsLoading(false);
        }
    };

    return {
        step, setStep, phoneNumber, setPhoneNumber, otp, setOtp,
        isLoading, isMagicLoading, handleGenerateOtp, handleConfirmOtp,
        otpInputRefs, t, router, userLoading
    };
}
