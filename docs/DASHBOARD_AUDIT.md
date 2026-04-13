# Clinic Admin Dashboard: Data Points & Logic Audit

This document details every information point visible on the Clinic Admin dashboard and the underlying logic used to aggregate this data.

## 1. Overview Statistics (Top Cards)

| Metric | Calculation Logic | Source Data |
| :--- | :--- | :--- |
| **Total Patients** | Unique `patientId` count for appointments within the selected date range. | `appointments` |
| **Total Doctors** | Total number of active (non-deleted) doctors in the clinic. | `doctors` |
| **Completed Appointments** | Total appointments with `status: 'Completed'` in the selected range. | `appointments` |
| **Upcoming** | Appointments with `status: 'Confirmed' \| 'Pending'` where date is Today or Future. | `appointments` |
| **Cancelled** | Appointments with `status: 'Cancelled'` (Excludes those cancelled by `cancelledByBreak`). | `appointments` |
| **Total Revenue** | Calculated per Appointment. Skips fee if within the doctor's `freeFollowUpDays`. | `appointments` + `doctors` |

---

## 2. Dynamic Charts & Analytics

### Appointment Status (Donut Chart)
- **Data Source**: Aggregated counts of all appointment statuses (`Pending`, `Confirmed`, `Skipped`, `Completed`, `Cancelled`, `No-show`).
- **Context**: Provides a snapshot of clinic throughput and attrition.

### Patients vs. Appointments (Line/Bar Chart)
- **Time Window**: Daily (for ranges ≤ 60 days) or Monthly (for ranges > 60 days).
- **Metrics**: Compares `uniquePatients` vs `completedAppointments` per time unit.

### Peak Hours (Bar Chart)
- **Granularity**: 24-hour distribution.
- **Logic**: Aggregates appointment count by the hour extracted from `apt.time` (24h format).

---

## 3. Real-Time Operational Lists

### Today's Appointments (Recent Activity)
- **Scope**: Top 10 appointments for the selected date.
- **Fields**: Patient Name, Time, Doctor Name, Status.

### Doctor Availability
- **Scope**: All doctors in the clinic.
- **Busy/Available Logic**: A doctor is marked **Busy** if they have at least one appointment with `status: 'Confirmed'` in the current window.
- **Display Fields**: Name, Avatar, Specialization (Department), Status.

---

## 4. Security & Isolation (Guardrails)

- **Rule 15 Enforcement**: All data is strictly filtered by `clinicId` in the backend Repository layer.
- **RBAC**: Access to this dashboard requires `clinicAdmin` or `superAdmin` role.
- **Data Cleanup**: Automatically excludes soft-deleted records (`isDeleted: true`).
