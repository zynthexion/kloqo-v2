'use client';

import { CheckCircle2, Clock, Users, Calendar, X, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import Link from 'next/link';
import type { Doctor } from '@kloqo/shared';
import { format } from 'date-fns';

interface WalkInDialogsProps {
  isEstimateModalOpen: boolean;
  setIsEstimateModalOpen: (val: boolean) => void;
  isTokenModalOpen: boolean;
  setIsTokenModalOpen: (val: boolean) => void;
  showForceBookDialog: boolean;
  setShowForceBookDialog: (val: boolean) => void;
  estimatedConsultationTime: Date | null;
  patientsAhead: number;
  generatedToken: string | null;
  doctor: Doctor | null;
  isSubmitting: boolean;
  handleProceedToToken: () => void;
  handleForceBook: () => void;
  isWithin15MinutesOfClosing: (doc: Doctor, time: Date) => boolean;
}

export function WalkInDialogs({
  isEstimateModalOpen,
  setIsEstimateModalOpen,
  isTokenModalOpen,
  setIsTokenModalOpen,
  showForceBookDialog,
  setShowForceBookDialog,
  estimatedConsultationTime,
  patientsAhead,
  generatedToken,
  doctor,
  isSubmitting,
  handleProceedToToken,
  handleForceBook,
  isWithin15MinutesOfClosing
}: WalkInDialogsProps) {
  return (
    <>
      <Dialog open={isEstimateModalOpen} onOpenChange={setIsEstimateModalOpen}>
        <DialogContent className="sm:max-w-sm w-[90%]">
          <DialogHeader>
            <DialogTitle className="text-center">Estimated Wait Time</DialogTitle>
            <DialogDescription className="text-center">The clinic is busy at the moment. Here's the current wait status.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center gap-6 text-center py-4">
            <div className="flex flex-col items-center">
              <Clock className="w-8 h-8 text-primary mb-2" />
              <span className="text-xl font-bold">{estimatedConsultationTime ? `~ ${format(estimatedConsultationTime, 'hh:mm a')}` : 'Calculating...'}</span>
              <span className="text-xs text-muted-foreground">Est. Time</span>
            </div>
            <div className="flex flex-col items-center">
              <Users className="w-8 h-8 text-primary mb-2" />
              <span className="text-2xl font-bold">{patientsAhead}</span>
              <span className="text-xs text-muted-foreground">People Ahead</span>
            </div>
          </div>
          <DialogFooter className="flex-col space-y-2">
            <Button onClick={handleProceedToToken} className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "I'm OK to wait, Proceed"}
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/book-appointment"><Calendar className="mr-2 h-4 w-4" />Book for Another Day</Link>
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" className="w-full">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTokenModalOpen} onOpenChange={setIsTokenModalOpen}>
        <DialogContent className="sm:max-w-xs w-[90%] text-center p-6 sm:p-8">
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="absolute top-4 right-4 h-6 w-6 text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
          <div className="flex flex-col items-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold">Walk-in Token Generated!</h2>
              <p className="text-muted-foreground text-sm">Please wait for your turn. You'll be redirected to the live queue.</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Your Token Number</p>
              <p className="text-5xl font-bold text-primary">{generatedToken}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Force Book Confirmation Dialog */}
      <AlertDialog open={showForceBookDialog} onOpenChange={setShowForceBookDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Force Book Walk-in?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {doctor && isWithin15MinutesOfClosing(doctor, new Date())
                  ? "Walk-in booking is closing soon (within 15 minutes)."
                  : "All available slots are fully booked."}
              </p>
              <p className="font-semibold text-foreground">
                This booking will go outside the doctor's normal availability time.
                Do you want to accommodate this patient?
              </p>
              <p className="text-sm text-muted-foreground">
                The patient will be assigned a token after all currently scheduled appointments.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowForceBookDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleForceBook} className="bg-amber-600 hover:bg-amber-700">
              Force Book Patient
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
