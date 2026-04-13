'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { LottieAnimation } from '@/components/lottie-animation';
import loadingDotsAnimation from '@/lib/animations/loading-dots.json';

interface PhoneFormProps {
    phoneNumber: string;
    setPhoneNumber: (val: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    isLoading: boolean;
    t: any;
}

export function PhoneForm({ phoneNumber, setPhoneNumber, onSubmit, isLoading, t }: PhoneFormProps) {
    return (
        <form onSubmit={onSubmit} className="w-full space-y-5 animate-in fade-in-50 duration-500">
            <div className="space-y-3">
                <h2 className="font-semibold text-lg text-foreground text-center">{t.login.enterPhone}</h2>
                <Input
                    type="tel"
                    placeholder="+91 98765 43210"
                    required
                    className="text-center h-14 text-lg rounded-lg border-2 focus-visible:border-primary"
                    disabled={isLoading}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.startsWith('+91') ? e.target.value : '+91')}
                />
            </div>
            <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-14 text-base font-semibold rounded-lg shadow-lg"
                disabled={isLoading}
            >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : t.login.generateOTP}
                {isLoading && 'Sending...'}
            </Button>
        </form>
    );
}

interface OtpFormProps {
    otp: string[];
    onOtpChange: (val: string, index: number) => void;
    onSubmit: (e: React.FormEvent) => void;
    isLoading: boolean;
    phoneNumber: string;
    onResend: () => void;
    onChangePhone: () => void;
    t: any;
}

import { useRef, useEffect } from 'react';

export function OtpForm({ otp, onOtpChange, onSubmit, isLoading, phoneNumber, onResend, onChangePhone, t }: OtpFormProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (inputRefs.current[0]) {
            inputRefs.current[0].focus();
        }
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleChange = (val: string, index: number) => {
        onOtpChange(val, index);
        if (val && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    return (
        <form onSubmit={onSubmit} className="w-full space-y-6 animate-in fade-in-50 duration-300">
            <div className="space-y-4 text-center">
                <h2 className="font-semibold text-lg text-foreground">{t.login.enterOTP}</h2>
                <p className="text-sm text-muted-foreground">{t.login.otpSent} {phoneNumber}</p>
                <div className="grid grid-cols-6 gap-2 pt-2 justify-center">
                    {otp.map((digit, i) => (
                        <Input
                            key={i}
                            ref={(el) => { inputRefs.current[i] = el; }}
                            type="tel"
                            maxLength={1}
                            value={digit}
                            autoComplete="one-time-code"
                            className="w-12 h-14 text-center text-2xl font-bold rounded-lg border-2"
                            onKeyDown={(e) => handleKeyDown(e, i)}
                            onChange={(e) => handleChange(e.target.value, i)}
                        />
                    ))}
                </div>
                <div className="text-sm text-muted-foreground pt-4 flex flex-col gap-2">
                    <button type="button" onClick={onResend} className="font-semibold text-primary">{t.login.resend}</button>
                    <button type="button" onClick={onChangePhone} className="font-semibold text-primary">{t.login.changePhone}</button>
                </div>
            </div>
            {isLoading ? (
                <div className="flex justify-center h-14">
                    <LottieAnimation animationData={loadingDotsAnimation} size={56} autoplay loop />
                </div>
            ) : (
                <Button type="submit" className="w-full h-14 text-base font-semibold shadow-lg" disabled={otp.join('').length !== 6}>
                    {t.login.confirmOTP}
                </Button>
            )}
        </form>
    );
}
