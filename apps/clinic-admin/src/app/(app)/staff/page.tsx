"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { User } from '@kloqo/shared';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/api-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, UserCog, Mail, Phone, MoreHorizontal, ShieldAlert, BadgeCheck, Trash2, Edit } from "lucide-react";
import { AddStaffForm } from "@/components/staff/add-staff-form";
import { EditStaffRolesModal } from "@/components/staff/edit-staff-roles-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Role } from "@kloqo/shared";

export default function StaffPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    async function fetchStaff() {
      if (!currentUser || !currentUser.clinicId) return;
      setIsLoading(true);

      try {
        const response = await apiRequest<any>(`/clinic/staff?clinicId=${currentUser.clinicId}`);
        const staffData = Array.isArray(response) ? response : (response?.data || []);
        // Filter out superAdmins and current user if necessary, but backend should handle most of this
        // Actually, logic-free means we just show what we get
        setStaff([...staffData].sort((a: any, b: any) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error("Error fetching staff:", error);
        toast({
          variant: "destructive",
          title: "Error Loading Staff",
          description: "Failed to fetch staff directory from servers.",
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchStaff();
  }, [currentUser, toast]);

  const handleStaffAdded = (newStaff: User) => {
    setStaff((prev) => [...prev, newStaff].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
  };

  const handleStaffUpdated = (updatedUser: User) => {
    setStaff((prev) => prev.map(s => (s.id === updatedUser.id ? updatedUser : s)));
  };

  const handleRemoveStaff = async (staffId: string) => {
    if (!confirm("Are you sure you want to remove this staff member? They will lose access to the clinic dashboard immediately.")) {
      return;
    }
    try {
      await apiRequest(`/clinic/staff/${staffId}`, {
        method: 'DELETE'
      });
      
      setStaff((prev) => prev.filter((s) => s.id !== staffId));
      
      toast({
        title: "Staff Removed",
        description: "The staff account has been securely removed.",
      });
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Failed to Remove Staff",
            description: "An error occurred while trying to remove the staff member.",
        });
    }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Staff Management</h2>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setIsAddFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Staff Member
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clinic Administrators & Nurses</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : staff.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserCog className="mx-auto h-12 w-12 opacity-50 mb-4" />
              <p>No extra staff members have been added yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Contact Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => (
                  <TableRow key={member.uid || member.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {member.name}
                        {member.id === currentUser?.uid && (
                            <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {(member.roles && member.roles.length > 0 ? member.roles : [member.role as Role]).map((role, i) => (
                          <React.Fragment key={i}>
                            {role === 'clinicAdmin' && (
                              <Badge key={`${member.id}-${role}`} variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-transparent gap-1">
                                <ShieldAlert className="h-3 w-3" /> Admin
                              </Badge>
                            )}
                            {role === 'nurse' && (
                              <Badge key={`${member.id}-${role}`} variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-transparent gap-1">
                                <BadgeCheck className="h-3 w-3" /> Nurse
                              </Badge>
                            )}
                            {role === 'pharmacist' && (
                              <Badge key={`${member.id}-${role}`} variant="secondary" className="bg-theme-blue/10 text-theme-blue hover:bg-theme-blue/10 border-transparent gap-1 font-bold">
                                <MoreHorizontal className="h-3 w-3" /> Pharmacist
                              </Badge>
                            )}
                            {role === 'receptionist' && (
                              <Badge key={`${member.id}-${role}`} variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-transparent gap-1">
                                <UserCog className="h-3 w-3" /> Receptionist
                              </Badge>
                            )}
                            {role === 'doctor' && (
                              <Badge key={`${member.id}-${role}`} variant="secondary" className="bg-slate-100 text-slate-800 hover:bg-slate-100 border-transparent gap-1">
                                <BadgeCheck className="h-3 w-3" /> Doctor
                              </Badge>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {member.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        {member.phone || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem 
                            onClick={() => { setEditingStaff(member); setIsEditModalOpen(true); }}
                            className="text-slate-700"
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Manage Roles
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleRemoveStaff((member.uid || member.id) as string)}
                            className="text-red-600"
                            disabled={member.id === currentUser?.uid}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove Access
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddStaffForm
        isOpen={isAddFormOpen}
        setIsOpen={setIsAddFormOpen}
        onSave={handleStaffAdded}
      />

      <EditStaffRolesModal 
        user={editingStaff}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onUpdate={handleStaffUpdated}
      />
    </div>
  );
}
