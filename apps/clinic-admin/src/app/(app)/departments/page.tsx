
"use client";

import Image from "next/image";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  MoreHorizontal,
  Trash,
  Search,
  Users,
  Stethoscope,
  HeartPulse,
  Baby,
  Sparkles,
  BrainCircuit,
  Bone,
  Award,
  Droplets,
  Filter,
  Droplet,
  Eye,
  Ear,
  Brain,
  PersonStanding,
  Radiation,
  Siren,
  Microwave,
  TestTube,
  Bug,
  Scissors,
  Ambulance,
  Wind,
  type LucideIcon,
} from "lucide-react";
import * as Lucide from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { Department, Doctor } from '@kloqo/shared';
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { apiRequest } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { SelectDepartmentDialog } from "@/components/onboarding/select-department-dialog";
import { useAuth } from "@/context/AuthContext";
import { DepartmentDoctorsDialog } from "@/components/departments/department-doctors-dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { useDepartments } from "@/hooks/use-departments";
import { DynamicIcon } from "@/components/departments/dynamic-icon";
import { DepartmentCard } from "@/components/departments/department-card";

export default function DepartmentsPage() {
  const {
    clinicDepartments,
    setClinicDepartments,
    masterDepartments,
    doctors,
    loading,
    clinicDetails,
    setClinicDetails,
    refresh
  } = useDepartments();

  const { toast } = useToast();
  const [isAddDepartmentOpen, setIsAddDepartmentOpen] = useState(false);
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null);
  const [viewingDoctorsDept, setViewingDoctorsDept] = useState<Department | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [departmentsPerPage, setDepartmentsPerPage] = useState(8);

  const filteredDepartments = useMemo(() => {
    return clinicDepartments.filter(department =>
      department.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clinicDepartments, searchTerm]);

  const totalPages = Math.ceil(filteredDepartments.length / departmentsPerPage);
  const currentDepartments = filteredDepartments.slice(
    (currentPage - 1) * departmentsPerPage,
    currentPage * departmentsPerPage
  );

  const getDoctorAvatar = (doctorName: string) => {
    const defaultDoctorImage = "https://firebasestorage.googleapis.com/v0/b/kloqo-nurse-dup-43384903-8d386.firebasestorage.app/o/doctor_male.webp?alt=media&token=b19d8fb5-1812-4eb5-a879-d48739eaa87e";
    const doctor = doctors.find((d) => d.name === doctorName);
    return doctor?.avatar || defaultDoctorImage;
  }

  const getDoctorsInDepartment = (departmentName: string) => {
    return doctors.filter(doctor => doctor.department === departmentName).map(d => d.name);
  }

  const handleSaveDepartments = async (selectedDepts: Department[]) => {
    try {
      const departmentIdsToAdd = selectedDepts.map(d => d.id);
      const currentIds = clinicDetails?.departments || [];
      const updatedIds = [...new Set([...currentIds, ...departmentIdsToAdd])];

      await apiRequest("/clinic", {
        method: "PATCH",
        body: JSON.stringify({ departments: updatedIds })
      });

      refresh();

      toast({
        title: "Departments Added",
        description: `${selectedDepts.length} department(s) have been successfully added.`,
      });
    } catch (error) {
      console.error("Error saving departments:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save departments. Please try again.",
      });
    }
  }

  const handleDeleteDepartment = async () => {
    if (!deletingDepartment) return;
    try {
      const currentIds = clinicDetails?.departments || [];
      const updatedIds = currentIds.filter((id: string) => id !== deletingDepartment.id);

      await apiRequest("/clinic", {
        method: "PATCH",
        body: JSON.stringify({ departments: updatedIds })
      });

      setClinicDepartments(prev => prev.filter(d => d.id !== deletingDepartment.id));
      setClinicDetails((prev: any) => prev ? { ...prev, departments: updatedIds } : prev);

      toast({
        title: "Department Deleted",
        description: `${deletingDepartment.name} has been removed.`,
      });
    } catch (error) {
      console.error("Error deleting department:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete department. Please try again.",
      });
    } finally {
      setDeletingDepartment(null);
    }
  }

  const availableMasterDepartments = (Array.isArray(masterDepartments) ? masterDepartments : []).filter(
    (masterDept) => !clinicDepartments.some((clinicDept) => clinicDept.id === masterDept.id)
  );

  const isDepartmentLimitReached = clinicDetails ? clinicDepartments.length >= clinicDetails.numDoctors : false;


  return (
    <>
      <div className="flex flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static smh-auto sm:border-0 sm:bg-transparent sm:px-6">
          <h1 className="text-xl font-semibold md:text-2xl">Departments</h1>
          <div className="relative ml-auto flex-1 md:grow-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search departments..."
              className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={isDepartmentLimitReached ? "cursor-not-allowed" : ""}>
                  <Button onClick={() => setIsAddDepartmentOpen(true)} disabled={isDepartmentLimitReached}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Department
                  </Button>
                </div>
              </TooltipTrigger>
              {isDepartmentLimitReached && (
                <TooltipContent>
                  <p>Department limit reached. Go to Profile &gt; Clinic Details to increase the limit.</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </header>
        <main className="flex-1 p-4 sm:p-6 flex flex-col">
          <div className="grid flex-grow grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="h-full flex flex-col animate-pulse aspect-square">
                  <div className="h-2/3 w-full bg-muted"></div>
                  <CardContent className="p-3 flex-grow">
                    <div className="h-5 w-3/4 bg-muted rounded"></div>
                    <div className="h-4 w-full bg-muted rounded mt-2"></div>
                  </CardContent>
                </Card>
              ))
            ) : currentDepartments.length > 0 ? (
              currentDepartments.map((dept) => (
                <DepartmentCard 
                  key={dept.id} 
                  department={dept} 
                  doctorsInDept={getDoctorsInDepartment(dept.name)}
                  getDoctorAvatar={getDoctorAvatar}
                  onViewDoctors={setViewingDoctorsDept}
                  onDelete={setDeletingDepartment} 
                />
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-muted-foreground">{clinicDepartments.length > 0 ? 'No departments match your search.' : 'No departments have been added to this clinic yet.'}</p>
              </div>
            )}
          </div>
        </main>
        <footer className="flex items-center justify-between p-4 border-t bg-background">
          <div className="text-sm text-muted-foreground">
            Showing {Math.min((currentPage - 1) * departmentsPerPage + 1, filteredDepartments.length)} to {Math.min(currentPage * departmentsPerPage, filteredDepartments.length)} of {filteredDepartments.length} departments
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </footer>

        <SelectDepartmentDialog
          isOpen={isAddDepartmentOpen}
          setIsOpen={setIsAddDepartmentOpen}
          departments={availableMasterDepartments}
          onDepartmentsSelect={handleSaveDepartments}
        />

        <AlertDialog open={!!deletingDepartment} onOpenChange={(open) => !open && setDeletingDepartment(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the {deletingDepartment?.name} department from your clinic.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteDepartment} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <DepartmentDoctorsDialog
          isOpen={!!viewingDoctorsDept}
          setIsOpen={(isOpen) => !isOpen && setViewingDoctorsDept(null)}
          department={viewingDoctorsDept}
          allDoctors={doctors}
        />
      </div>
    </>
  );
}
