'use client';

import { Loader2 } from 'lucide-react';
import Script from 'next/script';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { FormProvider } from 'react-hook-form';
import { useSignup } from '@/hooks/use-signup';
import { SignupSidebar, StepRenderer } from '@/components/signup-stepper/signup-ui';

export default function SignupPage() {
  const {
    methods,
    currentStep,
    isSubmitting,
    isStepValid,
    handleNext,
    handleBack,
    setIsPhoneVerified,
    onSubmit
  } = useSignup();

  return (
    <div className="bg-gray-50 min-h-screen p-8 flex items-center justify-center">
      <Card className="w-full max-w-7xl h-[800px] flex p-0 overflow-hidden shadow-2xl">
        <SignupSidebar currentStep={currentStep} />

        <main className="w-3/4 p-8 flex flex-col">
          <FormProvider {...methods}>
            <form onSubmit={onSubmit} className="flex flex-col h-full">
              <header className="flex justify-end items-center mb-8">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link href="/login" className="text-primary hover:underline">
                    Sign In
                  </Link>
                </p>
              </header>

              <div className="flex-grow overflow-y-auto pr-4">
                <StepRenderer 
                  currentStep={currentStep} 
                  onVerified={() => setIsPhoneVerified(true)} 
                />
              </div>

              <footer className="flex justify-between items-center mt-8 pt-6 border-t">
                {currentStep > 1 ? (
                  <Button type="button" variant="outline" onClick={handleBack}>
                    Back
                  </Button>
                ) : <div />}
                <Button
                  type="button"
                  size="lg"
                  onClick={handleNext}
                  disabled={!isStepValid || isSubmitting}
                >
                  {isSubmitting && currentStep === 7 ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    currentStep === 7 ? 'Register Clinic' : 'Next'
                  )}
                </Button>
              </footer>
            </form>
          </FormProvider>
        </main>
      </Card>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
    </div>
  );
}
