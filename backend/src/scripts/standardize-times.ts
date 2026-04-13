import fs from 'fs';
import path from 'path';

/**
 * STANDARDIZE-TIMES SCRIPT
 * 
 * Purpose: Transform offline JSON backup files into V2 "Golden Standard" format
 * before running restore-firestore.ts.
 * 
 * Usage:
 *   npx ts-node src/scripts/standardize-times.ts ../backups/TIMESTAMP
 * 
 * Idempotent: Safe to run multiple times. Checks before converting.
 * IST Safe: Explicitly uses UTC offsets to avoid server timezone drift during conversion.
 */

const BACKUP_DIR = process.argv[2];

if (!BACKUP_DIR) {
    console.error('Usage: npx ts-node src/scripts/standardize-times.ts ../backups/TIMESTAMP');
    process.exit(1);
}

const backupPath = path.resolve(__dirname, '..', '..', BACKUP_DIR);
if (!fs.existsSync(backupPath)) {
    console.error(`Directory not found: ${backupPath}`);
    process.exit(1);
}

// ========================
// Helpers
// ========================

function isAmPmString(val: any): boolean {
    if (typeof val !== 'string') return false;
    const lower = val.toLowerCase();
    return lower.includes('am') || lower.includes('pm');
}

/**
 * Convert human-readable dates -> YYYY-MM-DD.
 * Example: "9 March 2026" -> "2026-03-09"
 * Handles D MMMM YYYY format commonly found in legacy samples.
 */
function toIsoDate(dateStr: string): string {
    if (!dateStr || typeof dateStr !== 'string') return dateStr;
    
    // If already YYYY-MM-DD, skip
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    // Handle "9 March 2026" or "09 March 2026"
    const parts = dateStr.trim().split(' ');
    if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const monthName = parts[1].toLowerCase();
        const year = parts[2];

        const months: Record<string, string> = {
            january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
            july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
            jan: '01', feb: '02', mar: '03', apr: '04', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
        };

        const month = months[monthName];
        if (month && /^\d{4}$/.test(year)) {
            return `${year}-${month}-${day}`;
        }
    }

    // Fallback: try native Date parsing if it looks like a date
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
    }

    return dateStr;
}

/**
 * Convert "04:10 PM" -> "16:10" or "09:00 AM" -> "09:00".
 * IST-safe: pure string parsing, no Date object usage for this conversion.
 */
function to24HourTime(timeStr: string): string {
    if (!timeStr || !isAmPmString(timeStr)) return timeStr;
    
    const upper = timeStr.trim().toUpperCase();
    const isPM = upper.includes('PM');
    const isAM = upper.includes('AM');
    const cleaned = upper.replace('PM', '').replace('AM', '').trim();
    const [hourStr, minStr] = cleaned.split(':');
    
    let hour = parseInt(hourStr, 10);
    const min = minStr || '00';

    if (isPM && hour !== 12) hour += 12;
    if (isAM && hour === 12) hour = 0; // 12:xx AM -> 00:xx

    return `${String(hour).padStart(2, '0')}:${min.padStart(2, '0')}`;
}

/**
 * Convert string/number Dates -> { _seconds, _nanoseconds } Firestore map.
 * Already-converted Timestamps are skipped (idempotent).
 */
function toFirestoreTimestamp(val: any): { _seconds: number; _nanoseconds: number } | any {
    if (!val) return val;
    if (val._seconds !== undefined) return val; // Already a Firestore Timestamp map

    let ms: number;
    if (typeof val === 'string' || typeof val === 'number') {
        ms = new Date(val).getTime();
    } else if (val instanceof Date) {
        ms = val.getTime();
    } else {
        return val; // Unknown type, leave unchanged
    }

    if (isNaN(ms)) return val;

    return {
        _seconds: Math.floor(ms / 1000),
        _nanoseconds: (ms % 1000) * 1_000_000
    };
}

