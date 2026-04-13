import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, X, Trash2 } from 'lucide-react';
import type { Patient } from '@kloqo/shared';
import { useLanguage } from '@/contexts/language-context';

export function PatientSelector({
    displayedPatients,
    primaryPatient,
    isLoading,
    isDeleteMode,
    selectedPatientId,
    userPhone,
    onPatientSelect,
    onAddNewClick,
    onDeleteClick,
    onUnlink
}: {
    displayedPatients: Patient[];
    primaryPatient: Patient | null;
    isLoading: boolean;
    isDeleteMode: boolean;
    selectedPatientId: string;
    userPhone?: string;
    onPatientSelect: (id: string) => void;
    onAddNewClick: () => void;
    onDeleteClick: (patient: Patient) => void;
    onUnlink: () => void;
}) {
    const { t } = useLanguage();
    const pt = t.patientForm as any;

    return (
        <div>
            <h2 className="text-lg font-semibold mb-4">{pt.whoIsThisAppointmentFor || 'Who is this appointment for?'}</h2>
            {isLoading && displayedPatients.length === 0 ? (
                <div className="flex items-center gap-4 overflow-x-auto pb-2">
                    <Skeleton className="w-16 h-20 flex-shrink-0" />
                    <Skeleton className="w-16 h-20 flex-shrink-0" />
                    <Skeleton className="w-16 h-20 flex-shrink-0" />
                </div>
            ) : (
                <div className="flex items-center gap-4 overflow-x-auto pb-2">
                    {displayedPatients.map(p => {
                        const isLoggedInUser = p.phone === userPhone;
                        const isRelative = !isLoggedInUser && p.id !== primaryPatient?.id;

                        return (
                            <div
                                key={p.id}
                                className="flex flex-col items-center gap-2 text-center flex-shrink-0 cursor-pointer relative"
                                onClick={() => {
                                    if (isDeleteMode) {
                                        if (isRelative) onDeleteClick(p);
                                    } else {
                                        onPatientSelect(p.id);
                                    }
                                }}
                            >
                                {isDeleteMode && isRelative && (
                                    <div className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 z-10 shadow-sm transition-transform hover:scale-110">
                                        <X className="w-3 h-3 text-white" />
                                    </div>
                                )}
                                
                                <div className={`relative rounded-full p-1 transition-all ${
                                    selectedPatientId === p.id && !isDeleteMode
                                        ? 'ring-2 ring-primary bg-primary/10 scale-105'
                                        : 'hover:bg-slate-50'
                                    } ${isDeleteMode && isRelative ? 'animate-pulse' : ''} ${isDeleteMode && !isRelative ? 'opacity-50 grayscale' : ''}`}
                                >
                                    <Avatar className="w-16 h-16 border-2 border-transparent">
                                        <AvatarFallback className="bg-slate-100 text-slate-600 font-medium text-lg">
                                            {p.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                </div>
                                <span className="text-sm font-medium w-full truncate max-w-[5rem]">
                                    {isLoggedInUser ? (pt.myself || 'Myself') : p.name}
                                </span>
                            </div>
                        );
                    })}
                    
                    {!isDeleteMode && displayedPatients.length < 5 && (
                        <div
                            className="flex flex-col items-center gap-2 text-center flex-shrink-0 cursor-pointer"
                            onClick={onAddNewClick}
                        >
                            <div className={`relative rounded-full p-1 transition-all ${
                                selectedPatientId === 'new'
                                    ? 'ring-2 ring-primary bg-primary/10 scale-105'
                                    : 'hover:bg-slate-50'
                            }`}>
                                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center border-2 border-transparent">
                                    <Plus className="w-6 h-6 text-slate-600" />
                                </div>
                            </div>
                            <span className="text-sm font-medium text-slate-600 w-full truncate max-w-[5rem]">
                                {pt.addRelative || 'Add Relative'}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
