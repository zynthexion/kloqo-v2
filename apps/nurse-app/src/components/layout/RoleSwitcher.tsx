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
  // Rule 2: SECURITY CLEANUP: Hide on Desktop for Pharmacists as no other role is authorized for large screens
  if (
    availableRoles.length <= 1 || 
    !activeRole || 
    (activeRole === 'pharmacist' && isDesktop)
  ) {
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
    <div className="px-2 py-3 space-y-2 border-t border-slate-100/50 bg-slate-50/5">
      <div className="flex items-center justify-between px-1">
        <label className="text-[9px] font-black uppercase tracking-tight text-slate-400 flex items-center gap-1 shrink-0">
           <ShieldCheck className="h-3 w-3" /> <span className="hidden lg:inline">Identity</span>
        </label>
        <RefreshCw className="h-2 w-2 text-theme-blue animate-pulse-slow shrink-0" />
      </div>

      <Select
        value={activeRole}
        onValueChange={(value) => switchRole(value as Role)}
      >
        <SelectTrigger 
          className={cn(
            "h-8 w-full rounded-xl border-none shadow-sm transition-all duration-300 font-bold text-[10px] uppercase tracking-tighter",
            "bg-white hover:bg-slate-50 focus:ring-0 px-2",
            activeRole === "nurse" && "text-emerald-600 ring-1 ring-emerald-100",
            activeRole === "pharmacist" && "text-theme-blue ring-1 ring-theme-blue/10",
            activeRole === "clinicAdmin" && "text-blue-600 ring-1 ring-blue-100"
          )}
        >
          <div className="flex items-center gap-1.5 overflow-hidden">
            <UserCog className="h-3 w-3 opacity-50 shrink-0" strokeWidth={3} />
            <div className="truncate">
              <SelectValue placeholder="..." />
            </div>
          </div>
        </SelectTrigger>
        <SelectContent 
          className="rounded-2xl border-none shadow-2xl animate-in zoom-in-95 duration-200"
          align="start"
        >
          {availableRoles.map((role) => (
            <SelectItem 
              key={role} 
              value={role}
              className="font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 cursor-pointer py-2.5"
            >
              {formatRoleLabel(role)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <p className="text-[9px] font-bold text-slate-300 leading-tight px-1">
        Your UI permissions update instantly based on selection.
      </p>
    </div>
  );
}
