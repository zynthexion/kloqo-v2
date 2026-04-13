import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import { parse } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parses time strings into Date objects.
 * Handles both 24-hour (HH:mm) and legacy 12-hour (hh:mm a) formats.
 */
export function parseTime(timeStr: string, baseDate: Date = new Date()): Date {
    try {
        if (!timeStr) return baseDate;
        
        // Handle 12-hour format with AM/PM
        if (timeStr.toUpperCase().includes('AM') || timeStr.toUpperCase().includes('PM')) {
            return parse(timeStr, 'hh:mm a', baseDate);
        }
        
        // Handle 24-hour format (HH:mm)
        if (timeStr.includes(':')) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const date = new Date(baseDate);
            date.setHours(hours, minutes, 0, 0);
            return date;
        }
        
        return baseDate;
    } catch (error) {
        console.error(`[parseTime] Failed to parse time: ${timeStr}`, error);
        return baseDate;
    }
}

