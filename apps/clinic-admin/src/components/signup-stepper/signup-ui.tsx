'use client';

import { StepperNav } from './stepper-nav';
import { Step1ClinicProfile } from './step-1-clinic-profile';
import { Step2OwnerInfo } from './step-2-owner-info';
import { Step3ClinicLocation } from './step-3-clinic-location';
import { Step4Hours } from './step-4-hours';
import { Step5Pricing } from './step-5-pricing';
import { Step6Uploads } from './step-6-uploads';
import { Step7Confirm } from './step-7-confirm';
import Link from 'next/link';
import Image from 'next/image';

const steps = [
  { number: 1, title: 'Clinic Profile', description: 'Basic clinic details' },
  { number: 2, title: 'Owner Information', description: 'Primary contact details' },
  { number: 3, title: 'Clinic Location', description: 'Help patients find you' },
  { number: 4, title: 'Operation Details', description: 'Set your working hours' },
  { number: 5, title: 'Pricing & Payment', description: 'Choose your plan' },
  { number: 6, title: 'Uploads', description: 'Add trust and branding' },
  { number: 7, title: 'Confirmation', description: 'Review and finish' },
];

export function SignupSidebar({ currentStep }: { currentStep: number }) {
  return (
    <aside className="w-1/4 bg-slate-100 p-8 flex flex-col justify-between">
      <div className="flex-grow flex flex-col overflow-hidden">
        <Link href="/" className="flex items-center gap-2 mb-12 flex-shrink-0">
          <Image 
            src="https://firebasestorage.googleapis.com/v0/b/kloqo-nurse-dup-43384903-8d386.firebasestorage.app/o/Kloqo_Logo_full%20(2).webp?alt=media&token=19a163b9-3243-402c-929e-cb99ddcae05c" 
            alt="Kloqo Logo" width={120} height={30} unoptimized={true} 
          />
        </Link>
        <div className="flex-grow overflow-y-auto pr-4">
          <StepperNav steps={steps} currentStep={currentStep} />
        </div>
      </div>
    </aside>
  );
}

export function StepRenderer({ currentStep, onVerified }: { currentStep: number; onVerified: () => void }) {
  switch (currentStep) {
    case 1: return <Step1ClinicProfile />;
    case 2: return <Step2OwnerInfo onVerified={onVerified} />;
    case 3: return <Step3ClinicLocation />;
    case 4: return <Step4Hours />;
    case 5: return <Step5Pricing />;
    case 6: return <Step6Uploads />;
    case 7: return <Step7Confirm />;
    default: return null;
  }
}
