
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  ClipboardList,
  Stethoscope,
  Users,
  Building2,
  Activity,
  Smartphone,
  LogOut,
  MoreVertical,
  User as UserIcon,
  FileImage,
  Grid3x3,
  UserCog,
  ReceiptText,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import type { User } from '@kloqo/shared';
import { RBACUtils } from '@kloqo/shared';
import Image from "next/image";

const menuItems = [
  { href: "/dashboard", icon: Home, label: "Dashboard" },
  { href: "/dashboard/reports/providers", icon: TrendingUp, label: "Provider Performance" },
  { href: "/appointments", icon: ClipboardList, label: "Appointments" },
  { href: "/doctors", icon: Stethoscope, label: "Doctors" },
  { href: "/patients", icon: Users, label: "Patients" },
  { href: "/departments", icon: Building2, label: "Departments" },
  { href: "/prescriptions", icon: ReceiptText, label: "Prescription Sheet" },
  { href: "/staff", icon: UserCog, label: "Admin Staff" },
  { href: "/live-status", icon: Activity, label: "Live Status" },
  { href: "/slot-visualizer", icon: Grid3x3, label: "Slot Visualizer" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, logout, activeRole } = useAuth();
  const [clinicName, setClinicName] = useState<string | null>(null);
  const [clinicLogoUrl, setClinicLogoUrl] = useState<string | null>(null);

  const isOnboarding = pathname === "/onboarding";

  useEffect(() => {
    if (currentUser) {
      const fetchClinicData = async () => {
        try {
          const clinicData = await apiRequest<any>('/clinic/me');
          if (clinicData) {
            setClinicName(clinicData.name);
            setClinicLogoUrl(clinicData.logoUrl || null);
          }
        } catch (error) {
          console.error("Failed to fetch clinic data for sidebar:", error);
        }
      };
      fetchClinicData();
    }
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      logout();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    } catch (error) {
      console.error("Logout failed:", error);
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: "An error occurred while logging out. Please try again.",
      });
    }
  };

  const NavLink = ({ href, icon: Icon, label }: { href: string, icon: React.ElementType, label: string }) => {
    const isDisabled = isOnboarding;

    const linkContent = (
        <div
            className={cn(
                "flex items-center h-12 p-3 rounded-lg transition-colors",
                pathname === href && !isOnboarding
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent/50",
                isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                "overflow-hidden"
            )}
        >
            <Icon className="h-6 w-6 shrink-0" />
            <span className="ml-4 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 whitespace-nowrap">
                {label}
            </span>
        </div>
    );

    if (isDisabled) {
        return <div title={`${label} is disabled during onboarding`}>{linkContent}</div>;
    }

    return <Link href={href}>{linkContent}</Link>;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="group sticky top-0 left-0 h-screen w-16 hover:w-64 transition-all duration-300 ease-in-out flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-lg z-50 rounded-tr-2xl rounded-br-2xl">
        <div className="flex h-20 items-center justify-center p-4 shrink-0">
            <Link href="/" className="flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 group-hover:hidden transition-opacity duration-200">
                    <Image src="https://firebasestorage.googleapis.com/v0/b/kloqo-nurse-dup-43384903-8d386.firebasestorage.app/o/kloqo_Logo.png?alt=media&token=e31146d5-17c2-4f88-82f0-f5e13fbd3641" alt="Kloqo Icon" width={40} height={40} unoptimized={true} />
                </div>
                <div className="w-32 h-auto shrink-0 hidden group-hover:block transition-opacity duration-200 delay-100">
                     <Image src="https://firebasestorage.googleapis.com/v0/b/kloqo-nurse-dup-43384903-8d386.firebasestorage.app/o/Kloqo_Logowhite.png?alt=media&token=9e517ac9-2622-46f1-ad28-dcdf82611177" alt="Kloqo Logo" width={128} height={35} unoptimized={true} />
                </div>
            </Link>
        </div>

        <nav className="flex-grow flex flex-col justify-start gap-2 p-2">
          {menuItems.filter(item => {
            if (currentUser?.accessibleMenus && Array.isArray(currentUser.accessibleMenus) && currentUser.accessibleMenus.length > 0) {
              return currentUser.accessibleMenus.includes(item.href);
            }
            
            // Fallback to activeRole based menus
             const roleMenus = (RBACUtils as any).getRoleMenus(activeRole);
            return roleMenus.length > 0 ? roleMenus.includes(item.href) : true;
          }).map((item) => (
            <Tooltip key={item.label}>
              <TooltipTrigger asChild>
                <NavLink href={item.href} icon={item.icon} label={item.label} />
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="group-hover:hidden ml-2"
              >
                {item.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </nav>
        
        <div className="mt-auto p-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start h-auto p-2 hover:bg-sidebar-accent/50">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={clinicLogoUrl || undefined} alt={clinicName || ""} />
                      <AvatarFallback>{clinicName?.charAt(0) || 'C'}</AvatarFallback>
                    </Avatar>
                    <div className="text-left opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100 whitespace-nowrap overflow-hidden flex items-center">
                        <p className="text-sm font-semibold text-sidebar-foreground truncate">{clinicName || 'No Clinic'}</p>
                    </div>
                    <MoreVertical className="ml-auto h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-100" />
                  </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="mb-2 ml-2">
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>View Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-500">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </TooltipProvider>
  );
}
