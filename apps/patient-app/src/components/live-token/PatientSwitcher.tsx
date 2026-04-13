'use client';

import { useRouter } from 'next/navigation';
import { useLiveToken } from '@/contexts/LiveTokenContext';
import { getReportByTimeLabel } from '@/lib/utils';

export const PatientSwitcher = () => {
    const {
        uniquePatientAppointments,
        yourAppointment,
        language,
        clinics,
        doctors,
        t
    } = useLiveToken();
    const router = useRouter();

    if (uniquePatientAppointments.length <= 1) return null;

    const patientMenuLabel = language === 'ml' ? 'രോഗിയെ തിരഞ്ഞെടുക്കുക' : 'Choose patient';

    return (
        <div className="w-full max-w-sm">
            <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">{patientMenuLabel}</p>
                <p className="text-xs text-muted-foreground">
                    {uniquePatientAppointments.length} {language === 'ml' ? 'രോഗികൾ' : 'patients'}
                </p>
            </div>
            <div className="flex flex-wrap gap-2">
                {uniquePatientAppointments.map(appt => {
                    const isSelected = yourAppointment?.id === appt.id;
                    const ageText = appt.age ? `${appt.age}` : '';
                    const placeText = appt.place ? appt.place : '';
                    
                    return (
                        <button
                            key={appt.id}
                            onClick={() => router.push(`/live-token/${appt.id}`)}
                            className={`flex-1 min-w-[120px] rounded-xl border px-3 py-2 text-left transition-colors ${isSelected
                                ? 'border-green-400 bg-green-50'
                                : 'border-border bg-background hover:border-primary/70'
                                }`}
                        >
                            <p className="text-sm font-semibold truncate">{appt.patientName}</p>
                            <p className="text-xs text-muted-foreground">
                                {(() => {
                                    const apptClinic = clinics.find(c => c.id === appt.clinicId);
                                    const isClassic = apptClinic?.tokenDistribution === 'classic';

                                    if (isClassic) {
                                        return appt.classicTokenNumber ? `#${appt.classicTokenNumber.toString().padStart(3, '0')}` : "--";
                                    }
                                    return appt.tokenNumber;
                                })()} • {(() => {
                                    const apptDoctor = doctors.find(d => d.name === appt.doctor);
                                    return getReportByTimeLabel(appt, apptDoctor);
                                })()}
                            </p>
                            {(ageText || placeText) && (
                                <p className="text-xs text-muted-foreground truncate">
                                    {ageText && `${ageText} ${language === 'ml' ? 'വയസ്സ്' : 'yrs'}`} {placeText && `• ${placeText}`}
                                </p>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
