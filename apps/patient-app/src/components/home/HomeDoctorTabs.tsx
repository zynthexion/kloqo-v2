'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DoctorCard } from '@/components/home/DoctorCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookingChoiceModal } from '@/components/booking/BookingChoiceModal';
import type { Doctor } from '@kloqo/shared';

interface HomeDoctorTabsProps {
    activeTab: 'myDoctors' | 'nearbyDoctors';
    setActiveTab: (tab: 'myDoctors' | 'nearbyDoctors') => void;
    displayDoctors: Doctor[];
    isLoadingDoctors: boolean;
    t: any;
    language: any;
    departments: any[];
    userLocation: any;
    handleDoctorClick: (doctor: Doctor) => void;
    router: any;
    isBookingChoiceOpen: boolean;
    setIsBookingChoiceOpen: (open: boolean) => void;
    selectedDoctorForBooking: Doctor | null;
    selectedDoctorDistance: number | null;
    confirmWalkIn: (doctor: Doctor) => void;
    confirmAdvanced: (doctor: Doctor) => void;
}

const DoctorSkeleton = () => (
    <Card className="border-0 shadow-sm mb-4">
        <CardContent className="p-4 flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-full" />
            <div className="flex-grow space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
            </div>
        </CardContent>
    </Card>
);

export function HomeDoctorTabs({
    activeTab, setActiveTab, displayDoctors, isLoadingDoctors, t, language, departments, userLocation, handleDoctorClick, router,
    isBookingChoiceOpen, setIsBookingChoiceOpen, selectedDoctorForBooking, selectedDoctorDistance, confirmWalkIn, confirmAdvanced
}: HomeDoctorTabsProps) {
    return (
        <div className="px-6 mt-8 pb-24">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-card-foreground">
                    {t.home.availableDoctors}
                </h2>
            </div>
            
            <Tabs 
                value={activeTab} 
                onValueChange={(val) => setActiveTab(val as 'myDoctors' | 'nearbyDoctors')} 
                className="w-full"
            >
                <TabsList className="grid grid-cols-2 mb-6 bg-muted p-1">
                    <TabsTrigger value="myDoctors" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        {t.discovery.myDoctors}
                    </TabsTrigger>
                    <TabsTrigger value="nearbyDoctors" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        {t.discovery.nearbyDoctors}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-0">
                    {isLoadingDoctors ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => <DoctorSkeleton key={i} />)}
                        </div>
                    ) : displayDoctors.length === 0 ? (
                        <div className="text-center py-12 px-6 bg-gradient-to-br from-primary/5 to-primary/10 rounded-3xl border-2 border-primary/10 shadow-inner">
                            {activeTab === 'nearbyDoctors' ? (
                                !userLocation ? (
                                    <div className="space-y-4">
                                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                                             <span className="text-2xl">📍</span>
                                        </div>
                                        <p className="text-muted-foreground font-medium leading-relaxed">
                                            {t.consultToday.locationRequired}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <span className="text-4xl animate-pulse">🚀</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-primary">
                                            {t.discovery.comingSoon}
                                        </h3>
                                        <p className="text-muted-foreground text-sm max-w-[250px] mx-auto">
                                            {t.discovery.comingSoonDesc}
                                        </p>
                                    </div>
                                )
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-lg font-semibold text-card-foreground">{t.discovery.noHistory}</p>
                                    <p className="text-sm text-muted-foreground">{t.discovery.noHistoryDesc}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {displayDoctors.slice(0, 3).map((doctor) => (
                                <DoctorCard
                                    key={doctor.id}
                                    doctor={doctor}
                                    departments={departments}
                                    language={language}
                                    onClick={() => handleDoctorClick(doctor)}
                                />
                            ))}
                            
                            {displayDoctors.length > 3 && (
                                <Button 
                                    variant="ghost" 
                                    onClick={() => router.push('/doctors')}
                                    className="w-full py-6 rounded-2xl border border-primary/10 text-primary font-bold hover:bg-primary/5 transition-all group"
                                >
                                    {t.home.seeAllDoctors}
                                    <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                                </Button>
                            )}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            <BookingChoiceModal 
                isOpen={isBookingChoiceOpen}
                onClose={() => setIsBookingChoiceOpen(false)}
                doctor={selectedDoctorForBooking}
                distance={selectedDoctorDistance}
                onWalkIn={confirmWalkIn}
                onAdvanced={confirmAdvanced}
                t={t}
            />
        </div>
    );
}
