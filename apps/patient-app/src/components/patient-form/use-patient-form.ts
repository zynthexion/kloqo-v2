import { useState, useCallback, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/language-context';
import { getPatientListFromCache, savePatientListToCache } from '@/lib/patient-cache';
import type { Patient } from '@kloqo/shared';
import { FormValues, createFormSchema } from './types';

export function usePatientForm() {
    const { user } = useAuth();
    const { toast } = useToast();
    const { t } = useLanguage();

    const pt = t.patientForm as any;

    const [isLoading, setIsLoading] = useState(false);
    const [addNewPatient, setAddNewPatient] = useState(false);
    
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [patientToUnlink, setPatientToUnlink] = useState<Patient | null>(null);
    const [isUnlinking, setIsUnlinking] = useState(false);
    const [primaryPatient, setPrimaryPatient] = useState<Patient | null>(null);
    const [relatedPatients, setRelatedPatients] = useState<Patient[]>([]);
    
    const lastResetIdRef = useRef<string | null>(null);

    const schema = createFormSchema(t);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema as any),
        mode: 'onBlur',
        defaultValues: {
            name: '',
            age: undefined,
            sex: undefined,
            place: '',
            phone: user?.phone || '',
            selectedPatient: ''
        },
    });

    const normalizeSex = useCallback((val: any, preferredGender?: string): "Male" | "Female" | "Other" | undefined => {
        if (!val) {
            if (preferredGender === 'Men') return 'Male';
            if (preferredGender === 'Women') return 'Female';
            return undefined;
        }
        const s = val.toString().toLowerCase();
        if (s === 'male' || s === 'm') return 'Male';
        if (s === 'female' || s === 'f') return 'Female';
        if (s === 'other' || s === 'o') return 'Other';

        if (preferredGender === 'Men') return 'Male';
        if (preferredGender === 'Women') return 'Female';
        return undefined;
    }, []);

    const fetchPatientData = useCallback(async () => {
        if (!user?.phone) {
            setIsLoading(false);
            return;
        }

        const cachedData = getPatientListFromCache(user.phone);
        if (cachedData) {
            if (!cachedData.primary) {
                setPrimaryPatient(null);
                setRelatedPatients([]);
                setAddNewPatient(true);
                form.reset({
                    selectedPatient: 'new',
                    name: '',
                    age: undefined,
                    sex: normalizeSex(undefined),
                    place: '',
                    phone: user.phone,
                });
            } else {
                const primaryData = { ...cachedData.primary, isPrimary: true } as Patient;
                setPrimaryPatient(primaryData);
                setRelatedPatients(Array.isArray(cachedData.relatives) ? cachedData.relatives : []);

                if (!form.getValues('selectedPatient')) {
                    form.reset({
                        selectedPatient: primaryData.id,
                        name: primaryData.name || '',
                        age: primaryData.age === 0 ? undefined : (primaryData.age ?? undefined),
                        sex: normalizeSex(primaryData.sex || (primaryData as any).gender),
                        place: primaryData.place || '',
                        phone: primaryData.communicationPhone || primaryData.phone || user.phone || '',
                    });
                    setAddNewPatient(false);
                }
            }
        }

        setIsLoading(true);
        try {
            // Call the V2 backend profile endpoint using unified apiRequest
            const data = await apiRequest(`/patients/profile?phone=${encodeURIComponent(user.phone)}`);
            const { primary, relatives } = data;
            savePatientListToCache(user.phone, primary, relatives);

            if (!primary) {
                // Return no primary record, but keep related if any (though unlikely for a new user)
                setPrimaryPatient(null);
                setRelatedPatients(Array.isArray(relatives) ? relatives : []);
                setAddNewPatient(true);
                return;
            }

            const primaryData = { ...primary, isPrimary: true } as Patient;
            setPrimaryPatient(primaryData);
            setRelatedPatients(Array.isArray(relatives) ? relatives : []);

            // Only override if default or 'new' not explicitly set by user or we haven't selected anything yet
            if (!form.getValues('selectedPatient') || form.getValues('selectedPatient') === '') {
                form.reset({
                    selectedPatient: primaryData.id,
                    name: primaryData.name || '',
                    age: primaryData.age === 0 ? undefined : (primaryData.age ?? undefined),
                    sex: normalizeSex(primaryData.sex || (primaryData as any).gender),
                    place: primaryData.place || '',
                    phone: primaryData.communicationPhone || primaryData.phone || user.phone || '',
                });
            }
        } catch (error) {
            console.error("Error fetching patient profile:", error);
            toast({ variant: "destructive", title: t.common.error, description: pt.patientCreationFailed });
        } finally {
            setIsLoading(false);
        }
    }, [user?.phone, form, t, toast, normalizeSex]);

    useEffect(() => {
        if (user?.phone) {
            fetchPatientData();
        }
    }, [user?.phone, fetchPatientData]);

    const displayedPatients = primaryPatient 
        ? [primaryPatient, ...relatedPatients] 
        : [{ id: 'new', name: user?.phone || 'Myself', phone: user?.phone || '', isPrimary: true } as any, ...relatedPatients];
    
    const selectedPatientId = form.watch('selectedPatient');
    const showDetailsForm = addNewPatient || !!selectedPatientId;

    useEffect(() => {
        const currentId = addNewPatient ? 'new' : selectedPatientId;
        if (!currentId || currentId === lastResetIdRef.current) return;

        if (currentId === 'new') {
            form.reset({
                selectedPatient: 'new',
                name: '',
                age: undefined,
                sex: normalizeSex(undefined),
                place: '',
                phone: primaryPatient ? '' : user?.phone || '', 
            }, {
                keepDefaultValues: false,
                keepValues: false,
            });
            lastResetIdRef.current = 'new';
        } else {
            const patient = displayedPatients.find(p => p.id === currentId);
            if (patient) {
                let displayPhone = '';
                const patientPhone = patient.phone || '';
                if (patientPhone) {
                    const digitsOnly = patientPhone.replace(/^\+91/, '');
                    displayPhone = digitsOnly;
                }

                form.reset({
                    selectedPatient: patient.id,
                    name: patient.name || '',
                    age: patient.age === 0 ? undefined : (patient.age ?? undefined),
                    sex: normalizeSex(patient.sex || (patient as any).gender),
                    place: patient.place || '',
                    phone: displayPhone || (patient.isPrimary ? (user?.phone?.replace(/^\+91/, '') || '') : ''),
                });
                lastResetIdRef.current = currentId;
            }
        }
    }, [addNewPatient, selectedPatientId, displayedPatients, form, user?.phone, primaryPatient, normalizeSex]);

    const handleUnlink = async () => {
        if (!patientToUnlink || !primaryPatient?.id) return;

        setIsUnlinking(true);
        try {
            await apiRequest(`/patients/${patientToUnlink.id}/unlink`, {
                method: 'POST',
                body: JSON.stringify({ primaryId: primaryPatient.id })
            });

            toast({
                title: t.messages.success,
                description: pt.confirmUnlinkDesc?.replace('{name}', patientToUnlink.name) || 'Relative removed',
            });

            fetchPatientData();
            setPatientToUnlink(null);
            if (selectedPatientId === patientToUnlink.id) {
                form.setValue('selectedPatient', primaryPatient.id);
            }
        } catch (error) {
            console.error('Error unlinking relative:', error);
            toast({
                variant: 'destructive',
                title: t.common.error,
                description: 'Failed to remove relative.',
            });
        } finally {
            setIsUnlinking(false);
        }
    };

    const handlePatientSelect = (patientId: string) => {
        setAddNewPatient(false);
        form.setValue('selectedPatient', patientId);
    }

    const handleAddNewClick = () => {
        form.reset({
            selectedPatient: 'new',
            name: '',
            age: undefined,
            sex: normalizeSex(undefined),
            place: '',
            phone: primaryPatient ? '' : user?.phone || '', 
        }, {
            keepDefaultValues: false,
            keepValues: false,
        });
        setAddNewPatient(true);
    }

    return {
        form,
        isLoading,
        addNewPatient,
        displayedPatients,
        primaryPatient,
        showDetailsForm,
        selectedPatientId,
        isDeleteMode,
        setIsDeleteMode,
        patientToUnlink,
        setPatientToUnlink,
        isUnlinking,
        handleUnlink,
        handlePatientSelect,
        handleAddNewClick
    };
}
