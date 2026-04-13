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
        departments,
        formattedDate,
        isAppointmentToday,
        isConfirmedAppointment,
        isPendingAppointment, // Derived from status locally if needed
        isSkippedAppointment,
        isReportingPastDue,
        reportingCountdownLabel,
        reportByTimeDisplay,
        patientsAhead,
        estimatedWaitTime,
        breakMinutes,
        doctorStatusInfo,
        isDoctorIn,
        handleConfirmArrivalInline,
        totalDelayMinutes,
    } = useLiveToken() as any; // Using any briefly for convenience while context stabilizes

    if (!yourAppointment) return null;

    const isPending = yourAppointment.status === 'Pending';

    // Wait Time / Consultation Time Display
    const estimatedConsultationTime = useMemo(() => {
        if (!yourAppointment) return null;
        try {
            // Re-calculating here or pass from context
            // From context: estimatedWaitTime + currentTime
            return null; // For now
        } catch { return null; }
    }, [yourAppointment]);

    const confirmedStatusBanner = useMemo(() => {
        if (!isConfirmedAppointment) return null;
        const { isBreak, isLate, isAffected } = doctorStatusInfo;
        const hasActiveBreak = breakMinutes > 0;

        if ((hasActiveBreak && !isDoctorIn) || isLate || isAffected) {
            return {
                text: t.liveToken?.doctorIsLate || (language === 'ml' ? 'ഡോക്ടർ ഇന്ന് വൈകി' : 'Doctor is late today'),
                className: 'text-red-600',
            };
        }

        if (isDoctorIn) {
            if (patientsAhead === 0) {
                return {
                    text: language === 'ml' ? 'ദയവായി കൺസൾട്ടേഷൻ റൂമിലേക്ക് പോകുക' : 'Please go to the consultation room',
                    className: 'text-green-600',
                };
            }
            return {
                text: language === 'ml' ? 'കൺസൾട്ടേഷൻ നടന്നുകൊണ്ടിരിക്കുന്നു' : 'Consultation in progress',
                className: 'text-green-600',
            };
        }

        return {
            text: language === 'ml' ? 'പരിശോധന ഉടൻ ആരംഭിക്കും' : 'Consultation starting soon',
            className: 'text-green-600',
        };
    }, [isConfirmedAppointment, breakMinutes, doctorStatusInfo, isDoctorIn, patientsAhead, t.liveToken, language]);

    const renderReportingTimeSection = () => {
        if (!isAppointmentToday) return null;

        if (isConfirmedAppointment) {
            return (
                <div className="flex flex-col items-center justify-center py-4 space-y-2">
                    <div className="flex items-center gap-2 text-primary">
                        <UserCheck className="w-6 h-6" />
                        <span className="text-lg font-bold">
                            {language === 'ml' ? 'നിങ്ങൾ റിപ്പോർട്ട് ചെയ്തു' : 'You have arrived'}
                        </span>
                    </div>
                    {confirmedStatusBanner && (
                        <p className={`text-sm font-medium ${confirmedStatusBanner.className} animate-pulse`}>
                            {confirmedStatusBanner.text}
                        </p>
                    )}
                </div>
            );
        }

        if (isPending || isSkippedAppointment) {
            const bgClass = isReportingPastDue ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700';
            const reportingLabel = language === 'ml' ? 'ക്ലിനിക്കിൽ റിപ്പോർട്ട് ചെയ്യേണ്ട സമയം' : 'Estimated reporting time';
            
            return (
                <div className="w-full text-center py-4">
                    <div className={`${bgClass} rounded-full px-4 py-3 flex flex-col items-center justify-center gap-1`}>
                        <Hourglass className="w-6 h-6" />
                        <div className="flex flex-col items-center justify-center">
                            <span className="text-sm font-medium">{reportingLabel}</span>
                            <span className="font-bold text-lg">{reportingCountdownLabel}</span>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <Card className="border-none shadow-lg overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
            
            <CardContent className="p-6">
                <div className="flex flex-col items-center space-y-6">
                    <div className="text-center">
                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">
                            {t.liveToken.tokenNumber}
                        </p>
                        <h2 className="text-6xl font-black text-primary tracking-tighter">
                            {yourAppointment.tokenNumber}
                        </h2>
                        <div className="flex items-center justify-center gap-2 mt-2">
                            <div className={`w-2 h-2 rounded-full ${isConfirmedAppointment ? 'bg-green-500' : 'bg-blue-500'} animate-pulse`}></div>
                            <p className="text-sm font-semibold text-muted-foreground capitalize">
                                {language === 'ml' ? (isConfirmedAppointment ? 'ക്ലിനിക്കിൽ ഇരിക്കുന്നു' : 'നിങ്ങൾ ക്ലിനിക്കിൽ എത്തിയിട്ടില്ല') : yourAppointment.status}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 w-full gap-4 border-y border-dashed border-gray-100 py-6">
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground font-bold uppercase mb-1">{t.home.date}</p>
                            <p className="font-bold text-gray-900">{formattedDate}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-muted-foreground font-bold uppercase mb-1">{t.home.time}</p>
                            <p className="font-bold text-gray-900">{yourAppointment.time}</p>
                        </div>
                    </div>

                    <div className="w-full">
                        {renderReportingTimeSection()}
                        
                        {isAppointmentToday && !isSkippedAppointment && (
                            <div className="mt-4 flex flex-col items-center space-y-4">
                                <div className="grid grid-cols-2 w-full gap-4">
                                    <div className="bg-slate-50 rounded-2xl p-4 flex flex-col items-center justify-center">
                                        <div className="text-primary/60 mb-1">
                                            <Info className="w-4 h-4" />
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            {t.liveToken.patientsAhead}
                                        </p>
                                        <p className="text-2xl font-black text-slate-900">{patientsAhead}</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl p-4 flex flex-col items-center justify-center">
                                        <div className="text-primary/60 mb-1">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            {t.liveToken.waitTime}
                                        </p>
                                        <p className="text-2xl font-black text-slate-900">
                                            {estimatedWaitTime} <span className="text-sm font-normal text-slate-400">{t.liveToken.minutes}</span>
                                        </p>
                                    </div>
                                </div>

                                {isPending && isAppointmentToday && (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-14 rounded-2xl shadow-lg shadow-primary/20 group">
                                                <UserCheck className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                                                {language === 'ml' ? 'ഞാൻ എത്തി എന്ന് അറിയിക്കുക' : 'Confirm Arrival'}
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="w-[90%] rounded-2xl">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle className="text-xl font-bold">
                                                    {language === 'ml' ? 'നിങ്ങൾ എത്തിക്കഴിഞ്ഞോ?' : 'Have you arrived?'}
                                                </AlertDialogTitle>
                                                <AlertDialogDescription className="text-base">
                                                    {language === 'ml' 
                                                        ? 'ദയവായി ക്ലിനിക്കിൽ റിപ്പോർട്ട് ചെയ്തതിനുശേഷം മാത്രം ഈ ബട്ടൺ അമർത്തുക.' 
                                                        : 'Please only confirm if you are physically present at the clinic.'}
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter className="flex flex-col-reverse gap-2">
                                                <AlertDialogCancel className="w-full rounded-xl h-12 border-none bg-slate-100 hover:bg-slate-200">
                                                    {language === 'ml' ? 'അല്ല' : 'No, Cancel'}
                                                </AlertDialogCancel>
                                                <AlertDialogAction 
                                                    onClick={handleConfirmArrivalInline}
                                                    className="w-full rounded-xl h-12 bg-primary font-bold"
                                                >
                                                    {language === 'ml' ? 'അതെ, ഞാൻ എത്തി' : 'Yes, I am here'}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}
                            </div>
                        )}

                        {isSkippedAppointment && isAppointmentToday && (
                            <div className="mt-4 p-4 bg-orange-50 rounded-2xl border border-orange-100 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                                <div>
                                    <p className="font-bold text-orange-800 text-sm">
                                        {language === 'ml' ? 'നിങ്ങൾ സ്കിപ്പ് ചെയ്യപ്പെട്ടു' : 'You were skipped'}
                                    </p>
                                    <p className="text-orange-700 text-xs mt-1 leading-relaxed">
                                        {language === 'ml' 
                                            ? 'നിങ്ങൾ കൃത്യസമയത്ത് റിപ്പോർട്ട് ചെയ്യാത്തതിനാൽ ടോക്കൺ സ്കിപ്പ് ചെയ്യപ്പെട്ടു. ഉടൻ റിപ്പോർട്ട് ചെയ്യുക.' 
                                            : 'Your token was skipped because you were not present. Report immediately to rejoin the queue.'}
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
