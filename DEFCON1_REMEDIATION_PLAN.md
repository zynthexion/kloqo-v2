# Kloqo V2: Defcon 1 Implementation Plan

**To:** Principal Software Engineer / Release Manager  
**Topic:** Critical Security & Integrity Remediation (Production-Blocker Patch)  
**Status:** **DEFCON 1** (Immediate Action Required)  

---

### Phase 1: The Security Hotfixes (Immediate Execution)

#### 1. Superadmin Data Leak (RBAC Enforcement)
*   **File Path:** `backend/src/infrastructure/webserver/express/index.ts`
*   **Code Change:** Inject `checkRole` middleware and apply it to all `/superadmin` routes.
```typescript
// Define middleware after authenticateToken (approx L400)
const checkRole = (role: string) => (req: any, res: any, next: any) => {
  if (req.user?.role !== role) {
    return res.status(403).json({ error: 'Access Denied: Insufficient Permissions' });
  }
  next();
};

// Re-protect routes (L436-495)
app.use('/superadmin', authenticateToken, checkRole('superadmin')); 
// Note: individual routes should now be defined relative to this or prefixed.
```
*   **Verification:** Attempt to access `/superadmin/dashboard` without a token (Expect 401) and with a `nurse` token (Expect 403).

#### 2. Stack Trace Leaks (Global Error Sanitization)
*   **File Path:** `backend/src/infrastructure/webserver/express/index.ts`
*   **Code Change:** Append a global error handler at the very bottom of the file, before `app.listen`.
```typescript
// Global Error Handler (L635)
app.use((err: any, req: any, res: any, next: any) => {
  console.error(`[FATAL ERROR]: ${err.stack}`); // Keep stack in server logs only
  const status = err.status || 500;
  res.status(status).json({ 
    error: status === 500 ? 'Internal Server Error' : err.message,
    code: err.code || 'INTERNAL_ERROR'
  });
});
```
*   **Verification:** Trigger a manual error in a route (e.g., passing invalid data) and verify the JSON response does not contain a `stack` property.

#### 3. Multi-Tenancy Nuke (`findAll` Scoping)
*   **File Path:** `backend/src/infrastructure/firebase/FirebaseAppointmentRepository.ts`
*   **Code Change:** Modify `findAll` to enforce a `clinicId` check.
```typescript
// L9: Enforce clinicId scoping
async findAll(params?: PaginationParams & { clinicId: string }): Promise<PaginatedResponse<Appointment> | Appointment[]> {
  if (!params?.clinicId) {
    throw new Error('SECURITY_CRITICAL: Mandatory clinicId missing in appointment query.');
  }
  let query = this.collection.where('clinicId', '==', params.clinicId);
  // ... existing pagination logic
}
```
*   **Verification:** Run unit tests for `GetAllAppointmentsUseCase` without a `clinicId` and confirm it throws the fatal security error.

---

### Phase 2: Data Integrity (Database Transactions)

#### 1. The Twin Patient Bug (Race Condition Fix)
*   **File Path:** `backend/src/application/ManagePatientUseCase.ts`
*   **Code Change:** Wrap the "Check-then-Act" logic in a Firestore transaction to ensure atomicity.
```typescript
import { db } from '../infrastructure/firebase/config';

// L18: Refactor execute to use transaction
async execute(request: ManagePatientRequest): Promise<string> {
  return await db.runTransaction(async (transaction) => {
    // Perform all READS first (Firestore transaction rule)
    const phone = `+91${request.phone.replace(/\D/g, '').slice(-10)}`;
    const snapshot = await transaction.get(
      db.collection('patients').where('phone', '==', phone)
    );
    
    let existingPatient = snapshot.docs.find(d => 
      d.data().name.toLowerCase() === request.name.toLowerCase()
    );

    if (existingPatient) {
      // Update logic via transaction.update()
      const updatedClinicIds = Array.from(new Set([...existingPatient.data().clinicIds, request.clinicId]));
      transaction.update(existingPatient.ref, { clinicIds: updatedClinicIds, updatedAt: new Date() });
      return existingPatient.id;
    } else {
      // Create logic via transaction.set()
      const newId = `p-${Date.now()}`;
      const newRef = db.collection('patients').doc(newId);
      transaction.set(newRef, { ...request, phone, clinicIds: [request.clinicId], createdAt: new Date() });
      return newId;
    }
  });
}
```
*   **Verification:** Simulate 5 concurrent `managePatient` calls with the same phone/name via a script and verify only **one** record exists in the database.

---

### Phase 3: The V3 Roadmap (Technical Debt)

In the next sprint, we will target the following files for structural refactoring:
1.  **`index.ts` Decomposition:** Move route definitions into `src/interfaces/http/routes/*.ts` to kill the 600-line "God File."
2.  **`ITokenStrategy` Migration:** Move token counter logic from `FirebaseAppointmentRepository.ts` to `src/domain/services/token` to preserve Clean Architecture boundaries.
3.  **Middleware Extraction:** Move `authenticateToken` and `checkRole` to `src/infrastructure/webserver/express/middleware.ts`.

---

### **Execution Order: 1 → 3 → 2 → 4**
1.  Security (Superadmin) first: **Plugs the leak.**
2.  Scoping second: **Prevents data crossover.**
3.  Error handling third: **Hides internals.**
4.  Transactions last: **Ensures long-term data health.**

**Pass Grade Criteria:** All 4 fixes must be merged before current staging is promoted to production.
