
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AddDepartmentStep } from "@/components/onboarding/add-department-step";
import type { Department, Doctor } from '@kloqo/shared';
import { Button } from "@/components/ui/button";
import { AddDoctorForm } from "@/components/doctors/add-doctor-form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api-client";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [selectedDepartments, setSelectedDepartments] = useState<Department[]>([]);
  const [isAddDoctorOpen, setIsAddDoctorOpen] = useState(false);
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();

  const handleDepartmentsAdded = useCallback((departments: Department[]) => {
    setSelectedDepartments(departments);
  }, []);

  const handleAddDoctorClick = useCallback(() => {
    setIsAddDoctorOpen(true);
  }, []);

  const handleSaveDoctor = async (doctor: Doctor) => {
    if (!auth.currentUser) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in." });
      return;
    }

    try {
      await apiRequest('/clinic', {
        method: 'PATCH',
        body: JSON.stringify({ onboardingStatus: "Completed" })
      });

      toast({
        title: "First Doctor Added!",
        description: "Onboarding complete. Welcome to your dashboard!",
      });

      setIsAddDoctorOpen(false);
      router.push('/dashboard');

    } catch (serverError: any) {
      console.error("Error finalizing onboarding:", serverError);
      toast({
        variant: "destructive",
        title: "Error",
        description: serverError.message || "Failed to complete onboarding status. Please contact support.",
      });
    }
  };

  const handleCompletion = async () => {
    if (!auth.currentUser) return;

    try {
      await apiRequest('/clinic', {
        method: 'PATCH',
        body: JSON.stringify({ onboardingStatus: "Completed" })
      });
      router.push('/dashboard');
      toast({
        title: "Onboarding Complete!",
        description: "Welcome to your dashboard."
      });
    } catch (error: any) {
      console.error("Failed to update onboarding status: ", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Could not finalize onboarding. Please try again."
      })
    }
  }

  return (
    <>
      <main className="flex-1 p-4 sm:p-6">
        <AddDepartmentStep onDepartmentsAdded={handleDepartmentsAdded} onAddDoctorClick={handleAddDoctorClick} />
      </main>

      <AddDoctorForm
        onSave={handleSaveDoctor as any}
        isOpen={isAddDoctorOpen}
        setIsOpen={setIsAddDoctorOpen}
        doctor={null}
        departments={selectedDepartments}
        updateDepartments={() => { }}
      />
    </>
  );
}
