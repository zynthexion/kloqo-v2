'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Dialog, DialogContent, DialogClose, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Zap, Clock, Calendar, Users, Radio, Trash2 } from 'lucide-react';

import { PatientFormProps } from '@kloqo/shared';
import { usePatientForm } from './use-patient-form';
import { useBooking } from './use-booking';
import { PatientSelector } from './PatientSelector';
import { DetailsForm } from './DetailsForm';
import { getClinicTimeString } from '@kloqo/shared-core';

export function PatientForm({ selectedDoctor, appointmentType, renderLoadingOverlay }: PatientFormProps) {
    const { user } = useAuth();
    const { t } = useLanguage();
    const pt = t.patientForm as any;
    const pb = t.bookAppointment as any;

    const {
        form,
        isLoading: isPatientLoading,
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
    } = usePatientForm();

    const {
        isSubmitting,
        isEstimateModalOpen,
        setIsEstimateModalOpen,
        patientsAhead,
        walkInData,
        handleConfirmWalkIn,
        onSubmitBooking,
        clinicDetails
    } = useBooking(selectedDoctor, appointmentType);

    const isEditingPrimary = selectedPatientId === primaryPatient?.id && !addNewPatient;
    const disablePhoneEditing = isEditingPrimary && user?.phone !== undefined && form.getValues('phone') === user.phone.replace(/^\+91/, '');

    const checkWalkInEstimate = async (data: any) => {
        // Mock estimate flow. We just pass data directly and then immediately submit for now
        // To be extended later with pre-calculation.
        await onSubmitBooking(data, selectedPatientId || 'new');
    };

    return (
        <>
            {renderLoadingOverlay?.(isSubmitting)}
            <Form {...form}>
                <form onSubmit={form.handleSubmit(appointmentType === 'Walk-in' ? checkWalkInEstimate : (data) => onSubmitBooking(data, selectedPatientId || 'new'))} className="space-y-6">
                    <PatientSelector
                        displayedPatients={displayedPatients}
                        primaryPatient={primaryPatient}
                        isLoading={isPatientLoading}
                        isDeleteMode={isDeleteMode}
                        selectedPatientId={selectedPatientId || ''}
                        userPhone={user?.phone}
                        onPatientSelect={handlePatientSelect}
                        onAddNewClick={handleAddNewClick}
                        onDeleteClick={setPatientToUnlink}
                        onUnlink={handleUnlink}
                    />

                    {displayedPatients.length > 1 && (
                        <div className="flex justify-end">
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setIsDeleteMode(!isDeleteMode)}
                                className={`text-xs ${isDeleteMode ? 'text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Trash2 className="w-3 h-3 mr-1" />
                                {isDeleteMode ? 'Done Removing' : 'Remove Relative'}
                            </Button>
                        </div>
                    )}

                    {showDetailsForm && (
                        <div className="bg-slate-50 p-4 rounded-xl space-y-4 shadow-sm border border-slate-100">
                            <DetailsForm 
                                form={form} 
                                isEditingPrimary={isEditingPrimary} 
                                disablePhoneEditing={disablePhoneEditing} 
                            />
                        </div>
                    )}

                    <Button
                        type="submit"
                        disabled={isSubmitting || (showDetailsForm ? !form.formState.isValid : !selectedPatientId)}
                        className={`w-full h-14 text-base font-semibold rounded-2xl shadow-lg transition-all text-white
                            ${appointmentType === 'Walk-in' 
                                ? 'bg-[#ff6b6b] hover:bg-[#ff5252] shadow-[#ff6b6b]/20 hover:shadow-[#ff6b6b]/40' 
                                : 'bg-[#E3A33F] hover:bg-[#d69635] shadow-[#E3A33F]/20 hover:shadow-[#E3A33F]/40'}`}
                    >
                        {isSubmitting ? (
                            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> {pt.processing || 'Processing...'}</>
                        ) : appointmentType === 'Walk-in' ? (
                            <><Zap className="w-5 h-5 mr-2" /> {pt.getToken || 'Get Token'}</>
                        ) : (
                            <><Calendar className="w-5 h-5 mr-2" /> {pb.book || 'Book'}</>
                        )}
                    </Button>
                </form>
            </Form>

            <Dialog open={!!patientToUnlink} onOpenChange={(open) => !open && !isUnlinking && setPatientToUnlink(null)}>
                <DialogContent className="sm:max-w-md border-0 rounded-3xl shadow-2xl p-0 overflow-hidden bg-white/95 backdrop-blur-xl">
                    <div className="px-6 py-6 border-b border-slate-100 flex flex-col items-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                            <Trash2 className="w-8 h-8 text-red-600" />
                        </div>
                        <DialogTitle className="text-xl font-bold text-slate-800 text-center uppercase tracking-tight">
                            {pt.confirmUnlinkTitle || 'Confirm Unlink'}
                        </DialogTitle>
                    </div>
                    <div className="p-6">
                        <DialogDescription className="text-center text-slate-500 text-sm mb-6">
                            {pt.confirmUnlinkDesc?.replace('{name}', patientToUnlink?.name || '') || 'Are you sure?'}
                        </DialogDescription>
                    </div>
                    <DialogFooter className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex sm:justify-between flex-row">
                        <DialogClose asChild>
                            <Button variant="outline" className="w-[45%] h-12 rounded-xl font-bold text-slate-600 hover:text-slate-800" disabled={isUnlinking}>
                                {pt.cancel || 'Cancel'}
                            </Button>
                        </DialogClose>
                        <Button 
                            variant="destructive" 
                            className="w-[45%] h-12 rounded-xl shadow-lg shadow-red-500/20 font-bold"
                            onClick={handleUnlink}
                            disabled={isUnlinking}
                        >
                            {isUnlinking ? <Loader2 className="w-4 h-4 animate-spin" /> : (pt.confirm || 'Confirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEstimateModalOpen} onOpenChange={setIsEstimateModalOpen}>
                <DialogContent className="sm:max-w-md border-0 rounded-[2.5rem] shadow-2xl overflow-hidden bg-white/95 backdrop-blur-xl p-0">
                    <div className="px-6 py-8 flex flex-col items-center text-center">
                        <div className="w-20 h-20 bg-theme-blue/10 rounded-[2rem] flex items-center justify-center mb-6 shadow-xl shadow-theme-blue/5 border border-white relative mt-4">
                            <div className="absolute inset-0 bg-theme-blue/5 rounded-[2rem] animate-pulse"></div>
                            <Clock className="w-10 h-10 text-theme-blue relative z-10" />
                        </div>
                        <div className="space-y-3">
                            <h2 className="text-xl font-black text-slate-800 tracking-tight leading-none">
                                Confirm Walk-In
                            </h2>
                            <DialogDescription className="text-sm font-semibold text-slate-500 uppercase tracking-widest leading-relaxed">
                                Please review your token details below
                            </DialogDescription>
                        </div>
                        <div className="w-full mt-6 space-y-4">
                            <div className="bg-slate-50 p-4 rounded-xl w-full">
                                <h4 className="text-xs uppercase font-bold tracking-widest text-slate-400 mb-1">Estimated Wait</h4>
                                <p className="text-xl font-bold text-slate-800 flex items-center justify-center">
                                    <Clock className="w-5 h-5 mr-2 text-theme-blue" />
                                    {walkInData?.estimatedDetails?.estimatedTime 
                                        ? getClinicTimeString(walkInData.estimatedDetails.estimatedTime) 
                                        : 'Calculating...'}
                                </p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl w-full">
                                <h4 className="text-xs uppercase font-bold tracking-widest text-slate-400 mb-1">Queue Status</h4>
                                <p className="text-xl font-bold text-slate-800 flex items-center justify-center">
                                    <Users className="w-5 h-5 mr-2 text-amber-500" />
                                    {patientsAhead} patient{patientsAhead !== 1 ? 's' : ''} ahead
                                </p>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

export * from '@kloqo/shared';
