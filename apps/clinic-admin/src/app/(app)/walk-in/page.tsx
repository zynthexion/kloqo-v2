'use client';

import { Suspense } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppFrameLayout from '@/components/layout/app-frame';
import { useWalkInRegistration } from '@/hooks/use-walk-in-registration';
import { QRCodeRegistration } from '@/components/walk-in/QRCodeRegistration';
import { ManualRegistration } from '@/components/walk-in/ManualRegistration';
import { WalkInDialogs } from '@/components/walk-in/WalkInDialogs';

function WalkInRegistrationContent() {
  const {
    doctor,
    isSubmitting,
    activeTab,
    setActiveTab,
    qrCodeUrl,
    isEstimateModalOpen,
    setIsEstimateModalOpen,
    isTokenModalOpen,
    setIsTokenModalOpen,
    generatedToken,
    estimatedConsultationTime,
    patientsAhead,
    loading,
    form,
    phoneNumber,
    setPhoneNumber,
    isSearchingPatient,
    searchedPatients,
    showForm,
    selectedPatientId,
    selectPatient,
    isDoctorConsultingNow,
    onSubmit,
    handleForceBook,
    handleProceedToToken,
    showForceBookDialog,
    setShowForceBookDialog,
    isWithin15MinutesOfClosing,
  } = useWalkInRegistration();

  if (loading) {
    return (
      <AppFrameLayout>
        <div className="flex flex-col h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppFrameLayout>
    );
  }

  if (!isDoctorConsultingNow) {
    return (
      <AppFrameLayout>
        <div className="flex flex-col h-full">
          <header className="flex items-center gap-4 p-4 border-b">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft />
              </Button>
            </Link>
            <h1 className="text-xl font-bold">Walk-in Registration</h1>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <h2 className="text-xl font-semibold">Doctor Not Available</h2>
            <p className="text-muted-foreground mt-2">Walk-in registration is only available during the doctor's consultation hours.</p>
          </div>
        </div>
      </AppFrameLayout>
    );
  }

  return (
    <AppFrameLayout>
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-4 p-4 border-b">
          <Link href="/">
            <Button variant="ghost" size="icon"><ArrowLeft /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Walk-in Registration</h1>
            {doctor ? (
              <p className="text-sm text-muted-foreground">For Dr. {doctor.name}</p>
            ) : (
              <p className="text-sm text-destructive">Doctor not found</p>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 bg-muted/20">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="qr">Scan QR Code</TabsTrigger>
              <TabsTrigger value="manual">Enter Manually</TabsTrigger>
            </TabsList>
            <TabsContent value="qr">
              <QRCodeRegistration qrCodeUrl={qrCodeUrl} />
            </TabsContent>
            <TabsContent value="manual">
              <ManualRegistration
                phoneNumber={phoneNumber}
                setPhoneNumber={setPhoneNumber}
                isSearchingPatient={isSearchingPatient}
                searchedPatients={searchedPatients}
                selectPatient={selectPatient}
                selectedPatientId={selectedPatientId}
                showForm={showForm}
                form={form}
                onSubmit={onSubmit}
                isSubmitting={isSubmitting}
                doctor={doctor}
              />
            </TabsContent>
          </Tabs>
        </div>

        <WalkInDialogs
          isEstimateModalOpen={isEstimateModalOpen}
          setIsEstimateModalOpen={setIsEstimateModalOpen}
          isTokenModalOpen={isTokenModalOpen}
          setIsTokenModalOpen={setIsTokenModalOpen}
          showForceBookDialog={showForceBookDialog}
          setShowForceBookDialog={setShowForceBookDialog}
          estimatedConsultationTime={estimatedConsultationTime}
          patientsAhead={patientsAhead}
          generatedToken={generatedToken}
          doctor={doctor}
          isSubmitting={isSubmitting}
          handleProceedToToken={handleProceedToToken}
          handleForceBook={handleForceBook}
          isWithin15MinutesOfClosing={isWithin15MinutesOfClosing}
        />
      </div>
    </AppFrameLayout>
  );
}

export default function WalkInRegistrationPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <WalkInRegistrationContent />
    </Suspense>
  );
}