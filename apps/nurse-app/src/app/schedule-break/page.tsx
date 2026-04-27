'use client';

import { Suspense } from 'react';
import { format } from 'date-fns';
import { Loader2, ArrowRight, CheckCircle2, Coffee } from 'lucide-react';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { ResponsiveAppLayout } from '@/components/layout/ResponsiveAppLayout';
import { NurseDesktopShell } from '@/components/layout/NurseDesktopShell';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';
import { TabletDashboardLayout } from '@/components/layout/TabletDashboardLayout';
import { Button } from '@/components/ui/button';

// Refactored Hooks & Components
import { useScheduleBreak } from '@/hooks/useScheduleBreak';
import { BreakHeader } from '@/components/schedule-break/BreakHeader';
import { BreakDatePicker } from '@/components/schedule-break/BreakDatePicker';
import { BreakSlotGrid } from '@/components/schedule-break/BreakSlotGrid';
import { BreakImpactPreview } from '@/components/schedule-break/BreakImpactPreview';
import { BreakCompensationToggle } from '@/components/schedule-break/BreakCompensationToggle';
import { useNurseDashboard } from '@/hooks/useNurseDashboard';
import { Doctor } from '@kloqo/shared';

const formatTimeStr = (t: string | null) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
};

function BreakLayoutContent({
  stage, setStage, selectedDate, setSelectedDate, doctor, availableSessions,
  timeIntervals, endIntervals, sessionIndex, setSessionIndex, startTime,
  setStartTime, endTime, setEndTime, isFullCompensation, setIsFullCompensation,
  previewResult, isLoadingPreview, isConfirming, dates, handlePreview, handleConfirm,
  onBack, doctors, selectedDoctorId, onDoctorChange
}: any) {
  return (
    <div className="flex flex-col h-full bg-slate-50 font-pt-sans">
      <BreakHeader 
        stage={stage} 
        onBack={onBack} 
        doctors={doctors}
        selectedDoctorId={selectedDoctorId}
        onDoctorChange={onDoctorChange}
      />

      {stage === 'SELECT' && (
        <>
          <BreakDatePicker dates={dates} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <main className="flex-1 p-4 pt-0 overflow-y-auto">
            <BreakSlotGrid 
              doctor={doctor}
              availableSessions={availableSessions}
              timeIntervals={timeIntervals}
              endIntervals={endIntervals}
              sessionIndex={sessionIndex}
              setSessionIndex={setSessionIndex}
              startTime={startTime}
              setStartTime={setStartTime}
              endTime={endTime}
              setEndTime={setEndTime}
              isFullCompensation={isFullCompensation}
              setIsFullCompensation={setIsFullCompensation}
            />
          </main>

          {sessionIndex !== null && startTime && endTime && (
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t z-50 animate-in slide-in-from-bottom-full">
              <div className="max-w-md mx-auto space-y-4">
                <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                   <span>Fulfillment window</span>
                   <span className="text-amber-600">
                     {formatTimeStr(startTime)} – {formatTimeStr(endTime)}
                   </span>
                </div>
                <Button onClick={handlePreview} disabled={isLoadingPreview} className="w-full h-16 rounded-[2rem] bg-amber-500 hover:bg-amber-600 text-white font-black text-lg shadow-xl shadow-amber-500/20 active:scale-95 flex gap-3">
                  {isLoadingPreview ? <Loader2 className="h-6 w-6 animate-spin" /> : <><span>Preview Impact</span><ArrowRight className="h-5 w-5" /></>}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {stage === 'PREVIEW' && (
        <>
          <BreakImpactPreview 
            previewResult={previewResult} 
            isFullCompensation={isFullCompensation} 
            startTime={startTime}
            endTime={endTime}
            sessionSlot={sessionIndex !== null ? availableSessions[sessionIndex] : null}
          />
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t z-50">
            <div className="max-w-md mx-auto flex gap-3">
              <Button onClick={() => setStage('SELECT')} variant="outline" className="flex-1 h-16 rounded-[2rem] font-black uppercase text-xs tracking-widest border-2">Back</Button>
              <Button onClick={handleConfirm} disabled={isConfirming} className="flex-[2] h-16 rounded-[2rem] bg-amber-500 hover:bg-amber-600 text-white font-black text-base shadow-xl shadow-amber-500/20 active:scale-95">
                {isConfirming ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Confirm & Commit'}
              </Button>
            </div>
          </div>
        </>
      )}

      {stage === 'DONE' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
          <div className="h-24 w-24 rounded-full bg-emerald-500/10 flex items-center justify-center shadow-inner">
             <CheckCircle2 className="h-12 w-12 text-emerald-500 animate-in zoom-in-50" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Break Active</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Syncing with clinical dashboard...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Content() {
  const scheduleProps = useScheduleBreak();
  const { doctorId, router, stage, setStage, clinicId } = scheduleProps;
  const { activeRole } = useActiveIdentity();
  const { data: nurseDashData } = useNurseDashboard(clinicId);

  const handleDoctorChange = (id: string) => {
    localStorage.setItem('selectedDoctorId', id);
    router.replace(`/schedule-break?doctor=${id}`);
  };

  if (!doctorId) {
    return (
      <AppFrameLayout>
        <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6 font-pt-sans">
          <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center shadow-inner">
            <Coffee className="h-10 w-10 text-slate-200" />
          </div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">No Doctor Selected</h2>
          <Button onClick={() => router.push('/')} className="rounded-2xl h-12 px-8 bg-black text-white hover:bg-slate-800">
            Return to Dashboard
          </Button>
        </div>
      </AppFrameLayout>
    );
  }

  const mobileView = (
    <AppFrameLayout>
      <BreakLayoutContent 
        {...scheduleProps} 
        onBack={() => stage === 'PREVIEW' ? setStage('SELECT') : router.back()} 
        doctors={(nurseDashData?.doctors ?? []) as Doctor[]}
        selectedDoctorId={doctorId}
        onDoctorChange={handleDoctorChange}
      />
    </AppFrameLayout>
  );

  const tabletView = (
    <TabletDashboardLayout noPadding>
       <div className="h-full bg-slate-50 flex flex-col">
          <BreakLayoutContent 
            {...scheduleProps} 
            onBack={() => stage === 'PREVIEW' ? setStage('SELECT') : router.back()} 
            doctors={(nurseDashData?.doctors ?? []) as Doctor[]}
            selectedDoctorId={doctorId}
            onDoctorChange={handleDoctorChange}
          />
       </div>
    </TabletDashboardLayout>
  );

  return (
    <ResponsiveAppLayout 
      mobile={mobileView} 
      tablet={
        activeRole === 'nurse' ? (
          <NurseDesktopShell>
            {tabletView}
          </NurseDesktopShell>
        ) : tabletView
      } 
    />
  );
}

export default function ScheduleBreakPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-amber-50 font-pt-sans">
        <Loader2 className="h-12 w-12 animate-spin text-amber-500" />
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Accessing Slot Matrix...</p>
      </div>
    }>
      <Content />
    </Suspense>
  );
}
