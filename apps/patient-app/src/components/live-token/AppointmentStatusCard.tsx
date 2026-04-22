'use client';

import { useState, useMemo } from 'react';
import { Hourglass, UserCheck, AlertCircle, Info, Clock, Calendar, Star, Users, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useLiveToken } from '@/contexts/LiveTokenContext';
import { getLocalizedDepartmentName } from '@/lib/department-utils';

export const AppointmentStatusCard = () => {
    const {
        yourAppointment,
        t,
        language,
        formattedDate,
        isAppointmentToday,
        isConfirmedAppointment,
        isPendingAppointment,
        isSkippedAppointment,
        isReportingPastDue,
        reportingCountdownLabel,
        isDoctorIn,
        handleConfirmArrivalInline,
    } = useLiveToken() as any;

    if (!yourAppointment) return null;

    const isPending = yourAppointment.status === 'Pending';

    const renderArrivalStatus = () => {
        if (!isAppointmentToday) return null;

        if (isConfirmedAppointment) {
            return (
                <div className="flex flex-col items-center justify-center pt-2 space-y-1">
                    <div className="flex items-center gap-2 text-primary">
                        <UserCheck className="w-5 h-5" />
                        <span className="text-sm font-bold">
                            {language === 'ml' ? 'നിങ്ങൾ റിപ്പോർട്ട് ചെയ്തു' : 'Arrived & Verified'}
                        </span>
                    </div>
                </div>
            );
        }

        if (isPending || isSkippedAppointment) {
            const bgClass = isReportingPastDue ? 'bg-red-50 text-red-700' : 'bg-primary/5 text-primary';
            const reportingLabel = language === 'ml' ? 'റിപ്പോർട്ട് ചെയ്യേണ്ട സമയം' : 'Report By';
            
            return (
                <div className="w-full text-center pt-4">
                    <div className={`${bgClass} rounded-2xl px-4 py-3 flex flex-col items-center justify-center`}>
                        <div className="flex items-center gap-2 mb-1">
                            <Hourglass className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{reportingLabel}</span>
                        </div>
                        <span className="font-black text-xl">{reportingCountdownLabel}</span>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <Card className="border-none shadow-sm bg-card/60 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-8">
                <div className="flex flex-col items-center space-y-6">
                    {/* Identity Header */}
                    <div className="text-center space-y-1">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                            {yourAppointment.doctorName}
                        </p>
                        <h2 className="text-xl font-bold text-foreground">
                            {yourAppointment.patientName}
                        </h2>
                    </div>

                    {/* Alphanumeric Identity Tag */}
                    <div className="relative group">
                        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-75 group-hover:scale-100 transition-transform duration-500"></div>
                        <div className="relative bg-background border-2 border-primary/10 rounded-3xl px-8 py-4 flex flex-col items-center shadow-inner">
                            <span className="text-[10px] font-bold text-primary tracking-widest mb-1 opacity-60">MY TOKEN</span>
                            <span className="text-6xl font-black text-primary tracking-tighter">
                                {yourAppointment.tokenNumber}
                            </span>
                        </div>

                        {renderArrivalStatus()}
                        
                        {(isPending || isSkippedAppointment) && isAppointmentToday && (useLiveToken() as any).totalDelayMinutes > 5 && (
                            <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
                                <Clock className="w-5 h-5 text-amber-600 mt-0.5" />
                                <div>
                                    <p className="font-bold text-amber-800 text-sm">
                                        {language === 'ml' ? 'ഡോക്ടർ അല്പം വൈകുന്നു' : 'Doctor is Running Behind'}
                                    </p>
                                    <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                                        {language === 'ml' 
                                            ? `തിരക്ക് കാരണം ഡോക്ടർ ഏകദേശം ${(useLiveToken() as any).totalDelayMinutes} മിനിറ്റ് വൈകുന്നു. ദയവായി അല്പം കൂടി കാത്തിരിക്കുക.` 
                                            : `Due to high patient volume, the doctor is running about ${(useLiveToken() as any).totalDelayMinutes} mins behind. Your arrival window has been shifted accordingly.`}
                                    </p>
                                </div>
                            </div>
                        )}

                        {isPending && isAppointmentToday && (
                            <div className="mt-6">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-14 rounded-2xl shadow-lg shadow-primary/20 group">
                                            <UserCheck className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                                            {language === 'ml' ? 'ഞാൻ എത്തി എന്ന് അറിയിക്കുക' : 'Check-in Now'}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="w-[90%] rounded-2xl">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="text-xl font-bold">
                                                {language === 'ml' ? 'നിങ്ങൾ എത്തിക്കഴിഞ്ഞോ?' : 'Confirm Arrival?'}
                                            </AlertDialogTitle>
                                            <AlertDialogDescription className="text-base text-muted-foreground">
                                                {language === 'ml' 
                                                    ? 'ക്ലിനിക്കിൽ റിപ്പോർട്ട് ചെയ്തതിനുശേഷം മാത്രം ഇത് ക്ലിക്ക് ചെയ്യുക.' 
                                                    : 'Only check-in if you are physically present at the clinic.'}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter className="flex flex-col-reverse gap-2">
                                            <AlertDialogCancel className="w-full rounded-xl h-12 border-none bg-slate-100 hover:bg-slate-200">
                                                {language === 'ml' ? 'അല്ല' : 'Cancel'}
                                            </AlertDialogCancel>
                                            <AlertDialogAction 
                                                onClick={handleConfirmArrivalInline}
                                                className="w-full rounded-xl h-12 bg-primary font-bold"
                                            >
                                                {language === 'ml' ? 'അതെ, ഞാൻ എത്തി' : 'I Have Arrived'}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        )}

                        {isSkippedAppointment && isAppointmentToday && (
                            <div className="mt-6 p-4 bg-red-50 rounded-2xl border border-red-100 flex items-start gap-3 animate-in fade-in zoom-in duration-300">
                                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                                <div>
                                    <p className="font-bold text-red-800 text-sm">
                                        {language === 'ml' ? 'സ്കിപ്പ് ചെയ്യപ്പെട്ടു' : 'Token Skipped'}
                                    </p>
                                    <p className="text-red-700 text-xs mt-1 leading-relaxed">
                                        {language === 'ml' 
                                            ? 'റിപ്പോർട്ട് ചെയ്യാത്തതിനാൽ ടോക്കൺ സ്കിപ്പ് ചെയ്യപ്പെട്ടു. ഉടൻ റിപ്പോർട്ട് ചെയ്യുക.' 
                                            : 'Your token was skipped. Report to the clinic immediately to reactivate.'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
