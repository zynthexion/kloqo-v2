'use client';

import nextDynamic from 'next/dynamic';
import { Building2 } from 'lucide-react';
import { useHomeState } from '@/hooks/use-home-state';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeAppointments } from '@/components/home/HomeAppointments';
import { HomeQuickActions } from '@/components/home/HomeQuickActions';
import { HomeDoctorTabs } from '@/components/home/HomeDoctorTabs';
import { AuthGuard } from '@/components/auth-guard';
import { SplashScreen } from '@/components/splash-screen';
import { Suspense } from 'react';

// Lazy-loaded components for better performance
const BottomNav = nextDynamic(() => import('@/components/bottom-nav').then(mod => mod.BottomNav), {
    ssr: false,
    loading: () => <div className="h-16 w-full bg-background" />
});

const QrScannerOverlay = nextDynamic(() => import('@/components/qr-scanner-overlay').then(mod => mod.QrScannerOverlay), {
    ssr: false,
    loading: () => null
});

/**
 * HomePage Performance Orchestrator
 * Modularized for high maintainability and reduced hydration complexity.
 */
function HomePageContent() {
    const {
        user, t, language, departments,
        location, isRefreshingLocation, refreshLocation, userLocation,
        searchQuery, searchResults, handleSearchChange, handleSearchClear, setSearchQuery,
        showQRScanner, setShowQRScanner, scanMode, handleScanQR, handleScanResult,
        walkInAppointment, upcomingAppointments, appointmentsLoading,
        effectiveUserDoctors, displayDoctors, isLoadingDoctors,
        activeTab, setActiveTab, allClinicsData,
        splashAnimationDone, hasShownSplashInSession, handleSplashComplete, dataReady,
        router, handleDoctorClick,
        isBookingChoiceOpen, setIsBookingChoiceOpen, selectedDoctorForBooking, selectedDoctorDistance,
        confirmWalkIn, confirmAdvanced
    } = useHomeState();

    // 1. Show Splash Screen if needed
    if (!hasShownSplashInSession && (!splashAnimationDone || !dataReady)) {
        return <SplashScreen onComplete={handleSplashComplete} />;
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-background">
            {/* Header Section: Hello, Greeting, Search */}
            <HomeHeader
                user={user}
                t={t}
                location={location}
                isRefreshingLocation={isRefreshingLocation}
                refreshLocation={refreshLocation}
                searchQuery={searchQuery}
                searchResults={searchResults}
                onSearchChange={handleSearchChange}
                onClearSearch={handleSearchClear}
                onResultClick={(res: any) => {
                    if (res.type === 'doctor') handleDoctorClick(res);
                    else if (res.type === 'clinic') router.push(`/clinics/${res.id}`);
                    setSearchQuery('');
                }}
                language={language}
            />

            {/* Overlapping Main Content Section */}
            <main className="flex-grow -mt-16 pt-4 pb-24 bg-background rounded-t-[3rem] relative z-20">
                {/* Current Appointments & Upcoming */}
                <HomeAppointments
                    appointmentsLoading={appointmentsLoading}
                    walkInAppointment={walkInAppointment}
                    upcomingAppointments={upcomingAppointments}
                    effectiveUserDoctors={effectiveUserDoctors}
                    t={t}
                    departments={departments}
                    language={language}
                    clinics={allClinicsData}
                />

                {/* Doctor Discovery: Tabs (Match Legacy Order - Tabs Above Scan) */}
                <HomeDoctorTabs
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    displayDoctors={displayDoctors}
                    isLoadingDoctors={isLoadingDoctors}
                    t={t}
                    language={language}
                    departments={departments}
                    userLocation={userLocation}
                    handleDoctorClick={handleDoctorClick}
                    router={router}
                    isBookingChoiceOpen={isBookingChoiceOpen}
                    setIsBookingChoiceOpen={setIsBookingChoiceOpen}
                    selectedDoctorForBooking={selectedDoctorForBooking}
                    selectedDoctorDistance={selectedDoctorDistance}
                    confirmWalkIn={confirmWalkIn}
                    confirmAdvanced={confirmAdvanced}
                />

                {/* Quick Access: QR Scan (Match Legacy 2-column scan buttons) */}
                <HomeQuickActions
                    onScanConsult={() => handleScanQR('consult')}
                    onScanConfirm={() => handleScanQR('confirm')}
                />

                {/* View All Clinics (Legacy Pattern) */}
                <div className="px-6 mt-8">
                    <button
                        type="button"
                        onClick={() => router.push('/clinics')}
                        className="w-full rounded-2xl bg-white shadow-sm border border-primary/10 px-6 py-5 flex items-center gap-4 text-primary hover:shadow-md transition active:scale-[0.98]"
                    >
                        <div className="rounded-xl bg-primary/10 p-3">
                            <Building2 className="h-6 w-6" />
                        </div>
                        <div className="text-left flex-grow">
                            <p className="text-lg font-bold leading-tight">{t.home.viewAllClinics}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">{t.home.exploreClinics}</p>
                        </div>
                    </button>
                </div>
            </main>

            <Suspense fallback={null}>
                {showQRScanner && (
                    <QrScannerOverlay
                        open={showQRScanner}
                        mode={scanMode}
                        onScan={handleScanResult}
                        onClose={() => setShowQRScanner(false)}
                        title={scanMode === 'confirm' ? (language === 'ml' ? 'ഹാജരാവൽ സ്ഥിരീകരിക്കുക' : 'Confirm Arrival') : (t.consultToday?.scanQRCode || 'Scan QR Code')}
                        description={scanMode === 'confirm' ? (language === 'ml' ? 'ക്ലിനിക്കിൽ നൽകിയ QR കോഡ് സ്കാൻ ചെയ്ത് ഹാജരാവൂ.' : 'Scan the clinic QR to confirm your arrival.') : (t.consultToday?.positionQRCode || 'Position the QR code within the frame')}
                    />
                )}
            </Suspense>

            {/* Navigation */}
            <BottomNav />
        </div>
    );
}

export default function Home() {
    return (
        <AuthGuard>
            <HomePageContent />
        </AuthGuard>
    );
}

export const dynamic = 'force-dynamic';
