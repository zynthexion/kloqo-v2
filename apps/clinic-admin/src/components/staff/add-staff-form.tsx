"use client";

import { useState, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { User } from '@kloqo/shared';
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";

export const AVAILABLE_MENUS = [
  { id: "/dashboard", label: "Dashboard" },
  { id: "/appointments", label: "Appointments" },
  { id: "/doctors", label: "Doctors" },
  { id: "/patients", label: "Patients" },
  { id: "/departments", label: "Departments" },
  { id: "/prescriptions", label: "Prescription Sheet" },
  { id: "/staff", label: "Admin Staff" },
  { id: "/live-status", label: "Live Status" },
  { id: "/slot-visualizer", label: "Slot Visualizer" },
];

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  phone: z.string().optional(),
  roles: z.array(z.string()).min(1, "Please select at least one role."),
  accessibleMenus: z.array(z.string()).optional(),
  assignedDoctorIds: z.array(z.string()).optional(),
});

type AddStaffFormValues = z.infer<typeof formSchema>;

export function AddStaffForm({ onSave, isOpen, setIsOpen }: { onSave: (user: User) => void, isOpen: boolean, setIsOpen: (val: boolean) => void }) {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      apiRequest<{ id: string; name: string }[]>('/clinic/doctors')
        .then(res => setDoctors(res || []))
        .catch(err => console.error("Failed to fetch doctors", err));
    }
  }, [isOpen]);

  const form = useForm<AddStaffFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      roles: ["nurse"],
      accessibleMenus: AVAILABLE_MENUS.map((m) => m.id),
      assignedDoctorIds: [],
    },
  });

  const selectedRoles = form.watch("roles") || [];
  const hasClinicalRole = selectedRoles.includes("nurse") || selectedRoles.includes("doctor");
  const hasAdminRole = selectedRoles.includes("clinicAdmin") || selectedRoles.includes("receptionist") || selectedRoles.includes("pharmacist");

  const onSubmit = (values: AddStaffFormValues) => {
    startTransition(async () => {
      try {
        if (!currentUser || !currentUser.clinicId) {
          toast({ variant: "destructive", title: "Error", description: "Clinic ID not found. Please log in again." });
          return;
        }

        const payload: any = {
          ...values,
          role: values.roles[0], // Dual-Write Logic: Set primary legacy role
          clinicId: currentUser.clinicId,
        };

        // FinOps/Security Optimization: Staff members (nurse, pharmacist, receptionist) 
        // do NOT have access to THIS clinic admin app. They use the nurse-app.
        // We only save accessibleMenus if they have the 'clinicAdmin' role.
        if (!values.roles.includes("clinicAdmin")) {
          delete payload.accessibleMenus;
        }

        const newUser = await apiRequest<User>('/clinic/staff', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        toast({
          title: "Staff Created",
          description: "Staff account created successfully. The login credentials have been emailed to them.",
        });

        onSave(newUser);
        setIsOpen(false);
        form.reset();

      } catch (error: any) {
        console.error("Error adding staff:", error);
        toast({
          variant: "destructive",
          title: "Save Failed",
          description: error.message || "An unexpected error occurred.",
        });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Staff Member</DialogTitle>
          <DialogDescription>
            Create an account for a new clinic administrator or nurse staff. They will be prompted to change their temporary password upon first login.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input placeholder="jane@clinic.com" {...field} />
                  </FormControl>
                  <FormDescription>Used for login.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="+91 98765 43210" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Staff Roles</FormLabel>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Select all that apply</p>
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                    {[
                      { id: "nurse", label: "Nurse" },
                      { id: "pharmacist", label: "Pharmacist" },
                      { id: "receptionist", label: "Receptionist" },
                      { id: "clinicAdmin", label: "Clinic Admin" },
                    ].map((role) => (
                      <div key={role.id} className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(role.id)}
                            onCheckedChange={(checked) => {
                              const current = field.value || [];
                              const updated = checked
                                ? [...current, role.id]
                                : current.filter((val) => val !== role.id);
                              field.onChange(updated);
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-bold text-xs cursor-pointer">{role.label}</FormLabel>
                      </div>
                    ))}
                  </div>
                  <FormDescription className="text-[10px]">
                    Note: Doctors must be added via the Medical Staff portal for compliance.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {selectedRoles.includes("clinicAdmin") && (
              <FormField
                control={form.control}
                name="accessibleMenus"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">Clinic App Access</FormLabel>
                      <FormDescription>
                        Select which menu items this staff member can access.
                      </FormDescription>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {AVAILABLE_MENUS.map((item) => (
                        <FormField
                          key={item.id}
                          control={form.control}
                          name="accessibleMenus"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={item.id}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(item.id)}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || [];
                                      return checked
                                        ? field.onChange([...current, item.id])
                                        : field.onChange(
                                            current.filter(
                                              (value) => value !== item.id
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal text-sm cursor-pointer whitespace-nowrap">
                                  {item.label}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {hasClinicalRole && doctors.length > 0 && (
              <FormField
                control={form.control}
                name="assignedDoctorIds"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">Assigned Doctors</FormLabel>
                      <FormDescription>
                        Select which doctors this nurse can manage. If none selected, they can manage all.
                      </FormDescription>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {doctors.map((doctor) => (
                        <FormField
                          key={doctor.id}
                          control={form.control}
                          name="assignedDoctorIds"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={doctor.id}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(doctor.id)}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || [];
                                      return checked
                                        ? field.onChange([...current, doctor.id])
                                        : field.onChange(
                                            current.filter(
                                              (value) => value !== doctor.id
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal text-sm cursor-pointer whitespace-nowrap">
                                  {doctor.name}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <div className="flex justify-end pt-4">
              <Button type="button" variant="outline" className="mr-2" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Staff
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
