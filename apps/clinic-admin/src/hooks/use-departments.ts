"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { apiRequest } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import type { Department, Doctor } from "@kloqo/shared";

export function useDepartments() {
  const { toast } = useToast();
  const [clinicDepartments, setClinicDepartments] = useState<Department[]>([]);
  const [masterDepartments, setMasterDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [clinicDetails, setClinicDetails] = useState<any>(null);

  const fetchMasterDepartments = useCallback(async () => {
    try {
      const response = await apiRequest<any>("/clinic/departments/master");
      const masterDeptsList = Array.isArray(response) ? response : (response?.data || []);
      setMasterDepartments(masterDeptsList);
    } catch (error) {
      console.error("Error fetching master departments:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load master department list." });
    }
  }, [toast]);

  const fetchClinicData = useCallback(async () => {
    if (masterDepartments.length === 0) return;
    setLoading(true);
    try {
      const [clinicData, doctorsList] = await Promise.all([
        apiRequest<any>("/clinic/me"),
        apiRequest<Doctor[]>("/clinic/doctors")
      ]);

      if (clinicData) {
        setClinicDetails(clinicData);
        const departmentIds: string[] = clinicData.departments || [];

        if (departmentIds.length > 0) {
          const deptsForClinic = masterDepartments.filter(md => departmentIds.includes(md.id));
          setClinicDepartments(deptsForClinic);
        } else {
          setClinicDepartments([]);
        }
      }
      setDoctors(doctorsList || []);
    } catch (error) {
      console.error("Error fetching departments data:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load clinic-specific department data." });
    } finally {
      setLoading(false);
    }
  }, [toast, masterDepartments]);

  useEffect(() => {
    fetchMasterDepartments();
  }, [fetchMasterDepartments]);

  useEffect(() => {
    fetchClinicData();
  }, [fetchClinicData]);

  const refresh = useCallback(() => {
    fetchClinicData();
  }, [fetchClinicData]);

  return {
    clinicDepartments,
    setClinicDepartments,
    masterDepartments,
    doctors,
    loading,
    clinicDetails,
    setClinicDetails,
    refresh
  };
}
