'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useLoginFlow } from '@/hooks/use-login-flow';
import { BrandingSection } from '@/components/login/BrandingSection';
import { PhoneForm, OtpForm } from '@/components/login/LoginForms';
import { MagicLinkOverlay } from '@/components/magic-link-overlay';

/**
 * LoginPage Orchestrator
 * Modularized login flow featuring Phone OTP, reCAPTCHA security, and Magic Link support.
 */
function LoginContent() {
    const {
        step, setStep, phoneNumber, setPhoneNumber, otp, setOtp,
        isLoading, isMagicLoading, handleGenerateOtp, handleConfirmOtp,
        t, router, userLoading
    } = useLoginFlow();

    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50 font-body p-4 relative">
            {/* reCAPTCHA anchor (required by Firebase) */}
            <div id="recaptcha-container"></div>
            
            {isMagicLoading && <MagicLinkOverlay />}

            <div className="w-full max-w-md">
                <div className="relative rounded-2xl border-0 bg-white shadow-2xl p-8 sm:p-10">
                    <BrandingSection tagline={t.login.tagline} />

                    {step === 'phone' ? (
                        <PhoneForm
                            phoneNumber={phoneNumber}
                            setPhoneNumber={setPhoneNumber}
                            onSubmit={handleGenerateOtp}
                            isLoading={isLoading}
                            t={t}
                        />
                    ) : (
                        <OtpForm
                            otp={otp}
                            onOtpChange={(val, i) => {
                                const next = [...otp];
                                next[i] = val.slice(-1);
                                setOtp(next);
                            }}
                            onSubmit={handleConfirmOtp}
                            isLoading={isLoading}
                            phoneNumber={phoneNumber}
                            onResend={() => {}} // Hook handles confirmationResult automatically
                            onChangePhone={() => {
                                setStep('phone');
                                setOtp(new Array(6).fill(''));
                            }}
                            t={t}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
