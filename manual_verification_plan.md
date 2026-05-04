# Master Queue Verification Plan — The "Defensive Engine" Edition (v7.0)

> **Goal:** Prove the "Doctor-Driven" flow, "Vacuum Engine" sync, and "Consultation Boundary Lock" via a chronological walkthrough.
> **Start Time:** 12:00 PM

---

## 🕒 Phase 1: Pre-Session Buffer (11:30 AM – 11:59 AM)

*The doctor has not arrived. The arrived queue fills up, and the engine identifies the "At Door" patient.*

| Time | Event | Patient | Action | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **11:30 AM** | 🟢 Very Early Arrival | **Rajan (A-002)** | Nurse: Confirm Arrival | `Pending → Confirmed`. **Indigo Badge** appears. |
| **11:55 AM** | 🟢 Early Arrival | **Amit (A-005)** | Nurse: Confirm Arrival | `Pending → Confirmed`. Stays below Rajan. |
| **11:58 AM** | 🚶 Walk-in Arrives | **W-101** | Register walk-in | Placed at **Slot 4 (12:40 PM)**. |

---

## 🕘 Phase 2: Session Opens + The "Boundary Lock" (12:00 PM – 12:10 PM)

*This phase proves the "Consultation Boundary Lock"—preventing messy slot jumps while a doctor is busy.*

| Time | Event | Patient | Action | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **12:00 PM** | Doctor Arrives | — | Doctor: Toggle Sidebar `IN` | **Verification Card** for Rajan (A-002) appears. |
| **12:01 PM** | Call Rajan | **Rajan (A-002)** | Doctor: Click **"Yes"** | A-002 moves to `InConsultation`. Canvas loads. |
| **12:01 PM** | ⚠️ **NEW TEST** | **W-102** | Register new walk-in | 🔒 **Hard Floor**: Must NOT be placed at Slot 0. Lands at Slot 4+. |
| **12:05 PM** | ⚡ **AUTO-SKIP** | **Priya (A-001)** | *System Auto-fires* | Priya → `Skipped`. Slot 0 is now empty. |
| **12:06 PM** | 🔒 **FREEZE CHECK** | **W-101** | Watch Dashboard | **W-101 must NOT move to Slot 0**. The doctor is busy with Rajan. |
| **12:10 PM** | Consult Ends | **Rajan (A-002)** | Doctor: Submit Rx | Rajan → `Completed`. **Lock Lifts.** |
| **12:10 PM** | ✅ **VACUUM** | **W-101** | *Auto-fires* | W-101 pulls forward to **Slot 0**. |
| **12:10 PM** | Next Gate | **W-101** | Dashboard View | **Verification Card** for W-101 appears. |

---

## 🕘 Phase 3: Late Arrivals & Priority Jumps (12:15 PM – 12:45 PM)

| Time | Event | Patient | Action | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **12:15 PM** | 🟢 On-Time Arrival | **Meena (A-003)** | Nurse: Confirm Arrival | `Pending → Confirmed`. Waits at Slot 2. |
| **12:20 PM** | Call W-101 | **W-101** | Doctor: Click **"Yes"** | W-101 (at Slot 0) -> `InConsultation`. |
| **12:30 PM** | 🕑 Slot Passes | **Suresh (A-004)** | *Do Nothing* | Suresh is NOT skipped (Grace ends at 12:35 PM). |
| **12:33 PM** | 🟡 Late Arrival | **Suresh (A-004)** | Nurse: Confirm Arrival | Admitted normally. No skip. |
| **12:40 PM** | Consult Ends | **W-101** | Doctor: Submit Rx | W-101 -> `Completed`. Card for Meena (A-003) appears. |
| **12:45 PM** | 🔵 **PRIORITY** | **Deepa (A-006)** | Nurse: Confirm + **Priority** | Deepa jumps to top. **Indigo Badge** hits Deepa. |
| **12:45 PM** | ⚡ **LOCK SYNC** | **Deepa (A-006)** | Watch Doctor screen | **Verification Card** for Meena is replaced by **Deepa** instantly. |

---

## 📋 Analysis: Is the "Freeze Logic" (Phase 2) a good idea?

**1. Is it a good or bad idea?**
It is a **GOOD** idea. It is called **"Defensive Queueing"**. It prevents the "Musical Chairs" effect where a doctor finishes a patient and sees a different name than they expected on the screen. It keeps the room workflow stable.

**2. Does it cause Revenue Loss?**
**NO.** The doctor is already busy with Rajan (A-002) until 12:10 PM. Whether Slot 0 is empty or full during those 10 minutes doesn't matter—the doctor cannot see a second patient simultaneously anyway. At 12:10 PM, the moment the doctor is free, the vacuum engine instantly fills the slot. **Throughput is 100% maintained.**

**3. If Priya (A-001) comes back, where is she?**
She triggers the **Downgrade Protocol**. Since her original Slot 0 is now occupied (or about to be) by W-101, she is rebooked as a Walk-in at the **back of the arrived queue**. She loses her "Advanced" priority for being late.

---

## ✅ Success Criteria Checklist
- [ ] **Zero Jump-Scares**: No patient fills a slot below the current consultation until the session is completed.
- [ ] **Indigo Badge Presence**: Badge is visible to Nurse/Admin to signal "Next Person to Door".
- [ ] **Confirmation Gate**: Prescription canvas NEVER loads without the doctor clicking "Yes".
- [ ] **Priority Dominance**: Priority toggle instantly updates the doctor's Verification Card via SSE.
