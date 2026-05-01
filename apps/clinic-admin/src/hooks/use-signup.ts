'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api-client';
import { capitalizeWords, toUpperCase } from '@kloqo/shared-core';

// ── Schema Definitions ──────────────────────────────────────────────────────

const timeSlotSchema = z.object({
  open: z.string().min(1, 'Required'),
  close: z.string().min(1, 'Required'),
});

const hoursSchema = z.object({
  day: z.string(),
  timeSlots: z.array(timeSlotSchema),
  isClosed: z.boolean(),
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const fileSchema = z.instanceof(File)
  .nullable()
  .refine((file) => file !== null, "File is required.")
  .refine((file) => !file || file.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
  .refine(
    (file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.type),
    ".jpg, .jpeg, .png and .webp files are accepted."
  );

export const signupSchema = z.object({
  // Step 1
  clinicName: z.string()
    .trim()
    .min(3, { message: "Clinic name must be at least 3 characters." })
    .max(100, { message: "Clinic name must be 100 characters or less." })
    .regex(/^[a-zA-Z0-9\s&'\.-]*$/, { message: "Clinic name contains invalid characters." })
    .refine(name => !/\s{2,}/.test(name), { message: "Clinic name cannot have multiple consecutive spaces." })
    .refine(name => /[a-zA-Z0-9]/.test(name), { message: "Clinic name must contain at least one letter or number." })
    .transform(capitalizeWords),
  clinicType: z.enum(['Clinic', 'Pharmacy'], { required_error: "Please select if you are a Clinic or Pharmacy." }),
  billingCycle: z.enum(['monthly', 'annually']).default('monthly'),
  hardwareChoice: z.enum(['upfront', 'emi', 'byot']).optional(),
  hardwareDeployment: z.enum(['immediate', 'delayed']).optional(),
  calculatedMonthlyTotal: z.number().optional(),
  calculatedOneTimeTotal: z.number().optional(),
  plannedUpfrontTotal: z.number().optional(),
  numDoctors: z.coerce.number().min(1, "There must be at least one doctor."),
  clinicRegNumber: z.string().optional().transform(v => v ? toUpperCase(v) : v),
  latitude: z.coerce.number().min(-90, "Invalid latitude").max(90, "Invalid latitude"),
  longitude: z.coerce.number().min(-180, "Invalid longitude").max(180, "Invalid longitude"),
  walkInTokenAllotment: z.coerce.number().min(2, "Value must be at least 2.").max(10, "Value cannot exceed 10."),
  tokenDistribution: z.enum(['classic', 'advanced'], { required_error: "Please select a token distribution method." }),
  genderPreference: z.enum(['None', 'Men', 'Women'], { required_error: "Please select a gender preference." }),

  // Step 2
  ownerName: z.string()
    .min(2, { message: "Owner name must be at least 2 characters." })
    .regex(/^[a-zA-Z\s]*$/, { message: "Name should only contain alphabets and spaces." })
    .transform(capitalizeWords),
  designation: z.enum(['Doctor', 'Owner'], { required_error: "Please select a designation." }),
  mobileNumber: z.string().regex(/^\d{10}$/, "Please enter a valid 10-digit mobile number."),
  emailAddress: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, "Password must be at least 6 characters.")
    .refine((data) => /[A-Z]/.test(data), {
      message: "Password must contain at least one uppercase letter.",
    })
    .refine((data) => /[a-z]/.test(data), {
      message: "Password must contain at least one lowercase letter.",
    })
    .refine((data) => /[0-9]/.test(data), {
      message: "Password must contain at least one number.",
    })
    .refine((data) => /[^a-zA-Z0-9]/.test(data), {
      message: "Password must contain at least one special character.",
    }),

  // Step 3
  addressLine1: z.string().min(5, { message: "Address Line 1 is required." }).transform(capitalizeWords),
  addressLine2: z.string().optional().transform(v => v ? capitalizeWords(v) : v),
  city: z.string().min(2, { message: "City is required." }).transform(capitalizeWords),
  district: z.string().optional().transform(v => v ? capitalizeWords(v) : v),
  state: z.string().min(2, { message: "State is required." }).transform(capitalizeWords),
  pincode: z.string().regex(/^\d{6}$/, "A valid 6-digit pincode is required."),

  // Step 4
  hours: z.array(hoursSchema),
  avgPatientsPerDay: z.coerce.number().min(1, "Value must be at least 1."),

  // Step 5
  plan: z.string({ required_error: "Please select a plan." }),
  promoCode: z.string().optional(),
  paymentMethod: z.enum(['Card', 'UPI', 'NetBanking']).optional(),

  // Step 6
  logo: z.instanceof(File).nullable().optional(),
  license: fileSchema,
  receptionPhoto: z.instanceof(File).nullable().optional(),

  // Step 7
  agreeTerms: z.boolean().refine(val => val === true, { message: "You must agree to the terms." }),
  isAuthorized: z.boolean().refine(val => val === true, { message: "You must confirm authorization." }),
});

export type SignUpFormData = z.infer<typeof signupSchema>;

const defaultFormData: SignUpFormData = {
  clinicName: '',
  clinicType: 'Clinic',
  billingCycle: 'monthly',
  hardwareChoice: undefined,
  calculatedMonthlyTotal: 0,
  calculatedOneTimeTotal: 0,
  numDoctors: 1,
  clinicRegNumber: '',
  latitude: 0,
  longitude: 0,
  walkInTokenAllotment: 5,
  tokenDistribution: 'classic',
  genderPreference: 'None',
  ownerName: "",
  designation: 'Doctor',
  mobileNumber: "",
  emailAddress: "",
  password: "",
  addressLine1: '',
  addressLine2: '',
  city: '',
  district: '',
  state: '',
  pincode: '',
  hours: [
    { day: 'Monday', timeSlots: [{ open: '09:00', close: '17:00' }], isClosed: true },
    { day: 'Tuesday', timeSlots: [{ open: '09:00', close: '17:00' }], isClosed: true },
    { day: 'Wednesday', timeSlots: [{ open: '09:00', close: '17:00' }], isClosed: true },
    { day: 'Thursday', timeSlots: [{ open: '09:00', close: '17:00' }], isClosed: true },
    { day: 'Friday', timeSlots: [{ open: '09:00', close: '17:00' }], isClosed: true },
    { day: 'Saturday', timeSlots: [{ open: '09:00', close: '13:00' }], isClosed: true },
    { day: 'Sunday', timeSlots: [], isClosed: true },
  ],
  avgPatientsPerDay: 1,
  plan: 'The Complete Suite',
  promoCode: '',
  paymentMethod: undefined,
  logo: null as unknown as File,
  license: null as unknown as File,
  receptionPhoto: null as unknown as File,
  agreeTerms: false,
  isAuthorized: false,
};

const stepFields: (keyof SignUpFormData)[][] = [
  ['clinicName', 'clinicType', 'numDoctors'],
  ['ownerName', 'designation', 'mobileNumber', 'emailAddress', 'password'],
  ['addressLine1', 'city', 'state', 'pincode'],
  ['hours', 'avgPatientsPerDay'],
  ['plan'],
  ['license'],
  ['agreeTerms', 'isAuthorized'],
];

export function useSignup() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStepValid, setIsStepValid] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const methods = useForm<SignUpFormData>({
    resolver: zodResolver(signupSchema) as any,
    defaultValues: defaultFormData,
    mode: "onChange"
  });

  const { formState, watch, getValues, trigger } = methods;

  const isStepValidNow = useCallback(() => {
    const values = getValues();
    const currentStepFields = stepFields[currentStep - 1];

    for (const field of currentStepFields) {
      if (formState.errors[field]) return false;
      const value = values[field as keyof SignUpFormData];
      if (field === 'license' && !value) return false;
      if (typeof value === 'string' && !value.trim()) {
        if (field !== 'clinicRegNumber') return false;
      }
    }

    if (currentStep === 1 && values.latitude === 0) return false;
    if (currentStep === 2 && !isPhoneVerified) return false;
    if (currentStep === 4) {
      const atLeastOneDayOpen = values.hours.some(h => !h.isClosed);
      if (!atLeastOneDayOpen) return false;
    }
    if (currentStep === 7 && (!values.agreeTerms || !values.isAuthorized)) return false;

    return true;
  }, [currentStep, getValues, formState.errors, isPhoneVerified]);

  useEffect(() => {
    const subscription = watch(() => {
      setIsStepValid(isStepValidNow());
    });
    return () => subscription.unsubscribe();
  }, [watch, isStepValidNow]);

  useEffect(() => {
    setIsStepValid(isStepValidNow());
  }, [currentStep, isPhoneVerified, isStepValidNow]);

  const handleNext = async () => {
    const fieldsToValidate = stepFields[currentStep - 1] as (keyof SignUpFormData)[] | undefined;
    if (!fieldsToValidate) return;

    if (currentStep === 1) fieldsToValidate.push('latitude');

    const isValid = await trigger(fieldsToValidate);

    if (!isValid || !isStepValidNow()) {
      toast({
        variant: "destructive",
        title: "Incomplete Step",
        description: "Please fill out all required fields correctly before continuing.",
      });
      return;
    }

    if (currentStep < 7) {
      setCurrentStep(prev => prev + 1);
    } else {
      await methods.handleSubmit(onSubmit as any)();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(prev => prev - 1);
  };

  const uploadFileViaAPI = async (file: File | null, documentType: string): Promise<string | null> => {
    if (!file) return null;
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('userId', 'pending_registration'); 
    uploadFormData.append('documentType', documentType);

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${backendUrl}/storage/upload/public`, {
      method: 'POST',
      body: uploadFormData,
    });

    if (!response.ok) throw new Error(`Upload failed for ${documentType}`);
    const data = await response.json();
    return data.url;
  };

  const onSubmit = async (formData: SignUpFormData) => {
    setIsSubmitting(true);
    const dueToday = formData.calculatedOneTimeTotal || 0;
    let paymentDetails: any = null;

    if (dueToday > 0) {
      try {
        const order = await apiRequest('/payments/create-order', {
          method: 'POST',
          body: JSON.stringify({ amount: dueToday, receipt: `reg_${Date.now()}` }),
        }) as any;

        paymentDetails = await new Promise((resolve, reject) => {
          const options = {
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
            amount: order.amount, currency: order.currency, name: 'Kloqo',
            description: 'Clinic Registration Fee', order_id: order.id,
            handler: (response: any) => resolve({
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              signature: response.razorpay_signature,
            }),
            prefill: { name: formData.ownerName, email: formData.emailAddress, contact: formData.mobileNumber },
            theme: { color: '#3B82F6' },
            modal: { ondismiss: () => reject(new Error('Payment cancelled')) }
          };
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        });
      } catch (err: any) {
        setIsSubmitting(false);
        toast({ variant: "destructive", title: "Payment Failed", description: err.message });
        return;
      }
    }

    try {
      const [logoUrl, licenseUrl, receptionPhotoUrl] = await Promise.all([
        uploadFileViaAPI(formData.logo ?? null, 'logo'),
        uploadFileViaAPI(formData.license, 'license'),
        uploadFileViaAPI(formData.receptionPhoto ?? null, 'reception_photo'),
      ]);

      const fullAddress = [formData.addressLine1, formData.addressLine2, formData.city, formData.district, formData.state, formData.pincode].filter(Boolean).join(', ');

      const registrationPayload = {
        clinicData: {
          name: formData.clinicName, type: formData.clinicType, billingCycle: formData.billingCycle,
          hardwareChoice: formData.hardwareChoice, calculatedMonthlyTotal: formData.calculatedMonthlyTotal,
          calculatedOneTimeTotal: formData.calculatedOneTimeTotal, plannedUpfrontTotal: formData.plannedUpfrontTotal,
          address: fullAddress, addressDetails: {
            line1: formData.addressLine1, line2: formData.addressLine2, city: formData.city,
            district: formData.district, state: formData.state, pincode: formData.pincode,
          },
          operatingHours: formData.hours, plan: formData.plan, ownerEmail: formData.emailAddress,
          latitude: formData.latitude, longitude: formData.longitude,
          walkInTokenAllotment: formData.walkInTokenAllotment, tokenDistribution: formData.tokenDistribution,
          genderPreference: formData.genderPreference, numDoctors: formData.numDoctors,
          clinicRegNumber: formData.clinicRegNumber, logoUrl, licenseUrl, receptionPhotoUrl, paymentDetails,
        },
        adminData: {
          email: formData.emailAddress, password: formData.password, name: formData.ownerName,
          phone: `+91${formData.mobileNumber}`, designation: formData.designation,
        }
      };

      await apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(registrationPayload) });
      toast({ title: "Registration Successful!", description: "Your clinic has been registered for approval." });
      router.push('/login');
    } catch (err: any) {
      setIsSubmitting(false);
      toast({ variant: "destructive", title: "Registration Failed", description: err.message });
    }
  };

  return {
    methods,
    currentStep,
    isSubmitting,
    isStepValid,
    handleNext,
    handleBack,
    setIsPhoneVerified,
    onSubmit: methods.handleSubmit(onSubmit as any),
  };
}
