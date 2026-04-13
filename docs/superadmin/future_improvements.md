# Superadmin Improvement Roadmap

This document outlines the proposed improvements and future pending works for the Kloqo Superadmin platform. While the initial refactor and pagination goals are complete, these steps will further harden the architecture and improve scalability.

## 🛠 Backend Infrastructure (Technical Debt)

### 1. Centralized Error Handling
Move away from repetitive `try-catch` blocks in controllers to a unified Express Error Middleware.
- **Goal**: Reduce boilerplate and ensure consistent error responses (`{ error: string, code: string }`).

### 2. Request Validation (Zod)
Implement Zod schemas for all Superadmin endpoints.
- **Goal**: Catch malformed requests at the entrance before they hit the domain layer. Ensure type safety from request to repository.

### 3. Unified API Response Wrapper
Standardize all API outputs to a consistent structure.
- **Example**: `{ data: T, meta: { total: number, page: number }, status: string }`.

## 🛡 Security & Compliance

### 1. Audit Trail (Activity Logs)
- **Pending**: Implement an `AuditLogRepository` to record every "Write" operation performed by a Superadmin (e.g., "Admin X deleted Clinic Y at [Timestamp]").
- **Value**: Critical for compliance and debugging production changes.

### 2. Backend RBAC Enforcement
- **Pending**: Ensure every Superadmin API validates the user's role on the backend, not solely relying on frontend route protection.

## ⚡️ Frontend Improvisations

### 1. TanStack Query (React Query)
- **Pending**: Migrate `PatientsPage` and `ClinicsPage` to use React Query.
- **Value**: Automatic caching, window-focus refetching, and cleaner handling of paginated server-side state.

### 2. Bulk Actions
- **Pending**: Add checkboxes to management tables to allow Bulk Deactivation or Bulk CSV Export.

### 3. Real-time Dashboard
- **Pending**: Implement WebSockets or Firebase Snapshot listeners for the "Critical Errors" log to alert the Superadmin instantly.

## 📊 Performance Optimization

### 1. Database Indexing
- **Observation**: As the Patient collection grows, queries like `countByStatus` and complex analytics filters will slow down.
- **Action**: Add composite indexes in Firestore for combined filtered queries.
