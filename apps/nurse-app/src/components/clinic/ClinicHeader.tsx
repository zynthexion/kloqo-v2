
'use client';

import { Button } from '@/components/ui/button';
import { parseTime } from '@/lib/utils';
import type { Doctor } from '@kloqo/shared';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { User, Settings, Coffee, CalendarX, Phone } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

type ClinicHeaderProps = {
    doctors: Doctor[];
    selectedDoctor: string;
    onDoctorChange: (doctorId: string) => void;
    showLogo?: boolean;
    showSettings?: boolean;
    onScheduleBreakClick?: () => void;
    onMarkLeaveClick?: () => void;
    pageTitle?: string;
    consultationStatus?: 'In' | 'Out';
    onStatusChange?: (newStatus: 'In' | 'Out', sessionIndex?: number) => void;
    currentTime?: Date;
    isBreakMode?: boolean;
    showPhoneModeToggle?: boolean;
    isPhoneMode?: boolean;
    onPhoneModeToggle?: () => void;
    hasActiveAppointments?: boolean;
    className?: string;
    style?: React.CSSProperties;
};

export default function ClinicHeader({
    doctors,
    selectedDoctor,
    onDoctorChange,
    showLogo = false,
    showSettings = true,
    onScheduleBreakClick,
    onMarkLeaveClick,
    pageTitle,
    consultationStatus = 'Out',
    onStatusChange,
    currentTime = new Date(),
    isBreakMode = false,
    showPhoneModeToggle = false,
    isPhoneMode = false,
    onPhoneModeToggle,
    hasActiveAppointments = false,
    className,
    style,
}: ClinicHeaderProps) {
    const { theme } = useTheme();
    const currentDoctor = doctors.find(d => d.id === selectedDoctor);

    const todayStr = format(currentTime, 'd MMMM yyyy');
    const dayName = format(currentTime, 'EEEE');

    // Check if we are within any active session (including extensions)
    const dayIndex = currentTime.getDay();
    const availabilitySlot = currentDoctor?.availabilitySlots?.find(s => Number(s.day) === dayIndex);
    const todayExtensions = (currentDoctor as any)?.availabilityExtensions?.[todayStr]?.sessions || [];

    let activeSessionIndex: number | undefined = undefined;
    const isSessionActive = availabilitySlot?.timeSlots.some((slot, index) => {
        try {
            const start = parseTime(slot.from, currentTime);
            // Check for extension
            const extension = todayExtensions.find((e: any) => e.sessionIndex === index);
            const endTimeStr = extension?.newEndTime || slot.to;
            const end = parseTime(endTimeStr, currentTime);

            if (!start || !end) return false;

            const isActive = currentTime >= start && currentTime <= end;
            if (isActive) activeSessionIndex = index;
            return isActive;
        } catch (e) {
            return false;
        }
    }) ?? false;

    const todayBreaks = (currentDoctor as any)?.breakPeriods?.[todayStr] || [];
    const activeBreak = todayBreaks.find((bp: any) => {
        try {
            const start = new Date(bp.startTime);
            const end = new Date(bp.endTime);
            return currentTime >= start && currentTime <= end;
        } catch (e) {
            return false;
        }
    });

    const hasAnyBreakStarted = todayBreaks.some((bp: any) => {
        try {
            return currentTime >= new Date(bp.startTime);
        } catch (e) {
            return false;
        }
    });

    const showBreakToggle = isBreakMode
        ? (hasActiveAppointments || !!activeBreak || (consultationStatus === 'Out' && hasAnyBreakStarted && isSessionActive) || (consultationStatus === 'In' && isSessionActive))
        : true;

    const utilityMenuItems = [
        {
            icon: CalendarX,
            title: 'Leave',
            action: onMarkLeaveClick,
            disabled: !selectedDoctor,
        }
    ].filter(item => item.action);

    return (
        <header className={cn(
            "relative p-4 pb-12 transition-all duration-500",
            theme === 'normal' ? (className || "bg-theme-blue text-white rounded-b-3xl") : "bg-transparent text-foreground",
            theme === 'modern' && "modern-glass-header border-none"
        )} style={style}>
            {theme === 'normal' && (
                <>
                    <div className="absolute top-[-50px] left-[-50px] w-[150px] h-[150px] bg-white/20 rounded-full pointer-events-none" />
                    <div className="absolute top-[30px] right-[-80px] w-[200px] h-[200px] border-[20px] border-white/20 rounded-full pointer-events-none" />
                </>
            )}
            {theme === 'modern' && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-[-20%] left-[-10%] w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
                </div>
            )}
            <div className="relative z-10 w-full flex flex-col gap-3">
                <div className="w-full flex justify-between items-start">
                    {showLogo ? (
                        <h1 className={cn(
                            theme === 'modern' ? "text-2xl font-black tracking-tighter modern-gradient-text" : "text-2xl font-bold tracking-tight"
                        )}>kloqo</h1>
                    ) : (
                        <div className="flex items-center gap-3">
                            <Avatar className={cn("h-10 w-10 border-2", theme === 'modern' ? "border-primary/20" : "border-white/50")}>
                                <AvatarImage src={currentDoctor?.avatar} alt={`Dr. ${currentDoctor?.name}`} />
                                <AvatarFallback><User /></AvatarFallback>
                            </Avatar>
                            {currentDoctor && (
                                <div>
                                    <p className="font-bold">Dr. {currentDoctor.name}</p>
                                    <p className="text-xs opacity-70">{currentDoctor.department}</p>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        {showPhoneModeToggle && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onPhoneModeToggle}
                                className={isPhoneMode 
                                    ? "text-foreground bg-white shadow-premium animate-pulse rounded-full" 
                                    : cn("rounded-full", theme === 'modern' ? "text-muted-foreground bg-muted/50" : "text-white bg-white/30 hover:bg-white/40")}
                            >
                                <Phone className="h-5 w-5" />
                            </Button>
                        )}
                        {showSettings && (
                            <Link href="/settings">
                                <Button variant="ghost" size="icon" className={cn("rounded-full", theme === 'modern' ? "text-muted-foreground bg-muted/50" : "text-white hover:bg-white/10 hover:text-white")}>
                                    <Settings className="h-5 w-5" />
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                {showLogo && (
                    <div className="flex flex-col items-center justify-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Avatar className="cursor-pointer h-16 w-16 border-2 border-white/50">
                                    <AvatarImage src={currentDoctor?.avatar} alt={`Dr. ${currentDoctor?.name}`} />
                                    <AvatarFallback><User /></AvatarFallback>
                                </Avatar>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                {doctors.length > 1 && doctors.map(doctor => (
                                    <DropdownMenuItem key={doctor.id} onSelect={() => onDoctorChange(doctor.id)}>
                                        Dr. {doctor.name}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {currentDoctor && (
                            <div className="text-center">
                                <p className="text-lg font-bold">Dr. {currentDoctor.name}</p>
                                <p className="text-sm opacity-90">{currentDoctor.department}</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-col items-center">
                    {showBreakToggle && onStatusChange && (
                        <div className="mt-2">
                            <Button
                                size="sm"
                                onClick={() => onStatusChange(consultationStatus === 'In' ? 'Out' : 'In', activeSessionIndex)}
                                disabled={!currentDoctor}
                                className={`
                        relative px-6 py-2 rounded-full font-medium transition-all duration-300 shadow-lg
                        ${consultationStatus === 'In'
                                        ? (isBreakMode ? 'bg-amber-500/80 hover:bg-amber-500/90' : 'bg-green-500/70 hover:bg-green-500/80')
                                        : (isBreakMode ? 'bg-green-500/80 hover:bg-green-500/90' : 'bg-red-500/70 hover:bg-red-500/80')
                                    }
                        text-white border-2 border-white/20
                      `}
                            >
                                <span className="flex items-center gap-2">
                                    <span className={`
                          w-2 h-2 rounded-full animate-pulse
                          ${consultationStatus === 'In' ? 'bg-white' : 'bg-white'}
                        `} />
                                    {isBreakMode
                                        ? (consultationStatus === 'In' ? 'Start Break' : 'End Break')
                                        : (consultationStatus === 'In' ? 'Doctor In' : 'Doctor Out')
                                    }
                                </span>
                            </Button>
                        </div>
                    )}
                    <div className="mt-3 flex gap-4">
                        {utilityMenuItems.map((item, index) => (
                            <Button
                                key={index}
                                onClick={item.disabled ? undefined : item.action}
                                disabled={item.disabled}
                                className="rounded-full bg-slate-100/80 text-gray-700 hover:bg-slate-200/90 shadow-lg border border-white/30 backdrop-blur-sm"
                            >
                                <item.icon className="mr-2 h-4 w-4" />
                                {item.title}
                            </Button>
                        ))}
                    </div>
                </div>
                {pageTitle && (
                    <div className="mt-4">
                        <h1 className="text-2xl font-bold text-center text-white">{pageTitle}</h1>
                    </div>
                )}
            </div>
        </header>
    );
}
