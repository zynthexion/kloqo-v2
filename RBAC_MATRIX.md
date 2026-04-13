# Kloqo V2 RBAC Matrix

**Version:** 2.1 (Post-Audit Upgrade)  
**Status:** Definitive  
**Last Updated:** 2026-04-06

This document defines the Role-Based Access Control (RBAC) rules for the Kloqo V2 monorepo. It serves as the primary technical reference for frontend application boundaries and backend API security.

---

## Section 1: Global Application Access
The following table dictates which roles are permitted to authorize into which frontend environments.

| Application | Allowed Roles | Default Landing Page | Access Strategy |
|-------------|---------------|----------------------|-----------------|
| **Clinic Admin App** | `clinicAdmin`, `superAdmin` | `/dashboard` | Protected by `AuthContext` + `RBACUtils.hasAnyRole`. |
| **Nurse App** | `nurse`, `pharmacist`, `receptionist`, `doctor`, `clinicAdmin`, `superAdmin` | `/queue` | Protected by `ProtectedRoute` component. Multi-role identity switching supported. |
| **Super Admin App** | `superAdmin` | `/dashboard` | Strict `isSuperAdmin` check in `AuthContext`. |
| **Patient App** | `patient` | `/appointments` | **Hard Boundary:** Staff credentials are restricted from patient-facing login flows. |

---

## Section 2: Backend Route Security (The Source of Truth)
Comprehensive list of protected API endpoints and their required role levels.

| Domain | Endpoint (Method /Path) | Required Roles (`checkRole`) | Tenant Isolated |
|--------|--------------------------|------------------------------|-----------------|
| **Pharmacy** | `PATCH /prescriptions/:id/dispense` | `pharmacist`, `clinicAdmin`, `superAdmin` | **Yes** |
| **Pharmacy** | `PATCH /prescriptions/:id/abandon` | `pharmacist`, `clinicAdmin`, `superAdmin` | **Yes** |
| **Storage** | `POST /storage/upload` | `nurse`, `doctor`, `pharmacist`, `clinicAdmin`, `superAdmin` | **Yes** |
| **Appointments** | `GET /appointments/dashboard` | `clinicAdmin`, `doctor`, `nurse`, `pharmacist`, `receptionist`, `superAdmin` | **Yes** |
| **Clinics** | `PATCH /clinic/settings` | `clinicAdmin`, `superAdmin` | **Yes** |
| **Staff** | `DELETE /clinic/staff/:id` | `clinicAdmin`, `superAdmin` | **Yes** |
| **Superadmin** | `GET /superadmin/clinics` | `superAdmin` | **No** (Global) |
| **Superadmin** | `POST /superadmin/clinics` | `superAdmin` | **No** (Global) |
| **Auth** | `PATCH /auth/profile` | `Any Authenticated` | **Yes** (Self) |

---

## Section 3: Frontend Feature Visibility
Conditional UI components restricted via `RBACUtils`.

| Application | Feature / Component | Visibility Restriction (Required Role) |
|-------------|---------------------|-----------------------------------------|
| **Nurse App** | Pharmacy Dispensing Actions | `pharmacist`, `clinicAdmin`, `superAdmin` |
| **Nurse App** | Revenue Reports Sidebar | `clinicAdmin`, `superAdmin` |
| **Clinic Admin** | Clinic Settings Update | `clinicAdmin`, `superAdmin` |
| **Clinic Admin** | Deleting Staff Members | `clinicAdmin`, `superAdmin` |
| **All Apps** | SuperAdmin Portal Link | `superAdmin` only |

---

## Section 4: Security Debt & Remediation
Items identified during the audit that require future monitoring or have been recently patched.

### 1. Hardened: Storage Upload Security (PATCHED)
*   **Vulnerability:** Previously, `POST /storage/upload` was unauthenticated.
*   **Fix:** Added `auth` middleware and restricted access to authorized clinical and administrative staff.

### 2. Standardized: Role Fragmentation (PATCHED)
*   **Issue:** Legacy roles like `admin`, `super-admin`, and `superadmin` were present in the codebase.
*   **Fix:** System-wide standardization to camelCase (`clinicAdmin`, `superAdmin`). Legacy strings have been removed from the `Role` type index.

### 3. Isolated: Patient Boundary Enforcement
*   **Constraint:** Staff accounts are strictly prohibited from utilizing the Patient App. This prevents state contamination and ensures patient data integrity.

---

> [!CAUTION]
> Backend controllers should always perform secondary validation for `clinicId` matching (Dual-Write safety) even if the route is role-guarded.
