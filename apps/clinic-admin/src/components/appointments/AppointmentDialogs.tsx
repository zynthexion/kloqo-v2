'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Star } from "lucide-react";
import type { useAppointmentsPage } from "@/hooks/use-appointments-page";

interface AppointmentDialogsProps {
  state: ReturnType<typeof useAppointmentsPage>['state'];
  actions: ReturnType<typeof useAppointmentsPage>['actions'];
}

export function AppointmentDialogs({ state, actions }: AppointmentDialogsProps) {
  const {
    appointmentToCancel,
    appointmentToAddToQueue,
    appointmentToComplete,
    appointmentToPrioritize,
    isTokenModalOpen,
    generatedToken,
  } = state;

  const {
    setAppointmentToCancel,
    setAppointmentToAddToQueue,
    setAppointmentToComplete,
    setAppointmentToPrioritize,
    setIsTokenModalOpen,
    handleCancel,
    handleAddToQueue,
    handleComplete,
    handlePrioritize,
  } = actions;

  return (
    <>
      <Dialog open={isTokenModalOpen} onOpenChange={setIsTokenModalOpen}>
        <DialogContent className="sm:max-w-xs w-[90%]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">Walk-in Token Generated!</DialogTitle>
            <DialogDescription className="text-center">
              Please wait for your turn. You can monitor the live queue.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">Your Token Number</p>
            <p className="text-5xl font-bold text-primary">{generatedToken}</p>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="absolute top-4 right-4 h-6 w-6 text-muted-foreground">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!appointmentToCancel} onOpenChange={(open) => !open && setAppointmentToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the appointment for "{appointmentToCancel?.patientName}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={() => appointmentToCancel && handleCancel(appointmentToCancel)} className="bg-red-500 hover:bg-red-600">
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!appointmentToAddToQueue} onOpenChange={(open) => !open && setAppointmentToAddToQueue(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Arrival?</AlertDialogTitle>
            <AlertDialogDescription>
              Mark "{appointmentToAddToQueue?.patientName}" as arrived?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => appointmentToAddToQueue && handleAddToQueue(appointmentToAddToQueue)}>
              Confirm Arrival
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!appointmentToComplete} onOpenChange={(open) => !open && setAppointmentToComplete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Completed?</AlertDialogTitle>
            <AlertDialogDescription>
              Has the consultation for "{appointmentToComplete?.patientName}" finished?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => appointmentToComplete && handleComplete(appointmentToComplete)} className="bg-green-500 hover:bg-green-600">
              Yes, Complete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!appointmentToPrioritize} onOpenChange={(open) => !open && setAppointmentToPrioritize(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
              {appointmentToPrioritize?.isPriority ? "Remove Priority?" : "Mark as Priority?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {appointmentToPrioritize?.isPriority 
                ? "Remove priority status from this patient?" 
                : "This will move the patient to the top of the queue."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePrioritize} className="bg-amber-600 hover:bg-amber-700">
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
