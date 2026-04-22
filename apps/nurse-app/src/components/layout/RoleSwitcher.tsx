"use client";

import React, { useState, useEffect } from "react";
import { useActiveIdentity } from "@/hooks/useActiveIdentity";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Role } from "@kloqo/shared";
import { RefreshCw, ShieldCheck, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * RoleSwitcher Component (Phase 7)
 * 
 * Provides a UI control for users with multiple operational roles
 * to switch their active identity (e.g., from Nurse to Pharmacist).
 */
export function RoleSwitcher() {
  const { activeRole, switchRole, availableRoles } = useActiveIdentity();
  const [isDesktop, setIsDesktop] = useState(false);

  // 🚀 Viewport Monitoring
  useEffect(() => {
    // Initial sync
    setIsDesktop(window.innerWidth >= 1024);

    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsDesktop(window.innerWidth >= 1024);
      }, 150);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Rule 1: Return null if no switching is possible (1 or fewer roles)
  if (availableRoles.length <= 1 || !activeRole) {
    return null;
  }

  /**
   * Safe label formatter (e.g., "clinicAdmin" -> "Clinic Admin")
   */
  const formatRoleLabel = (role: Role): string => {
    return role
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  return (
    <div className="w-full px-2 py-3 space-y-2 bg-white/40 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm">
      <div className="flex items-center justify-between px-1">
        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 shrink-0">
           <ShieldCheck className="h-3 w-3 text-primary" /> <span className="opacity-60">Identity</span>
        </label>
        <RefreshCw className="h-2 w-2 text-primary animate-pulse-slow shrink-0" />
      </div>

      <Select
        value={activeRole}
        onValueChange={(value) => switchRole(value as Role)}
      >
        <SelectTrigger 
          className={cn(
            "h-9 w-full rounded-xl border-none shadow-premium transition-all duration-300 font-black text-[10px] uppercase tracking-widest",
            "bg-white hover:bg-slate-50 focus:ring-0 px-2",
            activeRole === "nurse" && "text-emerald-600 ring-1 ring-emerald-500/20",
            activeRole === "pharmacist" && "text-primary ring-1 ring-primary/20",
            activeRole === "clinicAdmin" && "text-blue-600 ring-1 ring-blue-500/20",
            activeRole === "receptionist" && "text-amber-600 ring-1 ring-amber-500/20"
          )}
        >
          <div className="flex items-center gap-2 overflow-hidden w-full">
            <div className="p-1 bg-slate-100 rounded-md shrink-0">
               <UserCog className="h-3 w-3 text-slate-600" strokeWidth={3} />
            </div>
            <div className="truncate flex-1 text-left">
              <SelectValue placeholder="..." />
            </div>
          </div>
        </SelectTrigger>
        <SelectContent 
          className="rounded-[2rem] border-none shadow-2xl animate-in zoom-in-95 duration-200 bg-white/90 backdrop-blur-xl"
          align="start"
        >
          {availableRoles.map((role) => (
            <SelectItem 
              key={role} 
              value={role}
              className="font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 cursor-pointer py-3"
            >
              <div className="flex items-center gap-2">
                 <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    role === 'nurse' ? "bg-emerald-500" :
                    role === 'pharmacist' ? "bg-primary" :
                    role === 'receptionist' ? "bg-amber-500" : "bg-blue-500"
                 )} />
                 {formatRoleLabel(role)}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
