import { format, parse, addMinutes, subMinutes } from 'date-fns';

/**
 * Returns the current time as if it were in the Asia/Kolkata timezone,
 * regardless of the server's local timezone.
 * Useful for consistent scheduling logic on server-side (Next.js API routes).
 */
export function getClinicNow(): Date {
    return new Date();
}

/**
 * Returns the day of the week (e.g., "Monday") for a given date in the Asia/Kolkata timezone.
 */
export function getClinicDayOfWeek(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        timeZone: 'Asia/Kolkata'
    }).format(date);
}

/**
 * Returns the numeric day of the week (0-6) where 0 is Sunday.
 */
export function getClinicDayNumeric(date: Date = new Date()): number {
    const dayName = getClinicDayOfWeek(date);
    const mapping: Record<string, number> = {
        'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
        'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };
    return mapping[dayName];
}

/**
 * Returns the date string (e.g., "d MMMM yyyy") in the Asia/Kolkata timezone.
 */
export function getClinicDateString(date: Date = new Date()): string {
    const options: Intl.DateTimeFormatOptions = {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Kolkata'
    };

    // Intl format "22 December 2025" or similar depending on locale
    // To match "d MMMM yyyy" exactly:
    const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(date);
    const day = parts.find(p => p.type === 'day')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const year = parts.find(p => p.type === 'year')?.value;

    return `${day} ${month} ${year}`;
}

/**
 * Returns the full date string (e.g., "Monday, 19 March 2026") in the Asia/Kolkata timezone.
 */
export function getClinicFullDateString(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Kolkata'
    }).format(date);
}

/**
 * Returns the time string in 24-hour HH:mm format (e.g., "14:30") in the Asia/Kolkata timezone.
 * Golden Standard: All logic and storage use HH:mm.
 */
export function getClinicTimeString(date: Date = new Date()): string {
    const options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata'
    };

    const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(date);
    const hour = parts.find(p => p.type === 'hour')?.value ?? '00';
    const minute = parts.find(p => p.type === 'minute')?.value ?? '00';

    return `${hour}:${minute}`;
}

/**
 * Returns the time string in 12-hour format (e.g., "02:30 PM") for display purposes.
 */
export function getClinic12hTimeString(date: Date = new Date()): string {
    const options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
    };

    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;
    const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value;

    return `${hour}:${minute} ${dayPeriod}`;
}

/**
 * Returns a human-readable 12-hour time string (e.g., "02:30 PM") from a 24-hour string.
 * This is the CENTRALIZED utility for the View Layer.
 */
export function displayTime12h(timeStr: string): string {
    if (!timeStr) return '--:--';
    
    // If it's already HH:mm, parse it relative to a dummy date
    const dummyDate = new Date();
    const parsed = parseClinicTime(timeStr, dummyDate);
    
    return getClinic12hTimeString(parsed);
}

/**
 * Returns a human-readable 12-hour time string with a buffer subtracted (e.g., "02:15 PM" for "14:30").
 * Used for "Arrive By" display logic.
 */
export function displayTimeWithBuffer(timeStr: string, bufferMinutes: number = 15): string {
    if (!timeStr) return '--:--';
    
    const dummyDate = new Date();
    const parsed = parseClinicTime(timeStr, dummyDate);
    const buffered = subMinutes(parsed, bufferMinutes);
    
    return getClinic12hTimeString(buffered);
}

/**
 * Returns the ISO date string (e.g., "2025-12-30") in the Asia/Kolkata timezone.
 */
export function getClinicISOString(date: Date = new Date()): string {
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Kolkata'
    };

    const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(date);
    const day = parts.find(p => p.type === 'day')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const year = parts.find(p => p.type === 'year')?.value;

    return `${year}-${month}-${day}`;
}

/**
 * Returns the ISO date string (e.g., "2026-03-19") in the Asia/Kolkata timezone.
 */
export function getClinicISODateString(date: Date = new Date()): string {
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Kolkata'
    };

    const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(date);
    const day = parts.find(p => p.type === 'day')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const year = parts.find(p => p.type === 'year')?.value;

    return `${year}-${month}-${day}`;
}

/**
 * Returns the 24-hour time string (e.g., "14:30") in the Asia/Kolkata timezone.
 */
export function getClinic24hTimeString(date: Date = new Date()): string {
    const options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata'
    };

    const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(date);
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;

    return `${hour}:${minute}`;
}

/**
 * Returns the short date string (e.g., "12 Dec 2025") in the Asia/Kolkata timezone.
 */
export function getClinicShortDateString(date: Date = new Date()): string {
    const options: Intl.DateTimeFormatOptions = {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata'
    };

    const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(date);
    const day = parts.find(p => p.type === 'day')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const year = parts.find(p => p.type === 'year')?.value;

    return `${day} ${month} ${year}`;
}

export function parseClinicTime(timeStr: string, baseDate: Date): Date {
    // 1. Resolve exactly which day this is in the target timezone (IST)
    const dateStr = getClinicISODateString(baseDate); 
    
    let time24 = timeStr.trim();

    // 2. Handle legacy AM/PM format by converting to HH:mm natively
    if (time24.toUpperCase().includes('AM') || time24.toUpperCase().includes('PM')) {
        const [timePart, modifier] = time24.split(' ');
        let [hours, minutes] = timePart.split(':');
        let h = parseInt(hours, 10);
        
        if (modifier.toUpperCase() === 'PM' && h < 12) h += 12;
        if (modifier.toUpperCase() === 'AM' && h === 12) h = 0;
        
        time24 = `${h.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}`;
    } else {
        // Ensure standard HH:mm formatting even if input provides seconds
        const parts = time24.split(':');
        time24 = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }

    // 3. Construct an absolute time string explicitly bound to the IST timezone
    // The engine parses this perfectly regardless of local system timezone
    // Example: "2026-04-21T22:00:00.000+05:30"
    const strictIsoStr = `${dateStr}T${time24}:00.000+05:30`;
    
    return new Date(strictIsoStr);
}

/**
 * Parses a date string (e.g., "4 January 2026", "2026-02-10"), 
 * interpreting it specifically in the Asia/Kolkata timezone.
 * Returns an "Invalid Date" object if parsing fails.
 */
export function parseClinicDate(dateStr: string): Date {
    let y: number, m: number, d: number;

    // 1. Try YYYY-MM-DD (ISO style)
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        [y, m, d] = dateStr.split('-').map(Number);
    } 
    // 2. Try "d MMMM yyyy"
    else {
        try {
            const parsed = parse(dateStr, 'd MMMM yyyy', new Date());
            if (isNaN(parsed.getTime())) throw new Error();
            y = parsed.getFullYear();
            m = parsed.getMonth() + 1;
            d = parsed.getDate();
        } catch {
            // Fallback to native parsing
            const native = new Date(dateStr);
            if (isNaN(native.getTime())) return native;
            y = native.getFullYear();
            m = native.getMonth() + 1;
            d = native.getDate();
        }
    }

    // 3. Construct an absolute time string explicitly bound to the IST timezone midnight
    // Example: "2026-04-21T00:00:00.000+05:30"
    const isoMidnight = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}T00:00:00.000+05:30`;
    
    return new Date(isoMidnight);
}




