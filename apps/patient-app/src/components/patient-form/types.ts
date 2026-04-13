import * as z from 'zod';
import { Doctor, Patient } from '@kloqo/shared';
import { capitalizeWords } from '@kloqo/shared-core';

export const createFormSchema = (t: any) => z.object({
    selectedPatient: z.string().optional(),
    name: z.string()
        .min(3, { message: t.patientForm.nameMinLength })
        .regex(/^[a-zA-Z\s]+$/, { message: t.patientForm.nameAlphabetsOnly })
        .refine(name => !name.startsWith(' ') && !name.endsWith(' ') && !name.includes('  '), {
            message: t.patientForm.nameSpaces
        })
        .transform(capitalizeWords),
    age: z.preprocess(
        (val) => {
            if (val === "" || val === undefined || val === null) return undefined;
            const num = parseInt(val.toString(), 10);
            if (isNaN(num)) return undefined;
            return num;
        },
        z.number({
            required_error: t.patientForm.ageRequired,
            invalid_type_error: t.patientForm.ageRequired
        })
            .min(1, { message: t.patientForm.agePositive })
            .max(120, { message: t.patientForm.ageMax })
    ),
    sex: z.enum(['Male', 'Female', 'Other'], { required_error: t.patientForm.genderRequired }),
    place: z.string().min(2, { message: t.patientForm.placeRequired }).transform(capitalizeWords),
    phone: z.string()
        .optional()
        .refine((val) => {
            if (!val || val.length === 0) return true;
            // Strip +91 prefix if present, then check for exactly 10 digits
            const cleaned = val.replace(/^\+91/, '');
            return /^\d{10}$/.test(cleaned);
        }, {
            message: t.patientForm.phoneFormat
        }),
});

export type FormValues = z.infer<ReturnType<typeof createFormSchema>>;

export interface PatientFormProps {
    selectedDoctor: Doctor;
    appointmentType: 'Walk-in' | 'Online';
    renderLoadingOverlay?: (isLoading: boolean) => React.ReactNode;
}
