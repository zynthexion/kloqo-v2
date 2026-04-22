'use client';

import { useEffect } from 'react';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { AuthGuard } from '@/components/auth-guard';
import { useAppointmentsState } from '@/hooks/use-appointments-state';
import { useLanguage } from '@/contexts/language-context';
import { useMasterDepartments } from '@/hooks/use-master-departments';
import { AppointmentList } from '@/components/appointments/AppointmentList';
import nextDynamic from 'next/dynamic';

const BottomNav = nextDynamic(() => import('@/components/bottom-nav').then(mod => mod.BottomNav), { ssr: false });

/**
 * Appointments History Orchestrator
 * Modularized page using centralized state and presentational sub-components.
 */
function AppointmentsPageContent() {
    const { t, language } = useLanguage();
    const { departments } = useMasterDepartments();
    const {
        user,
        upcomingAppointments,
        pastAppointments,
        doctorsByName,
        clinics,
        appointmentsLoading,
        userLoading,
        handleAppointmentCancelled
    } = useAppointmentsState();

    useEffect(() => {
        console.log('[AppointmentsPage] Render. State:', {
            patientId: (user as any)?.patientId,
            upcomingCount: upcomingAppointments.length,
            pastCount: pastAppointments.length,
            userLoading,
            appointmentsLoading
        });
    }, [user, upcomingAppointments, pastAppointments, userLoading, appointmentsLoading]);

    if (userLoading && !user) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Skeleton className="h-12 w-12 rounded-full" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-green-50/50 font-body">
            <header className="flex items-center p-4">
                <Link href="/home" className="p-2"> <ArrowLeft className="h-6 w-6" /> </Link>
                <h1 className="text-xl font-bold text-center flex-grow">{t.appointments.myAppointments}</h1>
                <div className="w-8" />
            </header>

            <main className="flex-grow p-4 pb-32">
                <Tabs defaultValue="upcoming">
                    <TabsList className="grid w-full grid-cols-2 bg-transparent">
                        <TabsTrigger value="upcoming" className="data-[state=active]:border-b-2 border-primary rounded-none">{t.appointments.upcoming}</TabsTrigger>
                        <TabsTrigger value="history" className="data-[state=active]:border-b-2 border-primary rounded-none">{t.appointments.history}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="upcoming">
                        <AppointmentList
                            appointments={upcomingAppointments}
                            loading={appointmentsLoading}
                            user={user}
                            t={t}
                            departments={departments}
                            language={language}
                            onCancelled={handleAppointmentCancelled}
                            doctorsByName={doctorsByName}
                            clinics={clinics}
                            emptyText={t.appointments.noUpcoming}
                        />
                    </TabsContent>

                    <TabsContent value="history">
                        <AppointmentList
                            appointments={pastAppointments}
                            isHistory={true}
                            loading={appointmentsLoading}
                            user={user}
                            t={t}
                            departments={departments}
                            language={language}
                            onCancelled={handleAppointmentCancelled}
                            doctorsByName={doctorsByName}
                            clinics={clinics}
                            emptyText={t.appointments.noPast}
                        />
                    </TabsContent>
                </Tabs>
            </main>

            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40">
                <Button className="w-full h-12 text-base font-bold shadow-xl bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                    <Link href="/clinics">{t.appointments.bookNew}</Link>
                </Button>
            </div>

            <BottomNav />
        </div>
    );
}

export default function AppointmentsPage() {
    return (
        <AuthGuard>
            <AppointmentsPageContent />
        </AuthGuard>
    );
}

export const dynamic = 'force-dynamic';