function readJson(filePath: string): Record<string, any> {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath: string, data: Record<string, any>) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function processCollection(filename: string, processor: (doc: any) => boolean) {
    const filePath = path.join(backupPath, filename);
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Skipping (not found): ${filename}`);
        return;
    }

    console.log(`\nProcessing ${filename}...`);
    const data = readJson(filePath);
    let modified = 0;

    const newData = Object.fromEntries(
        Object.entries(data).map(([id, doc]: [string, any]) => {
            const changed = processor(doc);
            if (changed) modified++;
            return [id, doc];
        })
    );

    writeJson(filePath, newData);
    console.log(` ✔  ${modified} / ${Object.keys(data).length} documents updated.`);
}

// ========================
// Sub-routines
// ========================

function upgradeAppointments(doc: any): boolean {
    let changed = false;
    
    if (doc.date) {
        const newDate = toIsoDate(doc.date);
        if (newDate !== doc.date) {
            doc.date = newDate;
            changed = true;
        }
    }
    
    if (isAmPmString(doc.time)) { doc.time = to24HourTime(doc.time); changed = true; }
    if (isAmPmString(doc.arriveByTime)) { doc.arriveByTime = to24HourTime(doc.arriveByTime); changed = true; }

    const tsFields = ['createdAt', 'updatedAt', 'confirmedAt', 'completedAt', 'arrivedAt', 'skippedAt', 'noShowAt', 'bufferedAt', 'priorityAt'];
    tsFields.forEach(field => {
        if (doc[field] && !doc[field]._seconds) {
            doc[field] = toFirestoreTimestamp(doc[field]);
            changed = true;
        }
    });

    return changed;
}

function upgradeDoctor(doc: any): boolean {
    let changed = false;

    // Fix availability slots from AM/PM -> 24h
    if (Array.isArray(doc.availabilitySlots)) {
        doc.availabilitySlots = doc.availabilitySlots.map((dayObj: any) => {
            if (Array.isArray(dayObj.timeSlots)) {
                dayObj.timeSlots = dayObj.timeSlots.map((slot: any) => {
                    if (isAmPmString(slot.from)) { slot.from = to24HourTime(slot.from); changed = true; }
                    if (isAmPmString(slot.to)) { slot.to = to24HourTime(slot.to); changed = true; }
                    return slot;
                });
            }
            return dayObj;
        });
    }

    // Migrate old availabilityExtensions -> dateOverrides (only if dateOverrides not set yet)
    if (doc.availabilityExtensions && !doc.dateOverrides) {
        const overrides: Record<string, any> = {};
        // Parse strings like "2026-01-22T11:00:00.000Z" as isOff: true markers
        const extensions = Array.isArray(doc.availabilityExtensions) 
            ? doc.availabilityExtensions 
            : Object.keys(doc.availabilityExtensions);

        extensions.forEach((rawDate: string) => {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
                const dateKey = d.toISOString().split('T')[0];
                // Matches DoctorOverride interface: { isOff: boolean, slots?: [] }
                overrides[dateKey] = { isOff: true, slots: [] };
            }
        });
        
        doc.dateOverrides = overrides;
        delete doc.availabilityExtensions;
        changed = true;
    }

    if (doc.updatedAt && !doc.updatedAt._seconds) {
        doc.updatedAt = toFirestoreTimestamp(doc.updatedAt); changed = true;
    }

    return changed;
}

function upgradeClinic(doc: any): boolean {
    let changed = false;

    if (Array.isArray(doc.operatingHours)) {
        doc.operatingHours = doc.operatingHours.map((op: any) => {
            if (Array.isArray(op.timeSlots)) {
                op.timeSlots = op.timeSlots.map((slot: any) => {
                    if (isAmPmString(slot.open)) { slot.open = to24HourTime(slot.open); changed = true; }
                    if (isAmPmString(slot.close)) { slot.close = to24HourTime(slot.close); changed = true; }
                    return slot;
                });
            }
            return op;
        });
    }

    const tsFields = ['createdAt', 'updatedAt', 'registrationDate', 'planStartDate'];
    tsFields.forEach(field => {
        if (doc[field] && !doc[field]._seconds) {
            doc[field] = toFirestoreTimestamp(doc[field]); changed = true;
        }
    });

    return changed;
}

function upgradeTimestamps(fields: string[]) {
    return (doc: any): boolean => {
        let changed = false;
        fields.forEach(field => {
            if (doc[field] && !doc[field]._seconds) {
                doc[field] = toFirestoreTimestamp(doc[field]); changed = true;
            }
        });
        return changed;
    };
}

function upgradePunctualityLog(doc: any): boolean {
    let changed = false;
    if (isAmPmString(doc.scheduledTime)) { doc.scheduledTime = to24HourTime(doc.scheduledTime); changed = true; }
    if (doc.timestamp && !doc.timestamp._seconds) { doc.timestamp = toFirestoreTimestamp(doc.timestamp); changed = true; }
    return changed;
}

// ========================
// Entry Point
// ========================

async function run() {
    console.log('======================================');
    console.log('Kloqo V2 Time Standardization Script');
    console.log(`Backup: ${backupPath}`);
    console.log('======================================');

    processCollection('appointments.json', upgradeAppointments);
    processCollection('doctors.json', upgradeDoctor);
    processCollection('clinics.json', upgradeClinic);
    processCollection('patients.json', upgradeTimestamps(['createdAt', 'updatedAt']));
    processCollection('prescriptions.json', upgradeTimestamps(['date', 'createdAt', 'updatedAt']));
    processCollection('doctor_punctuality_logs.json', upgradePunctualityLog);
    processCollection('whatsapp_sessions.json', upgradeTimestamps(['lastMessageAt']));
    processCollection('users.json', upgradeTimestamps(['createdAt', 'updatedAt']));

    console.log('\n======================================');
    console.log('✅ Standardization Complete!');
    console.log('Now run: npx ts-node src/scripts/restore-firestore.ts ' + BACKUP_DIR);
    console.log('======================================');
}

run().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
