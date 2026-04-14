# RBAC Audit & Application Routing Rules (V2)

## Section A: The Role Matrix

The following table defines the access control levels across the Kloqo V2 ecosystem. 

| Role Name | Primary App Access | Default Landing Route | Core Domain Permissions |
|-----------|--------------------|-----------------------|-------------------------|
| **superAdmin** | Super Admin App | `/dashboard` | Global clinic lifecycle, system-wide analytics, license management. |
| **clinicAdmin** | Clinic Admin App | `/dashboard` | Staff management, clinic settings, department limits, billing & reports. |
| **doctor** | Doctor App / Nurse App | `/consultations` | Patient medical history, E-Prescriptions, clinical consultation flow. |
| **nurse** | Nurse App | `/queue` | Vitals logging, queue orchestration, patient arrival check-in. |
| **pharmacist** | Nurse App | `/pharmacy` | Prescription lookup, medicine dispensing, medication reconciliation. |
| **receptionist** | Nurse App | `/registration` | Appointment booking, patient upsert, payment collection. |

---

## Section B: Authentication & Routing Flow

### 1. Unified Authentication
Kloqo V2 utilizes a centralized Node.js backend for authentication. On successful login, the backend issues a single **Cross-App JWT** signed with a secret known to all services.

### 2. The Global Token Structure
The JWT payload contains a Dual-Write structure for backward compatibility:
```json
{
  "uid": "USER_ID",
  "role": "nurse", 
  "roles": ["nurse", "pharmacist"],
  "clinicId": "CLINIC_ID",
  "accessibleMenus": ["queue", "pharmacy", "billing"],
  "exp": 1234567890
}
```

### 3. Hybrid User Context (The Switcher)
For users with multiple operational identities (e.g., **Nurse + Pharmacist**):
- **Authorization:** Permissions are controlled via the `roles` array (and `accessibleMenus`).
- **Routing:** The `nurse-app` utilizes the `useActiveIdentity` hook to evaluate the `roles: KloqoRole[]` array. If the array length > 1, the "Active Identity Switcher" is enabled in the sidebar/settings.
- **Persistence:** Because all V2 apps share a centralized backend, a user can navigate from `nurse.kloqo.com` to `admin.kloqo.com`. The Admin layout will verify the `roles` array contains `clinicAdmin` or `superAdmin` via `RBACUtils.hasAnyRole`.

### 4. Direct Entry Protection & The "Silent Teleportation" Portal (Hardened)
Each Next.js application uses a `Layout` component containing a `verifyStatus` or `AppGuard` check on load utilizing `RBACUtils`. To provide a premium, invisible UX, users authenticated to the wrong portal are automatically and silently routed to their correct dashboard via strictly enforced environment variables (localhost fallbacks are removed for security):

- **Doctor App** → Only allows `RBACUtils.hasAnyRole(user, ['doctor'])`.
- **Clinic Admin App** → Only allows `RBACUtils.hasAnyRole(user, ['clinicAdmin', 'superAdmin'])`. Unauthorized roles hitting this portal are **silently teleported** (e.g., Doctors to the Nurse App, Patients to the Patient App).
- **Nurse App** → Allows clinical staff: `RBACUtils.hasAnyRole(user, ['nurse', 'pharmacist', 'receptionist', 'doctor'])`.
- **Break-the-Loop Safeguards**: If a role is completely unrecognized, the session invokes `logout()` immediately. This actively "Breaks the Loop" if a user gets caught in an infinite redirect cycle between apps.

### 5. Backend SRE Standard: The Custom Claims TTL Risk
Our Node.js middleware `verifyToken` strictly relies on Firebase Custom Claims. 
> To avoid the "Middleware Database Trap," the backend **does not perform live Firestore account queries on every REST request**. It inherits the industry-standard 1-hour JWT TTL. If a Super Admin is fired, they maintain access for the remainder of their session until their token expires, unless a backend script explicitly triggers `admin.auth().revokeRefreshTokens(uid)`. This architecture ensures the platform remains ultra-performant and strictly respects FinOps / Free-tier database read limits.

---

## Section C: Strict Boundary Violations

The following actions are architecturally blocked or must trigger an immediate `403 Forbidden` response:

1. **Cross-Tenant Bleed (The Forbidden Step):** Any request where the JWT `clinicId` does not match the target resource's `clinicId` (Rule 15).
2. **Clinical/Financial Separation:** A user with a strict `doctor` or `nurse` role (no `billing` in `accessibleMenus`) attempting to access `/clinic/billing` or `/clinic/revenue` endpoints.
3. **Escalation Loop:** A `clinicAdmin` attempting to modify their own `numDoctors` limit or `registrationStatus`. These fields are strictly write-protected and only modifiable via a `superAdmin` token.
4. **Patient Impersonation:** A `patient` token attempting to hit any `/clinic/*` management endpoint. Patient tokens are restricted strictly to `/appointments/me` and `/prescriptions/me`.
5. **Session Hijacking:** The backend will invalidate sessions if the `User-Agent` or `IP` changes significantly during a session (optional but recommended for V3).
