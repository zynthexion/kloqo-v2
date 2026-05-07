import * as fs from 'fs';
import * as path from 'path';

const TEST_RESULTS_DIR = path.join(__dirname, '../../test_results');
const DOCTORS_FILE = path.join(TEST_RESULTS_DIR, 'doctors.json');
const APPOINTMENTS_FILE = path.join(TEST_RESULTS_DIR, 'appointments.json');
const SLOT_LOCKS_FILE = path.join(TEST_RESULTS_DIR, 'slot-locks.json');

const TARGET_DATE = '2026-05-08';
const DOCTOR_ID = 'doc-1776757867561';

function parseTime(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function formatTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

async function run() {
    let doctors = [];
    if (fs.existsSync(DOCTORS_FILE)) {
        doctors = JSON.parse(fs.readFileSync(DOCTORS_FILE, 'utf8'));
    }

    const doctor = doctors.find((d: any) => d.id === DOCTOR_ID);
    if (!doctor) throw new Error(`Doctor not found`);

    // We want the appointments in the actual schedule, so we don't add dateOverrides here.
    // The actual schedule for Friday is 15:00-16:00 and 19:00-20:30.

    const appointments: any[] = [];
    const slotLocks: any[] = [];
    const avgConsultTime = doctor.averageConsultingTime || 5;

    function createBooking(sIndex: number, slotIdx: number, time: string, suffix: string, tokenNum: number) {
        const aptId = `apt-tomorrow-s${sIndex}-${slotIdx}`;
        const tokenStr = `A-${tokenNum.toString().padStart(3, '0')}`;
        
        appointments.push({
            id: aptId,
            patientId: `p-test-s${sIndex}-${slotIdx}`,
            patientName: `A-Patient ${suffix} ${tokenStr}`,
            doctorId: doctor.id,
            doctorName: doctor.name,
            clinicId: doctor.clinicId,
            date: TARGET_DATE,
            originalTime: time,
            originalArriveByTime: time,
            slotIndex: slotIdx,
            sessionIndex: sIndex,
            status: "Pending",
            paymentStatus: "Unpaid",
            bookedVia: "Advanced Booking",
            tokenNumber: tokenStr,
            numericToken: tokenNum,
            time: time,
            arriveByTime: time,
            createdAt: { _seconds: Math.floor(Date.now() / 1000), _nanoseconds: 0 }
        });

        slotLocks.push({
            id: `${doctor.id}_${TARGET_DATE}_s${sIndex}_slot${slotIdx}`,
            appointmentId: aptId,
            doctorId: doctor.id,
            date: TARGET_DATE,
            sessionIndex: sIndex,
            slotIndex: slotIdx,
            createdAt: { _seconds: Math.floor(Date.now() / 1000), _nanoseconds: 0 }
        });
    }

    // Session 0 (100% full = 10 Advanced slots)
    // Walk-ins are every 5th slot (index 4, 9, 14...)
    const s0Start = parseTime('15:00');
    let s0AdvCount = 0;
    let s0SlotIdx = 0;
    while(s0AdvCount < 10) {
        if (s0SlotIdx % 5 === 4) { // W slot, skip for Advanced
            s0SlotIdx++;
            continue; 
        }
        createBooking(0, s0SlotIdx, formatTime(s0Start + s0SlotIdx * avgConsultTime), 'Morning', s0SlotIdx + 1);
        s0AdvCount++;
        s0SlotIdx++;
    }

    // Session 1 (50% full = 15 Advanced slots)
    // Starts at index 1000.
    const s1Start = parseTime('19:00');
    let s1AdvCount = 0;
    let s1SlotIdx = 1000;
    let s1LogicalIdx = 0;
    while(s1AdvCount < 15) {
        if (s1LogicalIdx % 5 === 4) { // W slot, skip for Advanced
            s1LogicalIdx++;
            s1SlotIdx++;
            continue;
        }
        createBooking(1, s1SlotIdx, formatTime(s1Start + s1LogicalIdx * avgConsultTime), 'Evening', s1SlotIdx + 1);
        s1AdvCount++;
        s1LogicalIdx++;
        s1SlotIdx++;
    }

    fs.writeFileSync(APPOINTMENTS_FILE, JSON.stringify(appointments, null, 2));
    fs.writeFileSync(SLOT_LOCKS_FILE, JSON.stringify(slotLocks, null, 2));
    
    console.log(`✅ Generated ${appointments.length} appointments and ${slotLocks.length} slot-locks for ${TARGET_DATE}`);
}

run().catch(console.error);
