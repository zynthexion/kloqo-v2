"use client";

import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, LayoutDashboard } from "lucide-react";

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

interface PermissionsTabProps {
  form: UseFormReturn<any>;
}

export function PermissionsTab({ form }: PermissionsTabProps) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 border-b pb-4 mb-6">
        <div className="bg-primary/10 p-2 rounded-lg">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-bold">Dashboard Permissions</h3>
          <p className="text-sm text-muted-foreground font-medium">Control which modules the doctor can access in the clinic portal.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AVAILABLE_MENUS.map((menu) => (
          <FormField
            key={menu.id}
            control={form.control}
            name="accessibleMenus"
            render={({ field }) => {
              const menus = field.value || [];
              const isChecked = menus.includes(menu.id);

              return (
                <FormItem
                  key={menu.id}
                  className="relative flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-4 bg-background transition-all hover:bg-muted/30 hover:border-primary/20"
                >
                  <FormControl>
                    <Checkbox
                      className="mt-1"
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        const updated = checked
                          ? [...menus, menu.id]
                          : menus.filter((m: string) => m !== menu.id);
                        field.onChange(updated);
                      }}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none select-none cursor-pointer flex-grow" onClick={() => {
                    const updated = !isChecked
                      ? [...menus, menu.id]
                      : menus.filter((m: string) => m !== menu.id);
                    field.onChange(updated);
                  }}>
                    <FormLabel className="font-bold text-sm">
                      {menu.label}
                    </FormLabel>
                    <FormDescription className="text-[10px] uppercase font-black tracking-widest opacity-40">
                      Access to {menu.id}
                    </FormDescription>
                  </div>
                </FormItem>
              );
            }}
          />
        ))}
      </div>

      <div className="mt-8 rounded-xl bg-amber-50 border border-amber-200 p-4 flex gap-3">
        <LayoutDashboard className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-amber-900">Security Note</h4>
          <p className="text-xs text-amber-700 font-medium">Doctors only see data for their assigned department and appointments by default. These toggles control top-level navigation access.</p>
        </div>
      </div>
    </div>
  );
}
