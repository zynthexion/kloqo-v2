'use client';
import { PatientForm } from '@/components/patient-form';

import type { Doctor } from '@kloqo/shared';

export function ConsultationForm({ selectedDoctor }: { selectedDoctor: Doctor }) {
    return <PatientForm selectedDoctor={selectedDoctor} appointmentType="Walk-in" />;
}
