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
  DialogFooter,
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { User, Role } from '@kloqo/shared';
import { Loader2, Shield } from "lucide-react";
import { apiRequest } from "@/lib/api-client";

const formSchema = z.object({
  roles: z.array(z.string()).min(1, "Please select at least one role."),
});

type EditStaffRolesValues = z.infer<typeof formSchema>;

interface EditStaffRolesModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedUser: User) => void;
}

export function EditStaffRolesModal({ user, isOpen, onClose, onUpdate }: EditStaffRolesModalProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<EditStaffRolesValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roles: [],
    },
  });

  useEffect(() => {
    if (user && isOpen) {
      // Prioritize roles array, fallback to legacy role string
      const initialRoles = user.roles && user.roles.length > 0 
        ? user.roles 
        : (user.role ? [user.role] : []);
      
      form.reset({
        roles: initialRoles || [],
      });
    }
  }, [user, isOpen, form]);

  const onSubmit = (values: EditStaffRolesValues) => {
    if (!user) return;
    
    startTransition(async () => {
      try {
        const payload = {
          roles: values.roles as Role[],
          role: values.roles[0] as Role, // Legacy Dual-Write Priority
        };

        const updatedUser = await apiRequest<User>(`/clinic/staff/${user.id}/roles`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });

        toast({
          title: "Roles Updated",
          description: `Successfully updated roles for ${user.name}.`,
        });

        onUpdate(updatedUser);
        onClose();
      } catch (error: any) {
        console.error("Error updating roles:", error);
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: error.message || "An unexpected error occurred.",
        });
      }
    });
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
             <div className="h-8 w-8 rounded-lg bg-theme-blue/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-theme-blue" />
             </div>
             <DialogTitle>Edit Staff Roles</DialogTitle>
          </div>
          <DialogDescription>
            Update operational roles for <strong>{user.name}</strong>. This changes their available dashboards and permissions.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <FormField
              control={form.control}
              name="roles"
              render={() => (
                <FormItem>
                  <div className="grid grid-cols-1 gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50/50">
                    {[
                      { id: "nurse", label: "Nurse" },
                      { id: "pharmacist", label: "Pharmacist" },
                      { id: "receptionist", label: "Receptionist" },
                      { id: "clinicAdmin", label: "Clinic Admin" },
                    ].map((role) => (
                      <FormField
                        key={role.id}
                        control={form.control}
                        name="roles"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-2 rounded-xl hover:bg-white transition-colors cursor-pointer">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(role.id)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  return checked
                                    ? field.onChange([...current, role.id])
                                    : field.onChange(current.filter((val) => val !== role.id));
                                }}
                              />
                            </FormControl>
                            <div className="flex-1">
                                <FormLabel className="font-bold text-sm cursor-pointer block">{role.label}</FormLabel>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                                    {role.id === "nurse" ? "Clinical Operations" : 
                                     role.id === "pharmacist" ? "Dispensary Access" : 
                                     role.id === "clinicAdmin" ? "Full Dashboard Access" : 
                                     "Front Desk Operations"}
                                </p>
                            </div>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="rounded-xl bg-theme-blue shadow-lg shadow-theme-blue/20">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Role Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
