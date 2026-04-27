import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Role } from "@kloqo/shared";
import { RefreshCw, UserCog, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useActiveIdentity } from "@/hooks/useActiveIdentity";
import { useRouter } from "next/navigation";

export function RoleSwitcher() {
  const { activeRole, switchRole, availableRoles } = useActiveIdentity();
  const router = useRouter();

  if (availableRoles.length <= 1 || !activeRole) {
    return null;
  }

  const handleRoleSwitch = (role: Role) => {
    switchRole(role);
  };

  const formatRoleLabel = (role: Role): string => {
    return role
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "h-12 w-12 rounded-full shadow-premium transition-all duration-500 bg-white/80 backdrop-blur-md border border-white/50 hover:scale-110 active:scale-95 group",
            activeRole === "nurse" && "text-emerald-600 border-emerald-500/20",
            activeRole === "pharmacist" && "text-primary border-primary/20",
            activeRole === "clinicAdmin" && "text-blue-600 border-blue-500/20",
            activeRole === "receptionist" && "text-amber-600 border-amber-500/20"
          )}
        >
          <div className="relative">
            <UserCog className="h-6 w-6" strokeWidth={2.5} />
            <div className={cn(
              "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white",
              activeRole === 'nurse' ? "bg-emerald-500" :
              activeRole === 'pharmacist' ? "bg-primary" :
              activeRole === 'receptionist' ? "bg-amber-500" : "bg-blue-500"
            )} />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="rounded-[1.5rem] border-none shadow-2xl animate-in zoom-in-95 duration-200 bg-white/90 backdrop-blur-xl p-2 min-w-[160px]"
        align="start"
        sideOffset={8}
      >
        <div className="px-3 py-2 border-b border-slate-100 mb-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Switch Identity</span>
            <RefreshCw className="h-3 w-3 text-primary animate-pulse-slow" />
          </div>
        </div>
        {availableRoles.map((role) => (
          <DropdownMenuItem 
            key={role} 
            onSelect={() => handleRoleSwitch(role as Role)}
            className={cn(
              "font-black text-[10px] uppercase tracking-widest cursor-pointer py-3 px-3 rounded-xl transition-colors mb-1",
              activeRole === role ? "bg-slate-100" : "hover:bg-slate-50"
            )}
          >
            <div className="flex items-center gap-3 w-full">
               <div className={cn(
                  "w-2 h-2 rounded-full",
                  role === 'nurse' ? "bg-emerald-500" :
                  role === 'pharmacist' ? "bg-primary" :
                  role === 'receptionist' ? "bg-amber-500" : "bg-blue-500"
               )} />
               <span className="flex-1 text-slate-700">{formatRoleLabel(role)}</span>
               {activeRole === role && <ShieldCheck className="h-3 w-3 text-primary" />}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
