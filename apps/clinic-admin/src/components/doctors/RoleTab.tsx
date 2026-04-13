'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Shield, Save, Loader2, Activity, FlaskConical, UserCog, ShieldCheck, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doctor, Role } from '@kloqo/shared';
import { useState, useEffect } from 'react';

interface RoleTabProps {
  doctor: Doctor;
  onUpdate: (updates: Partial<Doctor>) => Promise<void>;
  isPending: boolean;
}

export function RoleTab({ doctor, onUpdate, isPending }: RoleTabProps) {
  const [roles, setRoles] = useState<Role[]>(
    doctor.roles && doctor.roles.length > 0 ? doctor.roles : (doctor.role ? [doctor.role as Role] : ['doctor' as Role])
  );

  useEffect(() => {
    if (doctor.roles) {
      setRoles(doctor.roles);
    }
  }, [doctor.roles]);

  const handleSave = async () => {
    // Single atomic update for both fields
    await onUpdate({
      role: 'doctor' as any,
      roles: Array.from(new Set(['doctor', ...roles]))
    });
  };

  const isChanged = JSON.stringify(Array.from(new Set(['doctor', ...roles])).sort()) !== 
                   JSON.stringify((doctor.roles || ['doctor']).sort());

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Card className="border-none shadow-2xl shadow-black/5 rounded-[2rem] bg-white overflow-hidden">
        <CardHeader className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-theme-blue/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-theme-blue" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Identity & Roles</CardTitle>
              <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Manage operational identities for this professional</CardDescription>
            </div>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={isPending || !isChanged} 
            className="rounded-xl bg-theme-blue font-black uppercase text-[10px] tracking-widest text-white px-8 shadow-lg shadow-theme-blue/20"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save Roles
          </Button>
        </CardHeader>
        <CardContent className="p-8">
           <div className="flex flex-col gap-8">
              <div className="flex items-center space-x-3 opacity-50 px-6 py-4 rounded-3xl bg-white border-2 border-dashed border-slate-200">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                <div>
                   <Label className="text-[10px] font-black uppercase tracking-widest opacity-80 block">Primary Identity (Implicit)</Label>
                   <Label className="text-lg font-black text-slate-800">Medical Doctor</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: "nurse", label: "Nurse", icon: Activity, desc: "Can access Vitals, Queue & Clinical Dashboards" },
                    { id: "pharmacist", label: "Pharmacist", icon: FlaskConical, desc: "Can access Pharmacy Inventory & Dispensary" },
                    { id: "receptionist", label: "Receptionist", icon: UserCog, desc: "Can handle Bookings, Payments & Front Desk" },
                    { id: "clinicAdmin", label: "Clinic Admin", icon: ShieldCheck, desc: "Full access to Analytics, Staff & Clinic Settings" },
                  ].map(role => {
                     const isSelected = roles.includes(role.id as Role);
                     return (
                        <div 
                           key={role.id}
                           onClick={() => {
                              const updated = isSelected 
                                 ? roles.filter(r => r !== role.id)
                                 : [...roles, role.id as Role];
                              setRoles(Array.from(new Set(['doctor', ...updated])));
                           }}
                           className={cn(
                             "flex items-center gap-5 p-5 rounded-[2rem] border-2 transition-all cursor-pointer group",
                             isSelected 
                               ? "border-theme-blue bg-theme-blue/5 shadow-md shadow-theme-blue/10" 
                               : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
                           )}
                        >
                           <div className={cn(
                             "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors shadow-sm",
                             isSelected ? "bg-theme-blue text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                           )}>
                              <role.icon className="h-7 w-7" />
                           </div>
                           <div className="flex-1">
                              <p className={cn("text-base font-black uppercase tracking-tight transition-colors", isSelected ? "text-theme-blue" : "text-slate-800")}>{role.label}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">{role.desc}</p>
                           </div>
                           {isSelected && (
                             <CheckCircle2 className="h-6 w-6 text-theme-blue shrink-0" />
                           )}
                        </div>
                     );
                  })}
              </div>

               <p className="text-[10px] text-muted-foreground px-4 italic font-medium max-w-2xl">
                 Adding additional roles allows this doctor to switch their "Active Identity" in the Nurse/Tablet App,
                 instantly granting access to different operational tools without needing to logout.
               </p>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
