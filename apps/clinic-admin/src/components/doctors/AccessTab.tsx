'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Shield, Save, Trash2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doctor } from '@kloqo/shared';

interface AccessTabProps {
  doctor: Doctor;
  tempMenus: string[];
  setTempMenus: (menus: string[]) => void;
  isSaving: boolean;
  isRevoking: boolean;
  onSave: () => Promise<void>;
  onRevoke: () => Promise<void>;
}

const AVAILABLE_MENUS = [
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

export function AccessTab({ doctor, tempMenus, setTempMenus, isSaving, isRevoking, onSave, onRevoke }: AccessTabProps) {
  const toggleMenu = (id: string, checked: boolean) => {
    if (checked) setTempMenus([...tempMenus, id]);
    else setTempMenus(tempMenus.filter(m => m !== id));
  };

  const hasAccessToAnything = tempMenus.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Card className="border-none shadow-2xl shadow-black/5 rounded-[2rem] bg-white overflow-hidden">
        <CardHeader className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <Shield className="h-6 w-6 text-indigo-500" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Administrative Access</CardTitle>
              <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Control clinical app permissions </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
                onClick={onRevoke} 
                variant="ghost" 
                disabled={isRevoking || !doctor.accessibleMenus?.length}
                className="rounded-xl text-red-500 font-black uppercase text-[10px] tracking-widest hover:bg-red-50"
            >
              {isRevoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />} Revoke All
            </Button>
            <Button 
                onClick={onSave} 
                disabled={isSaving} 
                className="rounded-xl bg-theme-blue font-black uppercase text-[10px] tracking-widest text-white px-8 shadow-lg shadow-theme-blue/20"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save Permissions
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-8">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {AVAILABLE_MENUS.map(menu => {
               const isChecked = tempMenus.includes(menu.id);
               return (
                 <div 
                    key={menu.id} 
                    className={cn(
                        "p-6 rounded-[2rem] border-2 transition-all cursor-pointer group flex items-start justify-between",
                        isChecked ? "border-indigo-100 bg-indigo-50/30" : "border-slate-50 bg-white hover:border-slate-100"
                    )}
                    onClick={() => toggleMenu(menu.id, !isChecked)}
                 >
                   <div>
                     <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-2">System Module</Label>
                     <p className={cn(
                         "font-black text-sm uppercase tracking-tight leading-none",
                         isChecked ? "text-indigo-600" : "text-slate-800"
                     )}>{menu.label}</p>
                   </div>
                   <Checkbox 
                     checked={isChecked} onCheckedChange={checked => toggleMenu(menu.id, !!checked)} 
                     className="rounded-lg h-6 w-6 border-2 data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500"
                   />
                 </div>
               );
             })}
           </div>

           <div className="mt-8 p-6 rounded-[2rem] bg-slate-50 border-2 border-slate-100/50 flex items-center gap-4">
              <div className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg",
                   hasAccessToAnything ? "bg-emerald-500 text-white shadow-emerald-500/10" : "bg-amber-500 text-white shadow-amber-500/10"
              )}>
                {hasAccessToAnything ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Access Status</p>
                <p className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none">
                  {hasAccessToAnything 
                    ? `Active on ${tempMenus.length} modules` 
                    : "No system access granted"}
                </p>
              </div>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
