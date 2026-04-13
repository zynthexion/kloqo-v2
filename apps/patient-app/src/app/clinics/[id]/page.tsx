'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Building2 } from 'lucide-react';
import { useLanguage } from '@/contexts/language-context';
import { useMasterDepartments } from '@/hooks/use-master-departments';
import { useClinicDetailsState } from '@/hooks/use-clinic-details-state';
import { ClinicHeader } from '@/components/clinics/ClinicHeader';
import { PublicDoctorCard } from '@/components/clinics/PublicDoctorCard';
import { useUser } from '@/hooks/api/use-user';
import { Card, CardContent } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

function ClinicDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const clinicId = params.id as string;
    const { t, language } = useLanguage();
    const { departments } = useMasterDepartments();
    const { user, loading: userLoading } = useUser();
    const { clinic, doctors, loading } = useClinicDetailsState();

    // Removed forced login redirect since this is a public page

    return (
        <div className="flex min-h-screen w-full flex-col bg-slate-50 font-pt-sans">
            <header className="flex items-center p-6 border-b bg-white sticky top-0 z-50">
                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-slate-50 hover:bg-slate-100" onClick={() => router.back()}>
                    <ArrowLeft className="h-6 w-6 text-slate-600" />
                    <span className="sr-only">Back</span>
                </Button>
                <div className="flex-1 text-center">
                    <h1 className="text-lg font-black text-slate-900 leading-none uppercase tracking-tight">{t.clinics.clinicDetails}</h1>
                    <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest leading-none">Public Profile</p>
                </div>
                <div className="w-12"></div>
            </header>

            <main className="flex-grow overflow-y-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ClinicHeader clinic={clinic} loading={loading} doctorCount={doctors.length} t={t} />

                <div>
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                        {t.home.availableDoctors}
                        <div className="h-0.5 bg-slate-100 flex-1" />
                    </h2>
                    
                    {loading && doctors.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-24">
                            <Loader2 className="h-10 w-10 animate-spin text-theme-blue/30" />
                        </div>
                    ) : doctors.length > 0 ? (
                        doctors.map(doctor => (
                            <PublicDoctorCard key={doctor.id} doctor={doctor} t={t} departments={departments} language={language} />
                        ))
                    ) : (
                        <Card className="border-none shadow-2xl shadow-black/5 rounded-[2.5rem] bg-white border-2 border-dashed border-slate-100">
                            <CardContent className="p-16 text-center">
                                <Building2 className="h-12 w-12 mx-auto mb-4 text-slate-200" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                                    {t.consultToday.noDoctorsAvailable}
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>
        </div>
    );
}

export default function ClinicDetailsPageWithAuth() {
    return (
        <AuthGuard>
            <ClinicDetailsPage />
        </AuthGuard>
    );
}
