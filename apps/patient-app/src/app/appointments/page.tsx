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
import { motion } from 'framer-motion';
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
        <div className="flex min-h-screen w-full flex-col bg-slate-950 font-body text-white selection:bg-primary/30">
            {/* Background Decorative Gradients */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px]"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-[120px]"></div>
            </div>

            <header className="relative z-10 flex items-center p-6 bg-slate-950/50 backdrop-blur-md border-b border-white/5">
                <Link href="/home" className="p-2 hover:bg-white/5 rounded-full transition-colors"> 
                    <ArrowLeft className="h-6 w-6 text-slate-400" /> 
                </Link>
                <h1 className="text-xl font-black text-center flex-grow tracking-tight">
                    {t.appointments.myAppointments}
                </h1>
                <div className="w-10" />
            </header>

            <main className="relative z-10 flex-grow p-4 pb-32">
                <Tabs defaultValue="upcoming" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-white/5 p-1 rounded-2xl border border-white/5 mb-8">
                        <TabsTrigger 
                            value="upcoming" 
                            className="rounded-xl py-3 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all font-bold text-slate-400"
                        >
                            {t.appointments.upcoming}
                        </TabsTrigger>
                        <TabsTrigger 
                            value="history" 
                            className="rounded-xl py-3 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all font-bold text-slate-400"
                        >
                            {t.appointments.history}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="upcoming" className="mt-0 outline-none">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
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
                        </motion.div>
                    </TabsContent>

                    <TabsContent value="history" className="mt-0 outline-none">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
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
                        </motion.div>
                    </TabsContent>
                </Tabs>
            </main>

            <div className="fixed bottom-28 left-1/2 -translate-x-1/2 w-full max-w-md px-6 z-40">
                <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    <Button className="w-full h-14 text-base font-black shadow-2xl bg-primary hover:bg-primary/90 text-white rounded-[1.5rem] border-t border-white/20" asChild>
                        <Link href="/clinics">
                            <span className="flex items-center gap-2">
                                {t.appointments.bookNew}
                                <ArrowLeft className="w-4 h-4 rotate-180" />
                            </span>
                        </Link>
                    </Button>
                </motion.div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-50">
                <BottomNav />
            </div>
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
